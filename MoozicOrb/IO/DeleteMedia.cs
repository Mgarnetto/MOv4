using MoozicOrb.Constants;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class MediaDeletionResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
        public List<string> PathsToDelete { get; set; } = new List<string>();
        public int StorageProvider { get; set; }
    }

    public class DeleteMedia
    {
        // HELPER: Dynamically checks if a column exists in the current table schema
        private bool HasColumn(MySqlDataReader reader, string columnName)
        {
            for (int i = 0; i < reader.FieldCount; i++)
            {
                if (reader.GetName(i).Equals(columnName, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }

        public MediaDeletionResult Execute(int userId, long mediaId, int mediaType)
        {
            var result = new MediaDeletionResult();
            string tableName = "";
            string idColumn = "";

            // Route to correct table (1=Audio, 2=Video, 3=Image)
            switch (mediaType)
            {
                case 1:
                    tableName = "media_audio";
                    idColumn = "audio_id";
                    break;
                case 2:
                    tableName = "media_video"; // FIXED: Changed from media_videos to match DB schema
                    idColumn = "video_id";
                    break;
                case 3:
                    tableName = "media_images";
                    idColumn = "image_id";
                    break;
                default:
                    result.ErrorMessage = "Invalid media type.";
                    return result;
            }

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                long? coverImageId = null;

                // ========================================================
                // STEP 1: SELECT * to bypass "Unknown Column" SQL errors
                // ========================================================
                string selectSql = $"SELECT * FROM {tableName} WHERE {idColumn} = @id AND user_id = @uid";

                using (var cmd = new MySqlCommand(selectSql, conn))
                {
                    cmd.Parameters.AddWithValue("@id", mediaId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    using (var reader = cmd.ExecuteReader())
                    {
                        if (!reader.Read())
                        {
                            result.ErrorMessage = "Media not found or access denied.";
                            return result;
                        }

                        // Safely check for monetization lock (Only runs if the column actually exists)
                        if (HasColumn(reader, "is_locked") && !reader.IsDBNull(reader.GetOrdinal("is_locked")))
                        {
                            if (reader.GetBoolean("is_locked"))
                            {
                                result.ErrorMessage = "Cannot delete a monetized item that has been sold or locked.";
                                return result;
                            }
                        }

                        // Collect physical paths dynamically (Images use file_path, Audio uses snippet, Video uses thumb)
                        if (HasColumn(reader, "file_path") && !reader.IsDBNull(reader.GetOrdinal("file_path")))
                        {
                            result.PathsToDelete.Add(reader.GetString("file_path"));
                        }

                        if (HasColumn(reader, "snippet_path") && !reader.IsDBNull(reader.GetOrdinal("snippet_path")))
                        {
                            result.PathsToDelete.Add(reader.GetString("snippet_path"));
                        }

                        if (HasColumn(reader, "thumb_path") && !reader.IsDBNull(reader.GetOrdinal("thumb_path")))
                        {
                            result.PathsToDelete.Add(reader.GetString("thumb_path"));
                        }

                        // Get Storage Provider (Local vs Cloudflare R2)
                        if (HasColumn(reader, "storage_provider") && !reader.IsDBNull(reader.GetOrdinal("storage_provider")))
                        {
                            result.StorageProvider = reader.GetInt32("storage_provider");
                        }

                        // Extract the Cover Image ID safely (Only exists on Audio)
                        if (HasColumn(reader, "cover_image_id") && !reader.IsDBNull(reader.GetOrdinal("cover_image_id")))
                        {
                            coverImageId = reader.GetInt64("cover_image_id");
                        }
                    }
                }

                // ========================================================
                // STEP 2: The "Check Before You Wreck" Image Protocol (Audio Covers)
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

                        if (totalUsage <= 1)
                        {
                            using (var imgCmd = new MySqlCommand("SELECT file_path FROM media_images WHERE image_id = @cid", conn))
                            {
                                imgCmd.Parameters.AddWithValue("@cid", coverImageId.Value);
                                var imgPath = imgCmd.ExecuteScalar()?.ToString();
                                if (!string.IsNullOrEmpty(imgPath))
                                {
                                    result.PathsToDelete.Add(imgPath);
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
                // STEP 3: Purge from Collections & Delete Media Row
                // ========================================================
                using (var cmdBridge = new MySqlCommand("DELETE FROM collection_items WHERE target_id = @id AND target_type = @type", conn))
                {
                    cmdBridge.Parameters.AddWithValue("@id", mediaId);
                    cmdBridge.Parameters.AddWithValue("@type", mediaType);
                    cmdBridge.ExecuteNonQuery();
                }

                using (var cmdDelete = new MySqlCommand($"DELETE FROM {tableName} WHERE {idColumn} = @id", conn))
                {
                    cmdDelete.Parameters.AddWithValue("@id", mediaId);
                    cmdDelete.ExecuteNonQuery();
                }

                result.Success = true;
                return result;
            }
        }
    }
}
