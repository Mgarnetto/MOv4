using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateImageMetadata
    {
        public bool Execute(int userId, UpdateHubMediaDto req)
        {
            bool success = false;
            using (MySqlConnection conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (MySqlTransaction transaction = conn.BeginTransaction())
                {
                    try
                    {
                        // 1. UPDATE POST WRAPPER (Description & Feed Visibility)
                        if (req.PostId > 0)
                        {
                            string postSql = "UPDATE posts SET content_text = @Text, visibility = @Visibility WHERE post_id = @PostId AND user_id = @UserId";
                            using (MySqlCommand pCmd = new MySqlCommand(postSql, conn, transaction))
                            {
                                pCmd.Parameters.AddWithValue("@Text", req.Text ?? (object)DBNull.Value);
                                pCmd.Parameters.AddWithValue("@Visibility", req.Visibility);
                                pCmd.Parameters.AddWithValue("@PostId", req.PostId);
                                pCmd.Parameters.AddWithValue("@UserId", userId);
                                pCmd.ExecuteNonQuery();
                            }
                        }

                        // 2. UPDATE RAW ASSET (Title, Visibility, and Native Price)
                        if (req.MediaId > 0)
                        {
                            string mediaSql = "UPDATE media_images SET title = @Title, visibility = @Visibility, price = @Price WHERE image_id = @MediaId AND user_id = @UserId";
                            using (MySqlCommand mCmd = new MySqlCommand(mediaSql, conn, transaction))
                            {
                                mCmd.Parameters.AddWithValue("@Title", req.Title ?? (object)DBNull.Value);
                                mCmd.Parameters.AddWithValue("@Visibility", req.Visibility);
                                mCmd.Parameters.AddWithValue("@Price", req.Price ?? (object)DBNull.Value);
                                mCmd.Parameters.AddWithValue("@MediaId", req.MediaId);
                                mCmd.Parameters.AddWithValue("@UserId", userId);
                                mCmd.ExecuteNonQuery();
                            }

                            // 3. MARKETPLACE PRICE HISTORY (TargetType 3 = Image)
                            decimal? currentActivePrice = null;
                            string checkSql = "SELECT price FROM marketplace_offers WHERE target_id = @MediaId AND target_type = 3 AND is_active = 1 LIMIT 1";
                            using (MySqlCommand cCmd = new MySqlCommand(checkSql, conn, transaction))
                            {
                                cCmd.Parameters.AddWithValue("@MediaId", req.MediaId);
                                object res = cCmd.ExecuteScalar();
                                if (res != null && res != DBNull.Value)
                                {
                                    currentActivePrice = Convert.ToDecimal(res);
                                }
                            }

                            // Only touch the ledger if the price actually changed
                            if (req.Price != currentActivePrice)
                            {
                                string deactSql = "UPDATE marketplace_offers SET is_active = 0 WHERE target_id = @MediaId AND target_type = 3";
                                using (MySqlCommand dCmd = new MySqlCommand(deactSql, conn, transaction))
                                {
                                    dCmd.Parameters.AddWithValue("@MediaId", req.MediaId);
                                    dCmd.ExecuteNonQuery();
                                }

                                if (req.Price.HasValue && req.Price.Value >= 0)
                                {
                                    string insSql = "INSERT INTO marketplace_offers (target_type, target_id, price, license_type, is_active, is_locked, created_at) VALUES (3, @MediaId, @Price, 1, 1, 0, UTC_TIMESTAMP())";
                                    using (MySqlCommand iCmd = new MySqlCommand(insSql, conn, transaction))
                                    {
                                        iCmd.Parameters.AddWithValue("@MediaId", req.MediaId);
                                        iCmd.Parameters.AddWithValue("@Price", req.Price.Value);
                                        iCmd.ExecuteNonQuery();
                                    }
                                }
                            }
                        }

                        transaction.Commit();
                        success = true;
                    }
                    catch (Exception)
                    {
                        transaction.Rollback();
                        throw;
                    }
                }
            }
            return success;
        }
    }
}