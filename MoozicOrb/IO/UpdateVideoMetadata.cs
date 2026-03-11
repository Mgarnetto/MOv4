using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;
using System.Linq;

namespace MoozicOrb.IO
{
    public class UpdateVideoMetadata
    {
        public void Execute(int userId, UpdatePostDto req, long targetId, int targetType)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // 1. CHECK OWNERSHIP & LOCK STATUS
                string checkSql = targetType == 2
                    ? "SELECT is_locked FROM posts WHERE post_id = @id AND author_id = @uid"
                    : "SELECT is_locked FROM collections WHERE collection_id = @id AND user_id = @uid";

                int isLocked = 0;
                using (var cmdCheck = new MySqlCommand(checkSql, conn))
                {
                    cmdCheck.Parameters.AddWithValue("@id", targetId);
                    cmdCheck.Parameters.AddWithValue("@uid", userId);
                    var result = cmdCheck.ExecuteScalar();
                    if (result == null) throw new Exception("Asset not found or permission denied.");
                    isLocked = Convert.ToInt32(result);
                }

                // 2. UPDATE BASE METADATA (IF UNLOCKED)
                if (isLocked == 0)
                {
                    // Catch new cover image ID if one was uploaded
                    long? newCoverId = null;
                    if (req.MediaAttachments != null && req.MediaAttachments.Any())
                    {
                        var newThumb = req.MediaAttachments.FirstOrDefault(m => m.MediaType == 3);
                        if (newThumb != null) newCoverId = newThumb.MediaId;
                    }

                    string updateSql = targetType == 2
                        ? "UPDATE posts SET title = @title, post_text = @text, visibility = @vis WHERE post_id = @id"
                        : "UPDATE collections SET title = @title, visibility = @vis" + (newCoverId.HasValue ? ", cover_image_id = @cover" : "") + " WHERE collection_id = @id";

                    using (var cmd = new MySqlCommand(updateSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@title", req.Title ?? "");
                        if (targetType == 2) cmd.Parameters.AddWithValue("@text", req.Text ?? "");
                        cmd.Parameters.AddWithValue("@vis", req.Visibility);
                        cmd.Parameters.AddWithValue("@id", targetId);

                        if (targetType != 2 && newCoverId.HasValue)
                        {
                            cmd.Parameters.AddWithValue("@cover", newCoverId.Value);
                        }

                        cmd.ExecuteNonQuery();
                    }

                    // INTEGRATED THUMBNAIL UPDATE (For Videos)
                    if (targetType == 2 && req.MediaAttachments != null && req.MediaAttachments.Any())
                    {
                        var newThumb = req.MediaAttachments.FirstOrDefault(m => m.MediaType == 3);
                        if (newThumb != null && !string.IsNullOrEmpty(newThumb.Url))
                        {
                            string thumbSql = @"
                                UPDATE media_video v
                                JOIN post_media pm ON v.video_id = pm.media_id AND pm.media_type = 2
                                SET v.thumb_path = @thumb
                                WHERE pm.post_id = @pid";

                            using (var cmdThumb = new MySqlCommand(thumbSql, conn))
                            {
                                cmdThumb.Parameters.AddWithValue("@thumb", newThumb.Url);
                                cmdThumb.Parameters.AddWithValue("@pid", targetId);
                                cmdThumb.ExecuteNonQuery();
                            }
                        }
                    }
                }

                // 3. MARKETPLACE UPSERT (TargetType 2 = Video, 0 = Collection)
                bool isMonetized = (req.Price.HasValue && req.Price.Value > 0);
                decimal safePrice = req.Price ?? 0m;

                string offerCheck = "SELECT COUNT(*) FROM marketplace_offers WHERE target_id = @tid AND target_type = @ttype";
                long count = 0;
                using (var cmdC = new MySqlCommand(offerCheck, conn))
                {
                    cmdC.Parameters.AddWithValue("@tid", targetId);
                    cmdC.Parameters.AddWithValue("@ttype", targetType);
                    count = Convert.ToInt64(cmdC.ExecuteScalar());
                }

                if (count > 0)
                {
                    string upOffer = "UPDATE marketplace_offers SET price = @price, is_active = @active WHERE target_id = @tid AND target_type = @ttype";
                    using (var cmdUp = new MySqlCommand(upOffer, conn))
                    {
                        cmdUp.Parameters.AddWithValue("@price", safePrice);
                        cmdUp.Parameters.AddWithValue("@active", isMonetized ? 1 : 0);
                        cmdUp.Parameters.AddWithValue("@tid", targetId);
                        cmdUp.Parameters.AddWithValue("@ttype", targetType);
                        cmdUp.ExecuteNonQuery();
                    }
                }
                else if (isMonetized)
                {
                    string insOffer = "INSERT INTO marketplace_offers (target_type, target_id, price, is_active, created_at) VALUES (@ttype, @tid, @price, 1, UTC_TIMESTAMP())";
                    using (var cmdIns = new MySqlCommand(insOffer, conn))
                    {
                        cmdIns.Parameters.AddWithValue("@ttype", targetType);
                        cmdIns.Parameters.AddWithValue("@tid", targetId);
                        cmdIns.Parameters.AddWithValue("@price", safePrice);
                        cmdIns.ExecuteNonQuery();
                    }
                }
            }
        }
    }
}