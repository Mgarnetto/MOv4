using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetOrphanedAudio
    {
        public ApiCollectionDto Execute(int userId, bool isOwner, IMediaResolverService resolver = null)
        {
            var collection = new ApiCollectionDto
            {
                Id = -2,
                UserId = userId,
                Title = "All Uploads",
                Type = 1,
                Items = new List<ApiCollectionItemDto>()
            };

            string sql = @"
                SELECT 
                    ma.audio_id AS media_id, 
                    ma.title AS song_title, 
                    ma.file_path, 
                    u.display_name,
                    ma.storage_provider,
                    ma.visibility,
                    ma.is_locked,
                    mo.price
                FROM media_audio ma
                JOIN user u ON ma.user_id = u.user_id
                LEFT JOIN marketplace_offers mo ON mo.target_id = ma.audio_id AND mo.target_type = 1 AND mo.is_active = 1
                WHERE ma.user_id = @uid 
                      -- THE FIX: Only one visibility check here at the top level
                      AND (@isOwner = 1 OR IFNULL(ma.visibility, 0) = 0)
                      AND ma.audio_id NOT IN (
                          SELECT ci.target_id 
                          FROM collection_items ci
                          JOIN collections c ON ci.collection_id = c.collection_id
                          WHERE ci.target_type = 1 AND c.collection_type = 2
                      )
                ORDER BY ma.created_at DESC";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@isOwner", isOwner ? 1 : 0);

                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            string rawPath = rdr["file_path"]?.ToString();
                            int storageProv = rdr["storage_provider"] == DBNull.Value ? 0 : Convert.ToInt32(rdr["storage_provider"]);

                            if (resolver != null && storageProv == 1)
                            {
                                rawPath = resolver.ResolveUrl(rawPath, 1);
                            }
                            else if (!string.IsNullOrEmpty(rawPath) && !rawPath.StartsWith("/") && !rawPath.StartsWith("http"))
                            {
                                rawPath = "/" + rawPath;
                            }

                            collection.Items.Add(new ApiCollectionItemDto
                            {
                                TargetId = rdr.GetInt64("media_id"),
                                TargetType = 1,
                                Title = rdr["song_title"]?.ToString() ?? "Untitled Track",
                                Url = rawPath,
                                ArtUrl = null,
                                ArtistName = rdr["display_name"]?.ToString(),
                                Visibility = rdr["visibility"] != DBNull.Value ? Convert.ToInt32(rdr["visibility"]) : 0,
                                IsLocked = rdr["is_locked"] != DBNull.Value ? Convert.ToBoolean(rdr["is_locked"]) : false,
                                Price = rdr["price"] != DBNull.Value ? Convert.ToDecimal(rdr["price"]) : (decimal?)null
                            });
                        }
                    }
                }
            }
            return collection;
        }
    }
}