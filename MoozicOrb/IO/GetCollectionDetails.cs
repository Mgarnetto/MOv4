using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetCollectionDetails
    {
        public ApiCollectionDto Execute(long collectionId, IMediaResolverService resolver = null)
        {
            ApiCollectionDto collection = null;

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // 1. Get Top-Level Collection
                string sqlCol = "SELECT * FROM collections WHERE collection_id = @cid";
                using (var cmd = new MySqlCommand(sqlCol, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        if (rdr.Read())
                        {
                            collection = new ApiCollectionDto
                            {
                                Id = rdr.GetInt64("collection_id"),
                                Title = rdr["title"].ToString(),
                                Type = rdr.GetInt32("collection_type"),
                                DisplayContext = rdr["display_context"].ToString(),
                                Items = new List<ApiCollectionItemDto>()
                            };
                        }
                    }
                }

                if (collection == null) return null;

                // 2. Get the array of IDs inside the collection
                string sqlItems = "SELECT link_id, target_id, target_type FROM collection_items WHERE collection_id = @cid ORDER BY sort_order ASC";
                using (var cmd = new MySqlCommand(sqlItems, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            collection.Items.Add(new ApiCollectionItemDto
                            {
                                LinkId = rdr.GetInt64("link_id"),
                                TargetId = rdr.GetInt64("target_id"),
                                TargetType = rdr.GetInt32("target_type")
                            });
                        }
                    }
                }

                // 3. Hydrate the items with deep data
                if (collection.Items.Count > 0)
                {
                    foreach (var item in collection.Items)
                    {
                        string hydrateSql = "";

                        if (item.TargetType == 0) // Albums
                        {
                            hydrateSql = @"SELECT NULL AS file_path, c.title AS media_title, 0 AS storage_provider, 
                                           mi.file_path AS image_url, mi.storage_provider AS img_storage_provider, 
                                           u.display_name, u.profile_pic, NULL AS post_title, mo.price 
                                           FROM collections c 
                                           LEFT JOIN `user` u ON c.user_id = u.user_id 
                                           LEFT JOIN media_images mi ON c.cover_image_id = mi.image_id 
                                           LEFT JOIN marketplace_offers mo ON mo.target_id = c.collection_id AND mo.target_type = 0 AND mo.is_active = 1 
                                           WHERE c.collection_id = @tid LIMIT 1";
                        }
                        else if (item.TargetType == 1) // Audio
                        {
                            hydrateSql = @"SELECT ma.file_path, ma.title AS media_title, ma.storage_provider, 
                                           0 AS img_storage_provider, p.image_url, u.display_name, u.profile_pic, p.title AS post_title, mo.price 
                                           FROM media_audio ma 
                                           LEFT JOIN post_media pm ON ma.audio_id = pm.media_id AND pm.media_type = 1 
                                           LEFT JOIN posts p ON pm.post_id = p.post_id 
                                           LEFT JOIN `user` u ON ma.user_id = u.user_id 
                                           LEFT JOIN marketplace_offers mo ON mo.target_id = ma.audio_id AND mo.target_type = 1 AND mo.is_active = 1
                                           WHERE ma.audio_id = @tid LIMIT 1";
                        }
                        else if (item.TargetType == 2) // Video
                        {
                            hydrateSql = @"SELECT mv.file_path, p.title AS media_title, mv.storage_provider, 
                                           0 AS img_storage_provider, p.image_url, u.display_name, u.profile_pic, p.title AS post_title, mo.price 
                                           FROM media_video mv 
                                           LEFT JOIN post_media pm ON mv.video_id = pm.media_id AND pm.media_type = 2 
                                           LEFT JOIN posts p ON pm.post_id = p.post_id 
                                           LEFT JOIN `user` u ON mv.user_id = u.user_id 
                                           LEFT JOIN marketplace_offers mo ON mo.target_id = mv.video_id AND mo.target_type = 2 AND mo.is_active = 1
                                           WHERE mv.video_id = @tid LIMIT 1";
                        }
                        else if (item.TargetType == 3) // Image
                        {
                            hydrateSql = @"SELECT mi.file_path, p.title AS media_title, mi.storage_provider, 
                                           0 AS img_storage_provider, p.image_url, u.display_name, u.profile_pic, p.title AS post_title, mo.price 
                                           FROM media_images mi 
                                           LEFT JOIN post_media pm ON mi.image_id = pm.media_id AND pm.media_type = 3 
                                           LEFT JOIN posts p ON pm.post_id = p.post_id 
                                           LEFT JOIN `user` u ON mi.user_id = u.user_id 
                                           LEFT JOIN marketplace_offers mo ON mo.target_id = mi.image_id AND mo.target_type = 3 AND mo.is_active = 1
                                           WHERE mi.image_id = @tid LIMIT 1";
                        }

                        if (!string.IsNullOrEmpty(hydrateSql))
                        {
                            using (var cmd = new MySqlCommand(hydrateSql, conn))
                            {
                                cmd.Parameters.AddWithValue("@tid", item.TargetId);
                                using (var rdr = cmd.ExecuteReader())
                                {
                                    if (rdr.Read())
                                    {
                                        string titleFromMedia = rdr["media_title"] == DBNull.Value ? null : rdr["media_title"].ToString();
                                        string titleFromPost = rdr["post_title"] == DBNull.Value ? null : rdr["post_title"].ToString();

                                        // Prioritize the custom metadata title
                                        if (!string.IsNullOrEmpty(titleFromMedia))
                                        {
                                            item.Title = titleFromMedia;
                                            if (item.Title.EndsWith(".mp3") || item.Title.EndsWith(".wav"))
                                                item.Title = System.IO.Path.GetFileNameWithoutExtension(item.Title);
                                        }
                                        else if (!string.IsNullOrEmpty(titleFromPost))
                                        {
                                            item.Title = titleFromPost;
                                        }
                                        else
                                        {
                                            item.Title = "Untitled Track";
                                        }

                                        item.ArtistName = rdr["display_name"] == DBNull.Value ? "Unknown Artist" : rdr["display_name"].ToString();
                                        item.Price = rdr["price"] != DBNull.Value ? Convert.ToDecimal(rdr["price"]) : (decimal?)null;

                                        // ===============================================
                                        // THE FIX: RESTORED RESOLVER HELPER
                                        // ===============================================
                                        string ResolveSafely(string inputUrl, bool isCloud)
                                        {
                                            if (string.IsNullOrEmpty(inputUrl) || inputUrl == "null") return null;
                                            if (inputUrl.StartsWith("/") || inputUrl.StartsWith("http")) return inputUrl;

                                            // Pass to Cloudflare/S3 resolver if flagged as cloud
                                            if (resolver != null && isCloud) return resolver.ResolveUrl(inputUrl, 1);

                                            return "/" + inputUrl;
                                        }

                                        string postImg = rdr["image_url"] == DBNull.Value ? null : rdr["image_url"].ToString();
                                        string profPic = rdr["profile_pic"] == DBNull.Value ? null : rdr["profile_pic"].ToString();
                                        int imgProv = rdr["img_storage_provider"] == DBNull.Value ? 0 : Convert.ToInt32(rdr["img_storage_provider"]);

                                        if (item.TargetType == 0) // Album explicitly checks img_storage_provider
                                        {
                                            item.ArtUrl = ResolveSafely(postImg, imgProv == 1) ?? "";
                                        }
                                        else // Audio/Video/Singles fallback
                                        {
                                            // We explicitly pass 'true' here because profile pics and post images lacking a leading slash are almost exclusively S3 keys
                                            string finalPostImg = ResolveSafely(postImg, true);
                                            string finalProfPic = ResolveSafely(profPic, true);

                                            if (!string.IsNullOrEmpty(finalPostImg)) item.ArtUrl = finalPostImg;
                                            else if (!string.IsNullOrEmpty(finalProfPic)) item.ArtUrl = finalProfPic;
                                            else item.ArtUrl = "";
                                        }

                                        // RESOLVE MEDIA PATH
                                        string rawPath = rdr["file_path"] == DBNull.Value ? "" : rdr["file_path"].ToString();
                                        int storageProv = rdr["storage_provider"] == DBNull.Value ? 0 : Convert.ToInt32(rdr["storage_provider"]);

                                        if (resolver != null && storageProv == 1 && !string.IsNullOrEmpty(rawPath))
                                        {
                                            item.Url = resolver.ResolveUrl(rawPath, 1);
                                        }
                                        else if (!string.IsNullOrEmpty(rawPath) && !rawPath.StartsWith("/") && !rawPath.StartsWith("http"))
                                        {
                                            item.Url = "/" + rawPath;
                                        }
                                        else
                                        {
                                            item.Url = rawPath;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return collection;
        }
    }
}