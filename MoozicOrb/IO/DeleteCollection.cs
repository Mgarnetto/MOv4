using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class DeleteCollection
    {
        // Reusing the MediaDeletionResult class from DeleteMedia.cs!
        public MediaDeletionResult Execute(long collectionId, int userId)
        {
            var result = new MediaDeletionResult();

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                long? coverImageId = null;

                // ========================================================
                // STEP 1: Verify Ownership, Lock Status, and Extract Cover ID
                // ========================================================
                string selectSql = "SELECT is_locked, cover_image_id FROM collections WHERE collection_id = @id AND user_id = @uid";
                using (var cmd = new MySqlCommand(selectSql, conn))
                {
                    cmd.Parameters.AddWithValue("@id", collectionId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    using (var reader = cmd.ExecuteReader())
                    {
                        if (!reader.Read())
                        {
                            result.ErrorMessage = "Album not found or access denied.";
                            return result;
                        }
                        if (reader.GetBoolean("is_locked"))
                        {
                            result.ErrorMessage = "Cannot delete a monetized album that has been sold.";
                            return result;
                        }

                        if (!reader.IsDBNull(reader.GetOrdinal("cover_image_id")))
                        {
                            coverImageId = reader.GetInt64("cover_image_id");
                        }
                    }
                }

                // ========================================================
                // STEP 2: The "Check Before You Wreck" Image Protocol
                // ========================================================
                if (coverImageId.HasValue && coverImageId.Value > 0)
                {
                    string checkSql = @"
                        SELECT 
                            (SELECT COUNT(*) FROM media_audio WHERE cover_image_id = @cid) +
                            (SELECT COUNT(*) FROM collections WHERE cover_image_id = @cid) AS TotalUsage";

                    using (var checkCmd = new MySqlCommand(checkSql, conn))
                    {
                        checkCmd.Parameters.AddWithValue("@cid", coverImageId.Value);
                        long totalUsage = Convert.ToInt64(checkCmd.ExecuteScalar());

                        // If NO tracks or other albums are using this image, kill it!
                        if (totalUsage <= 1)
                        {
                            using (var imgCmd = new MySqlCommand("SELECT file_path, storage_provider FROM media_images WHERE image_id = @cid", conn))
                            {
                                imgCmd.Parameters.AddWithValue("@cid", coverImageId.Value);
                                using (var reader = imgCmd.ExecuteReader())
                                {
                                    if (reader.Read())
                                    {
                                        string imgPath = reader["file_path"]?.ToString();
                                        if (!string.IsNullOrEmpty(imgPath)) result.PathsToDelete.Add(imgPath);
                                        result.StorageProvider = reader["storage_provider"] != DBNull.Value ? Convert.ToInt32(reader["storage_provider"]) : 1;
                                    }
                                }
                            }

                            using (var delImgCmd = new MySqlCommand("DELETE FROM media_images WHERE image_id = @cid", conn))
                            {
                                delImgCmd.Parameters.AddWithValue("@cid", coverImageId.Value);
                                delImgCmd.ExecuteNonQuery();
                            }
                        }
                    }
                }

                // ========================================================
                // STEP 3: Purge Track Links & Delete Album Row
                // ========================================================
                using (var cmdBridge = new MySqlCommand("DELETE FROM collection_items WHERE collection_id = @id", conn))
                {
                    cmdBridge.Parameters.AddWithValue("@id", collectionId);
                    cmdBridge.ExecuteNonQuery();
                }

                using (var cmdDelete = new MySqlCommand("DELETE FROM collections WHERE collection_id = @id", conn))
                {
                    cmdDelete.Parameters.AddWithValue("@id", collectionId);
                    cmdDelete.ExecuteNonQuery();
                }

                result.Success = true;
                return result;
            }
        }
    }
}