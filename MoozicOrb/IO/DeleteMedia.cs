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
        public MediaDeletionResult Execute(int userId, long mediaId, int mediaType)
        {
            var result = new MediaDeletionResult();
            string tableName = "";
            string idColumn = "";

            // Route to correct table based on Constants
            switch (mediaType)
            {
                case MarketplaceTargetTypes.AudioTrack:
                    tableName = "media_audio";
                    idColumn = "audio_id";
                    break;
                case MarketplaceTargetTypes.Video:
                    tableName = "media_videos";
                    idColumn = "video_id";
                    break;
                case MarketplaceTargetTypes.Image:
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
                // STEP 1: Verify Ownership, Lock Status, and Extract Keys
                // ========================================================
                // Notice we ask for cover_image_id ONLY if it's an audio track
                string selectSql = mediaType == MarketplaceTargetTypes.AudioTrack
                    ? $@"SELECT is_locked, file_path, snippet_path, storage_provider, cover_image_id 
                         FROM {tableName} WHERE {idColumn} = @id AND user_id = @uid"
                    : $@"SELECT is_locked, file_path, snippet_path, storage_provider 
                         FROM {tableName} WHERE {idColumn} = @id AND user_id = @uid";

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

                        if (reader.GetBoolean("is_locked"))
                        {
                            result.ErrorMessage = "Cannot delete a monetized item that has been sold or locked.";
                            return result;
                        }

                        // Collect paths for cloud deletion
                        if (!reader.IsDBNull(reader.GetOrdinal("file_path")))
                            result.PathsToDelete.Add(reader.GetString("file_path"));

                        if (!reader.IsDBNull(reader.GetOrdinal("snippet_path")))
                            result.PathsToDelete.Add(reader.GetString("snippet_path"));

                        result.StorageProvider = reader.GetInt32("storage_provider");

                        // Extract the Cover Image ID if it has one
                        if (mediaType == MarketplaceTargetTypes.AudioTrack && !reader.IsDBNull(reader.GetOrdinal("cover_image_id")))
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

                        // If this track is the ONLY thing using this image, mark it for Cloudflare deletion
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

                            // Delete the orphan image row
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
