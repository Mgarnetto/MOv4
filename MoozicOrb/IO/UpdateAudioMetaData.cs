using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateAudioMetadata
    {
        public void Execute(int userId, AudioItemMetadataDto req)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // ==========================================
                // 1. CHECK OWNERSHIP & LOCK STATUS
                // ==========================================
                int isLocked = 0;
                string checkSql = req.TargetType == 1
                    ? "SELECT is_locked FROM media_audio WHERE audio_id = @id AND user_id = @uid"
                    : "SELECT is_locked FROM collections WHERE collection_id = @id AND user_id = @uid";

                using (var cmdCheck = new MySqlCommand(checkSql, conn))
                {
                    cmdCheck.Parameters.AddWithValue("@id", req.TargetId);
                    cmdCheck.Parameters.AddWithValue("@uid", userId);
                    var result = cmdCheck.ExecuteScalar();

                    if (result == null) throw new Exception("Asset not found or you do not have permission to edit it.");
                    isLocked = Convert.ToInt32(result);
                }

                // ==========================================
                // 2. UPDATE THE ASSET TITLE, VISIBILITY & ART (IF UNLOCKED)
                // ==========================================
                if (isLocked == 0)
                {
                    string updateBaseSql = req.TargetType == 1
                        ? "UPDATE media_audio SET title = @title, visibility = @vis"
                        : "UPDATE collections SET title = @title, visibility = @vis";

                    // Dynamically append the cover update if a new image was uploaded
                    if (req.CoverImageId.HasValue && req.CoverImageId.Value > 0)
                    {
                        updateBaseSql += ", cover_image_id = @cover";
                    }

                    updateBaseSql += req.TargetType == 1 ? " WHERE audio_id = @id" : " WHERE collection_id = @id";

                    using (var cmd = new MySqlCommand(updateBaseSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@title", req.Title ?? "Untitled");
                        cmd.Parameters.AddWithValue("@vis", req.Visibility);
                        cmd.Parameters.AddWithValue("@id", req.TargetId);

                        if (req.CoverImageId.HasValue && req.CoverImageId.Value > 0)
                            cmd.Parameters.AddWithValue("@cover", req.CoverImageId.Value);

                        cmd.ExecuteNonQuery();
                    }
                }

                // ==========================================
                // 3. SAFE UPSERT FOR MARKETPLACE OFFERS (ALWAYS ALLOWED)
                // ==========================================
                bool isMonetized = (req.Price.HasValue && req.Price.Value > 0);
                decimal safePrice = req.Price ?? 0m;

                long existingCount = 0;
                using (var cmdCheckOffer = new MySqlCommand("SELECT COUNT(*) FROM marketplace_offers WHERE target_id = @tid AND target_type = @ttype", conn))
                {
                    cmdCheckOffer.Parameters.AddWithValue("@tid", req.TargetId);
                    cmdCheckOffer.Parameters.AddWithValue("@ttype", req.TargetType);
                    existingCount = Convert.ToInt64(cmdCheckOffer.ExecuteScalar());
                }

                if (existingCount > 0)
                {
                    string updateOffer = "UPDATE marketplace_offers SET price = @price, is_active = @active WHERE target_id = @tid AND target_type = @ttype";
                    using (var cmdUp = new MySqlCommand(updateOffer, conn))
                    {
                        cmdUp.Parameters.AddWithValue("@price", safePrice);
                        cmdUp.Parameters.AddWithValue("@active", isMonetized ? 1 : 0);
                        cmdUp.Parameters.AddWithValue("@tid", req.TargetId);
                        cmdUp.Parameters.AddWithValue("@ttype", req.TargetType);
                        cmdUp.ExecuteNonQuery();
                    }
                }
                else
                {
                    string insertOffer = @"
                        INSERT INTO marketplace_offers 
                        (target_type, target_id, price, license_type, is_active, is_locked, created_at) 
                        VALUES 
                        (@ttype, @tid, @price, 1, @active, 0, UTC_TIMESTAMP())";

                    using (var cmdIn = new MySqlCommand(insertOffer, conn))
                    {
                        cmdIn.Parameters.AddWithValue("@ttype", req.TargetType);
                        cmdIn.Parameters.AddWithValue("@tid", req.TargetId);
                        cmdIn.Parameters.AddWithValue("@price", safePrice);
                        cmdIn.Parameters.AddWithValue("@active", isMonetized ? 1 : 0);
                        cmdIn.ExecuteNonQuery();
                    }
                }
            }
        }
    }
}