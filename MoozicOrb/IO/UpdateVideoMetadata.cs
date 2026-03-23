using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;
using System.Linq;

namespace MoozicOrb.IO
{
    public class UpdateVideoMetadata
    {
        public void Execute(int userId, UpdateHubMediaDto req, long targetId, int targetType)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var transaction = conn.BeginTransaction())
                {
                    try
                    {
                        // 1. CHECK OWNERSHIP & LOCK STATUS
                        string checkSql = targetType == 2
                            ? "SELECT 0 AS is_locked FROM posts WHERE post_id = @pid AND user_id = @uid"
                            : "SELECT is_locked FROM collections WHERE collection_id = @id AND user_id = @uid";

                        int isLocked = 0;
                        using (var cmdCheck = new MySqlCommand(checkSql, conn, transaction))
                        {
                            // Use PostId for video ownership check, targetId for collection
                            cmdCheck.Parameters.AddWithValue("@pid", req.PostId > 0 ? req.PostId : targetId);
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

                            if (targetType == 0)
                            {
                                // COLLECTION LOGIC (Preserved exactly)
                                string updateColSql = "UPDATE collections SET title = @title, visibility = @vis" + (newCoverId.HasValue ? ", cover_image_id = @cover" : "") + " WHERE collection_id = @id";
                                using (var cmd = new MySqlCommand(updateColSql, conn, transaction))
                                {
                                    cmd.Parameters.AddWithValue("@title", req.Title ?? "");
                                    cmd.Parameters.AddWithValue("@vis", req.Visibility);
                                    cmd.Parameters.AddWithValue("@id", targetId);
                                    if (newCoverId.HasValue) cmd.Parameters.AddWithValue("@cover", newCoverId.Value);
                                    cmd.ExecuteNonQuery();
                                }
                            }
                            else if (targetType == 2)
                            {
                                // VIDEO HUB ISOLATION: Update Post Wrapper
                                if (req.PostId > 0)
                                {
                                    // FIX: Sync title to the posts table so the Feed shows the updated title
                                    string postSql = "UPDATE posts SET title = @title, content_text = @text, visibility = @vis WHERE post_id = @pid";
                                    using (var pCmd = new MySqlCommand(postSql, conn, transaction))
                                    {
                                        pCmd.Parameters.AddWithValue("@title", req.Title ?? "");
                                        pCmd.Parameters.AddWithValue("@text", req.Text ?? "");
                                        pCmd.Parameters.AddWithValue("@vis", req.Visibility);
                                        pCmd.Parameters.AddWithValue("@pid", req.PostId);
                                        pCmd.ExecuteNonQuery();
                                    }
                                }

                                // VIDEO HUB ISOLATION: Update Native Media Asset
                                if (req.MediaId > 0)
                                {
                                    string mediaSql = "UPDATE media_video SET title = @title, visibility = @vis, price = @price WHERE video_id = @mid";
                                    using (var mCmd = new MySqlCommand(mediaSql, conn, transaction))
                                    {
                                        mCmd.Parameters.AddWithValue("@title", req.Title ?? "");
                                        mCmd.Parameters.AddWithValue("@vis", req.Visibility);
                                        mCmd.Parameters.AddWithValue("@price", req.Price ?? (object)DBNull.Value);
                                        mCmd.Parameters.AddWithValue("@mid", req.MediaId);
                                        mCmd.ExecuteNonQuery();
                                    }
                                }

                                // INTEGRATED THUMBNAIL UPDATE (Preserved User's GetImage Logic)
                                if (req.MediaAttachments != null && req.MediaAttachments.Any())
                                {
                                    var newThumb = req.MediaAttachments.FirstOrDefault(m => m.MediaType == 3);
                                    if (newThumb != null && newThumb.MediaId > 0)
                                    {
                                        var imageRecord = new GetImage().Execute(newThumb.MediaId);
                                        if (imageRecord != null && !string.IsNullOrEmpty(imageRecord.RelativePath))
                                        {
                                            string cleanThumbPath = imageRecord.RelativePath;

                                            string thumbSql = @"
                                                UPDATE media_video v
                                                JOIN post_media pm ON v.video_id = pm.media_id AND pm.media_type = 2
                                                SET v.thumb_path = @thumb
                                                WHERE pm.post_id = @pid";

                                            using (var cmdThumb = new MySqlCommand(thumbSql, conn, transaction))
                                            {
                                                cmdThumb.Parameters.AddWithValue("@thumb", cleanThumbPath);
                                                cmdThumb.Parameters.AddWithValue("@pid", req.PostId > 0 ? req.PostId : targetId);
                                                cmdThumb.ExecuteNonQuery();
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 3. MARKETPLACE LEDGER (Price History Updates)
                        // Route to the correct target ID based on Hub Isolation rules
                        long activeTargetId = (targetType == 2 && req.MediaId > 0) ? req.MediaId : targetId;

                        decimal? currentActivePrice = null;
                        string checkPriceSql = "SELECT price FROM marketplace_offers WHERE target_id = @tid AND target_type = @ttype AND is_active = 1 LIMIT 1";

                        using (var cCmd = new MySqlCommand(checkPriceSql, conn, transaction))
                        {
                            cCmd.Parameters.AddWithValue("@tid", activeTargetId);
                            cCmd.Parameters.AddWithValue("@ttype", targetType);
                            object res = cCmd.ExecuteScalar();
                            if (res != null && res != DBNull.Value)
                            {
                                currentActivePrice = Convert.ToDecimal(res);
                            }
                        }

                        // Only touch the ledger if the price actually changed
                        if (req.Price != currentActivePrice)
                        {
                            string deactSql = "UPDATE marketplace_offers SET is_active = 0 WHERE target_id = @tid AND target_type = @ttype";
                            using (var dCmd = new MySqlCommand(deactSql, conn, transaction))
                            {
                                dCmd.Parameters.AddWithValue("@tid", activeTargetId);
                                dCmd.Parameters.AddWithValue("@ttype", targetType);
                                dCmd.ExecuteNonQuery();
                            }

                            if (req.Price.HasValue && req.Price.Value >= 0)
                            {
                                string insOffer = "INSERT INTO marketplace_offers (target_type, target_id, price, license_type, is_active, is_locked, created_at) VALUES (@ttype, @tid, @price, 1, 1, 0, UTC_TIMESTAMP())";
                                using (var cmdIns = new MySqlCommand(insOffer, conn, transaction))
                                {
                                    cmdIns.Parameters.AddWithValue("@ttype", targetType);
                                    cmdIns.Parameters.AddWithValue("@tid", activeTargetId);
                                    cmdIns.Parameters.AddWithValue("@price", req.Price.Value);
                                    cmdIns.ExecuteNonQuery();
                                }
                            }
                        }

                        transaction.Commit();
                    }
                    catch (Exception)
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
            }
        }
    }
}