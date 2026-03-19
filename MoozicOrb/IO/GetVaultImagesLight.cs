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

                // 1. Join to media_images (img) using image_id and file_path
                // 2. Use post_id and user_id to match the posts table
                // 3. Use subqueries for likes and comments exactly like GetPost.cs
                string sql = @"
                    SELECT 
                        p.post_id, 
                        p.visibility, 
                        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.post_id) AS likes_count, 
                        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.post_id) AS comments_count, 
                        (SELECT COUNT(*) FROM post_likes pl2 WHERE pl2.post_id = p.post_id AND pl2.user_id = @ViewerId) AS is_liked,
                        p.created_at,
                        img.file_path AS url,
                        pm.media_id,
                        p.title,
                        mo.price
                    FROM posts p
                    INNER JOIN post_media pm ON p.post_id = pm.post_id
                    INNER JOIN media_images img ON pm.media_id = img.image_id AND pm.media_type = 3
                    LEFT JOIN marketplace_offers mo ON p.post_id = mo.target_id AND mo.target_type = 3";

                // Filter for unassigned images (not in a gallery)
                if (onlyUnassigned)
                {
                    sql += " LEFT JOIN collection_items ci ON p.post_id = ci.target_id AND ci.target_type = 3 WHERE ci.target_id IS NULL AND p.user_id = @TargetId";
                }
                else
                {
                    sql += " WHERE p.user_id = @TargetId";
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
                    cmd.Parameters.AddWithValue("@ViewerId", viewerId);

                    using (MySqlDataReader rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            var dto = new PostDto
                            {
                                Id = Convert.ToInt64(rdr["post_id"]),
                                Visibility = Convert.ToInt32(rdr["visibility"]),
                                LikesCount = Convert.ToInt32(rdr["likes_count"]),
                                CommentsCount = Convert.ToInt32(rdr["comments_count"]),
                                IsLiked = Convert.ToInt32(rdr["is_liked"]) > 0,
                                CreatedAt = DateTime.SpecifyKind(rdr.GetDateTime("created_at"), DateTimeKind.Utc),
                                Title = rdr["title"] != DBNull.Value ? rdr["title"].ToString() : "",
                                Price = rdr["price"] != DBNull.Value ? Convert.ToDecimal(rdr["price"]) : (decimal?)null,
                                Attachments = new List<MediaAttachmentDto>
                                {
                                    new MediaAttachmentDto
                                    {
                                        MediaId = Convert.ToInt64(rdr["media_id"]),
                                        MediaType = 3,
                                        // Resolve the file_path into a full URL using your resolver service
                                        Url = resolver != null ? resolver.ResolveUrl(rdr["url"].ToString(), 3) : rdr["url"].ToString()
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