using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetUserAudioCollection
    {
        public ApiCollectionDto Execute(int userId, IMediaResolverService resolver = null)
        {
            var collection = new ApiCollectionDto
            {
                Id = -1,
                UserId = userId,
                Title = "Discography",
                Description = "All audio uploads",
                Type = 2,
                DisplayContext = "Fallback",
                CoverImageId = 0,
                CoverImageUrl = "/img/default_cover.jpg", // FIXED: Parent uses CoverImageUrl
                Items = new List<ApiCollectionItemDto>()
            };

            string sql = @"
                SELECT 
                    pm.media_id, 
                    ma.title AS song_title, 
                    ma.file_path, 
                    p.image_url AS post_art,
                    p.title AS post_title,
                    u.display_name,
                    ma.storage_provider
                FROM posts p
                JOIN post_media pm ON p.post_id = pm.post_id
                JOIN media_audio ma ON pm.media_id = ma.audio_id
                JOIN user u ON p.user_id = u.user_id
                WHERE p.user_id = @uid 
                  AND pm.media_type = 1 
                ORDER BY p.created_at DESC LIMIT 10";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            string art = rdr["post_art"]?.ToString();
                            string rawPath = rdr["file_path"]?.ToString();

                            int storageProv = rdr["storage_provider"] == DBNull.Value ? 0 : Convert.ToInt32(rdr["storage_provider"]);

                            if (resolver != null && storageProv == 1)
                            {
                                rawPath = resolver.ResolveUrl(rawPath, 1);
                                if (!string.IsNullOrEmpty(art) && !art.StartsWith("/") && !art.StartsWith("http"))
                                {
                                    art = resolver.ResolveUrl(art, 1);
                                }
                            }
                            else if (!string.IsNullOrEmpty(rawPath) && !rawPath.StartsWith("/") && !rawPath.StartsWith("http"))
                            {
                                rawPath = "/" + rawPath;
                            }

                            // FIXED: Check and assign against CoverImageUrl
                            if (collection.CoverImageUrl == "/img/default_cover.jpg" && !string.IsNullOrEmpty(art))
                                collection.CoverImageUrl = art;

                            collection.Items.Add(new ApiCollectionItemDto
                            {
                                TargetId = rdr.GetInt64("media_id"),
                                TargetType = 1,
                                Title = !string.IsNullOrEmpty(rdr["song_title"]?.ToString()) ? rdr["song_title"].ToString() : rdr["post_title"]?.ToString(),
                                Url = rawPath,
                                ArtUrl = art, // Tracks use ArtUrl
                                ArtistName = rdr["display_name"]?.ToString()
                            });
                        }
                    }
                }
            }
            return collection;
        }
    }
}