using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetCollectionDetails
    {
        public CollectionDto Execute(long collectionId, IMediaResolverService resolver = null)
        {
            CollectionDto collection = null;

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                string sqlCol = "SELECT * FROM collections WHERE collection_id = @cid";
                using (var cmd = new MySqlCommand(sqlCol, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        if (rdr.Read())
                        {
                            collection = new CollectionDto
                            {
                                Id = rdr.GetInt64("collection_id"),
                                Title = rdr["title"].ToString(),
                                Type = rdr.GetInt32("collection_type"),
                                DisplayContext = rdr["display_context"].ToString(),
                                Items = new List<CollectionItemDto>()
                            };
                        }
                    }
                }

                if (collection == null) return null;

                string sqlItems = "SELECT link_id, target_id, target_type FROM collection_items WHERE collection_id = @cid ORDER BY sort_order ASC";
                using (var cmd = new MySqlCommand(sqlItems, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            collection.Items.Add(new CollectionItemDto
                            {
                                LinkId = rdr.GetInt64("link_id"),
                                TargetId = rdr.GetInt64("target_id"),
                                TargetType = rdr.GetInt32("target_type")
                            });
                        }
                    }
                }

                if (collection.Items.Count > 0)
                {
                    foreach (var item in collection.Items)
                    {
                        string hydrateSql = "";

                        if (item.TargetType == 1) // Audio
                        {
                            hydrateSql = @"SELECT ma.file_path, ma.title AS media_title, ma.storage_provider, p.image_url, u.display_name, u.profile_pic, p.title AS post_title 
                                           FROM media_audio ma 
                                           LEFT JOIN post_media pm ON ma.audio_id = pm.media_id AND pm.media_type = 1 
                                           LEFT JOIN posts p ON pm.post_id = p.post_id 
                                           LEFT JOIN `user` u ON p.user_id = u.user_id 
                                           WHERE ma.audio_id = @tid LIMIT 1";
                        }
                        else if (item.TargetType == 2) // Video
                        {
                            hydrateSql = @"SELECT mv.file_path, p.title AS media_title, mv.storage_provider, p.image_url, u.display_name, u.profile_pic, p.title AS post_title 
                                           FROM media_video mv 
                                           LEFT JOIN post_media pm ON mv.video_id = pm.media_id AND pm.media_type = 2 
                                           LEFT JOIN posts p ON pm.post_id = p.post_id 
                                           LEFT JOIN `user` u ON p.user_id = u.user_id 
                                           WHERE mv.video_id = @tid LIMIT 1";
                        }
                        else if (item.TargetType == 3) // Image
                        {
                            hydrateSql = @"SELECT mi.file_path, p.title AS media_title, mi.storage_provider, p.image_url, u.display_name, u.profile_pic, p.title AS post_title 
                                           FROM media_images mi 
                                           LEFT JOIN post_media pm ON mi.image_id = pm.media_id AND pm.media_type = 3 
                                           LEFT JOIN posts p ON pm.post_id = p.post_id 
                                           LEFT JOIN `user` u ON p.user_id = u.user_id 
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

                                        // --- FIX: PRIORITIZE POST TITLE FIRST ---
                                        if (!string.IsNullOrEmpty(titleFromPost))
                                        {
                                            item.Title = titleFromPost;
                                        }
                                        else if (!string.IsNullOrEmpty(titleFromMedia))
                                        {
                                            // Fallback: Use media title, but strip ugly extensions like .mp3 or .jpg
                                            item.Title = System.IO.Path.GetFileNameWithoutExtension(titleFromMedia);
                                        }
                                        else
                                        {
                                            item.Title = "Unknown Track";
                                        }

                                        item.ArtistName = rdr["display_name"] == DBNull.Value ? "Unknown Artist" : rdr["display_name"].ToString();

                                        // LOCAL RESOLVER HELPER
                                        string ResolveSafely(string inputUrl)
                                        {
                                            if (string.IsNullOrEmpty(inputUrl) || inputUrl == "null") return null;
                                            if (inputUrl.StartsWith("/") || inputUrl.StartsWith("http")) return inputUrl;
                                            return resolver != null ? resolver.ResolveUrl(inputUrl, 1) : inputUrl;
                                        }

                                        // SMART FALLBACK LOGIC (RESOLVED)
                                        string postImg = rdr["image_url"] == DBNull.Value ? null : rdr["image_url"].ToString();
                                        string profPic = rdr["profile_pic"] == DBNull.Value ? null : rdr["profile_pic"].ToString();

                                        string finalPostImg = ResolveSafely(postImg);
                                        string finalProfPic = ResolveSafely(profPic);

                                        if (!string.IsNullOrEmpty(finalPostImg))
                                        {
                                            item.ArtUrl = finalPostImg;
                                        }
                                        else if (!string.IsNullOrEmpty(finalProfPic))
                                        {
                                            item.ArtUrl = finalProfPic;
                                        }
                                        else
                                        {
                                            item.ArtUrl = ""; // Empty string tells the JS to use the Generic Icon
                                        }

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