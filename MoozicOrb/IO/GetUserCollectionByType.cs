using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetUserCollectionsByType
    {
        public List<ApiCollectionDto> Execute(int userId, int type, bool isOwner)
        {
            var results = new List<ApiCollectionDto>();

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                string sql = @"
                    SELECT 
                        c.*, 
                        img.file_path as cover_url,
                        mo.price
                    FROM collections c 
                    LEFT JOIN media_images img ON c.cover_image_id = img.image_id 
                    LEFT JOIN marketplace_offers mo ON mo.target_id = c.collection_id AND mo.target_type = 0 AND mo.is_active = 1
                    WHERE c.user_id = @uid 
                      AND c.collection_type = @type
                      -- THE FIX: Check c.visibility, not ma.visibility
                      AND (@isOwner = 1 OR IFNULL(c.visibility, 0) = 0)
                    ORDER BY c.created_at DESC";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@type", type);
                    cmd.Parameters.AddWithValue("@isOwner", isOwner ? 1 : 0);

                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            string coverUrl = rdr["cover_url"] == DBNull.Value ? "/img/default_cover.jpg" : rdr["cover_url"].ToString();
                            if (!coverUrl.StartsWith("/") && !coverUrl.StartsWith("http")) coverUrl = "/" + coverUrl;

                            results.Add(new ApiCollectionDto
                            {
                                Id = rdr.GetInt64("collection_id"),
                                UserId = rdr.GetInt32("user_id"),
                                Title = rdr["title"].ToString(),
                                Description = rdr["description"].ToString(),
                                Type = rdr.GetInt32("collection_type"),
                                DisplayContext = rdr["display_context"].ToString(),
                                CoverImageUrl = coverUrl,
                                Visibility = rdr["visibility"] != DBNull.Value ? Convert.ToInt32(rdr["visibility"]) : 0,
                                IsLocked = rdr["is_locked"] != DBNull.Value ? Convert.ToBoolean(rdr["is_locked"]) : false,
                                Price = rdr["price"] != DBNull.Value ? Convert.ToDecimal(rdr["price"]) : (decimal?)null
                            });
                        }
                    }
                }
            }
            return results;
        }
    }
}