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
                // 1. UPDATE THE ASSET TITLE & VISIBILITY
                // ==========================================
                string updateBaseSql = "";
                if (req.TargetType == 1) // 1 = Track
                {
                    updateBaseSql = "UPDATE media_audio SET title = @title, visibility = @vis WHERE audio_id = @id AND user_id = @uid";
                }
                else if (req.TargetType == 0) // 0 = Album
                {
                    updateBaseSql = "UPDATE collections SET title = @title, visibility = @vis WHERE collection_id = @id AND user_id = @uid";
                }

                if (!string.IsNullOrEmpty(updateBaseSql))
                {
                    using (var cmd = new MySqlCommand(updateBaseSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@title", req.Title ?? "Untitled");
                        cmd.Parameters.AddWithValue("@vis", req.Visibility);
                        cmd.Parameters.AddWithValue("@id", req.TargetId);
                        cmd.Parameters.AddWithValue("@uid", userId); // Security check

                        int rowsAffected = cmd.ExecuteNonQuery();
                        if (rowsAffected == 0) throw new Exception("Asset not found or you do not have permission to edit it.");
                    }
                }

                // ==========================================
                // 2. SAFE UPSERT FOR MARKETPLACE OFFERS
                // ==========================================
                bool isMonetized = (req.Price.HasValue && req.Price.Value > 0);
                decimal safePrice = req.Price ?? 0m;

                // Step A: Safely check if an offer already exists
                long existingCount = 0;
                using (var cmdCheck = new MySqlCommand("SELECT COUNT(*) FROM marketplace_offers WHERE target_id = @tid AND target_type = @ttype", conn))
                {
                    cmdCheck.Parameters.AddWithValue("@tid", req.TargetId);
                    cmdCheck.Parameters.AddWithValue("@ttype", req.TargetType);
                    existingCount = Convert.ToInt64(cmdCheck.ExecuteScalar());
                }

                // Step B: Explicitly Update or Insert based on exact schema
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
                    // Inserting perfectly mapped to your provided schema columns
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