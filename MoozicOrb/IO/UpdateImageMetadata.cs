using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateImageMetadata
    {
        public bool Execute(int userId, UpdatePostDto req, long targetId, int targetType)
        {
            bool success = false;

            using (MySqlConnection conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (MySqlTransaction transaction = conn.BeginTransaction())
                {
                    try
                    {
                        // 1. Update Post / Collection metadata
                        // Dynamically map table and column names to prevent SQL crashes
                        string table = targetType == 0 ? "collections" : "posts";
                        string idCol = targetType == 0 ? "collection_id" : "post_id";
                        string userCol = "user_id"; // Both tables use user_id
                        string textCol = targetType == 0 ? "description" : "text"; // Collections use description, Posts use text

                        string baseSql = $@"
                            UPDATE {table} 
                            SET title = @Title, {textCol} = @Text, visibility = @Visibility 
                            WHERE {idCol} = @TargetId AND {userCol} = @UserId;";

                        using (MySqlCommand cmd = new MySqlCommand(baseSql, conn, transaction))
                        {
                            cmd.Parameters.AddWithValue("@Title", req.Title ?? (object)DBNull.Value);
                            cmd.Parameters.AddWithValue("@Text", req.Text ?? (object)DBNull.Value);
                            cmd.Parameters.AddWithValue("@Visibility", req.Visibility);
                            cmd.Parameters.AddWithValue("@TargetId", targetId);
                            cmd.Parameters.AddWithValue("@UserId", userId);

                            if (cmd.ExecuteNonQuery() == 0)
                            {
                                transaction.Rollback();
                                return false; // Not found or unauthorized
                            }
                        }

                        // 2. Upsert Marketplace Offer (if a price exists)
                        if (req.Price.HasValue && req.Price.Value >= 0)
                        {
                            string offerSql = @"
                                INSERT INTO marketplace_offers 
                                    (target_type, target_id, price, license_type, is_active, is_locked, created_at) 
                                VALUES 
                                    (@TargetType, @TargetId, @Price, @LicenseType, @IsActive, @IsLocked, UTC_TIMESTAMP())
                                ON DUPLICATE KEY UPDATE 
                                    price = @Price, 
                                    license_type = @LicenseType, 
                                    is_active = @IsActive,
                                    is_locked = @IsLocked;";

                            using (MySqlCommand offerCmd = new MySqlCommand(offerSql, conn, transaction))
                            {
                                offerCmd.Parameters.AddWithValue("@TargetType", targetType);
                                offerCmd.Parameters.AddWithValue("@TargetId", targetId);
                                offerCmd.Parameters.AddWithValue("@Price", req.Price.Value);

                                offerCmd.Parameters.AddWithValue("@LicenseType", 1);
                                offerCmd.Parameters.AddWithValue("@IsActive", 1);
                                offerCmd.Parameters.AddWithValue("@IsLocked", 0);

                                offerCmd.ExecuteNonQuery();
                            }
                        }
                        else
                        {
                            // Pull off market if Price is null
                            string remSql = "UPDATE marketplace_offers SET is_active = 0 WHERE target_type = @TargetType AND target_id = @TargetId;";
                            using (MySqlCommand remCmd = new MySqlCommand(remSql, conn, transaction))
                            {
                                remCmd.Parameters.AddWithValue("@TargetType", targetType);
                                remCmd.Parameters.AddWithValue("@TargetId", targetId);
                                remCmd.ExecuteNonQuery();
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