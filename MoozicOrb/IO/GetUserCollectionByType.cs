using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetUserCollectionsByType
    {
        public List<ApiCollectionDto> Execute(int userId, int type)
        {
            var results = new List<ApiCollectionDto>();

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                string sql = @"
                    SELECT c.*, img.file_path as cover_url 
                    FROM collections c 
                    LEFT JOIN media_images img ON c.cover_image_id = img.image_id 
                    WHERE c.user_id = @uid AND c.collection_type = @type
                    ORDER BY c.created_at DESC";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@type", type);

                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            string coverUrl = rdr["cover_url"] == DBNull.Value ? "/img/default_cover.jpg" : rdr["cover_url"].ToString();

                            // Safe local fallback check
                            if (!coverUrl.StartsWith("/") && !coverUrl.StartsWith("http"))
                            {
                                coverUrl = "/" + coverUrl;
                            }

                            results.Add(new ApiCollectionDto
                            {
                                Id = rdr.GetInt64("collection_id"),
                                UserId = rdr.GetInt32("user_id"),
                                Title = rdr["title"].ToString(),
                                Description = rdr["description"].ToString(),
                                Type = rdr.GetInt32("collection_type"),
                                DisplayContext = rdr["display_context"].ToString(),
                                CoverImageUrl = coverUrl
                            });
                        }
                    }
                }
            }
            return results;
        }
    }
}