using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetVaultImagesLight
    {
        public List<PostDto> Execute(int targetUserId, int viewerId, bool onlyUnassigned, IMediaResolverService resolver)
        {
            var images = new List<PostDto>();
            bool isOwner = (targetUserId == viewerId);

            using (MySqlConnection conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // Base Query: Join Posts to PostMedia
                string sql = @"
                    SELECT 
                        p.id, 
                        p.visibility, 
                        p.likes_count, 
                        p.comments_count, 
                        p.created_at,
                        pm.url,
                        pm.media_id,
                        p.title,
                        mo.price
                    FROM posts p
                    INNER JOIN post_media pm ON p.id = pm.post_id
                    LEFT JOIN marketplace_offers mo ON p.id = mo.target_id AND mo.target_type = 3";

                // If we only want loose images, ensure the post ID is NOT in collection_items
                if (onlyUnassigned)
                {
                    sql += " LEFT JOIN collection_items ci ON p.id = ci.target_id AND ci.target_type = 3 WHERE ci.id IS NULL AND p.author_id = @TargetId AND p.type = 7";
                }
                else
                {
                    sql += " WHERE p.author_id = @TargetId AND p.type = 7";
                }

                // Security: If not owner, ONLY show public (0)
                if (!isOwner)
                {
                    sql += " AND p.visibility = 0";
                }

                sql += " ORDER BY p.created_at DESC LIMIT 150;";

                using (MySqlCommand cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@TargetId", targetUserId);

                    using (MySqlDataReader rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            var dto = new PostDto
                            {
                                Id = Convert.ToInt64(rdr["id"]),
                                Visibility = Convert.ToInt32(rdr["visibility"]),
                                LikesCount = Convert.ToInt32(rdr["likes_count"]),
                                CommentsCount = Convert.ToInt32(rdr["comments_count"]),
                                CreatedAt = Convert.ToDateTime(rdr["created_at"]),
                                Title = rdr["title"] != DBNull.Value ? rdr["title"].ToString() : "",
                                Price = rdr["price"] != DBNull.Value ? Convert.ToDecimal(rdr["price"]) : (decimal?)null,
                                Attachments = new List<MediaAttachmentDto>
                                {
                                    new MediaAttachmentDto
                                    {
                                        MediaId = Convert.ToInt64(rdr["media_id"]),
                                        MediaType = 3,
                                        Url = resolver.ResolveUrl(rdr["url"].ToString(), 3)
                                    }
                                }
                            };
                            images.Add(dto);
                        }
                    }
                }
            }
            return images;
        }
    }
}