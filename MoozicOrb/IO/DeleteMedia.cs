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

                // STEP 1: Verify Ownership, Lock Status, and get Paths
                string selectSql = $@"
                    SELECT is_locked, relative_path, snippet_path, storage_provider 
                    FROM {tableName} 
                    WHERE {idColumn} = @id AND user_id = @uid";

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
                        if (!reader.IsDBNull(reader.GetOrdinal("relative_path")))
                            result.PathsToDelete.Add(reader.GetString("relative_path"));

                        if (!reader.IsDBNull(reader.GetOrdinal("snippet_path")))
                            result.PathsToDelete.Add(reader.GetString("snippet_path"));

                        result.StorageProvider = reader.GetInt32("storage_provider");
                    }
                }

                // STEP 2: Purge from all Collections/Playlists/Carousels
                using (var cmdBridge = new MySqlCommand("DELETE FROM collection_items WHERE target_id = @id AND target_type = @type", conn))
                {
                    cmdBridge.Parameters.AddWithValue("@id", mediaId);
                    cmdBridge.Parameters.AddWithValue("@type", mediaType);
                    cmdBridge.ExecuteNonQuery();
                }

                // STEP 3: Delete the actual Media Record
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
