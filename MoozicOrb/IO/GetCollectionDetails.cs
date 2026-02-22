using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetCollectionDetails
    {
        public CollectionDto Execute(long collectionId)
        {
            CollectionDto collection = null;

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // 1. Fetch Header & Cover Art URL
                string sqlCol = @"
                    SELECT c.*, img.file_path as cover_url 
                    FROM collections c 
                    LEFT JOIN media_images img ON c.cover_image_id = img.image_id 
                    WHERE c.collection_id = @cid";

                using (var cmd = new MySqlCommand(sqlCol, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        if (rdr.Read())
                        {
                            string coverUrl = rdr["cover_url"] == DBNull.Value ? "/img/default_cover.jpg" : rdr["cover_url"].ToString();
                            if (!coverUrl.StartsWith("/")) coverUrl = "/" + coverUrl;

                            collection = new CollectionDto
                            {
                                Id = rdr.GetInt64("collection_id"),
                                Title = rdr["title"].ToString(),
                                Description = rdr["description"].ToString(),
                                Type = rdr.GetInt32("collection_type"),
                                DisplayContext = rdr["display_context"].ToString(),
                                CoverImageId = rdr["cover_image_id"] == DBNull.Value ? 0 : rdr.GetInt64("cover_image_id"),
                                CoverImageUrl = coverUrl,
                                Items = new List<CollectionItemDto>()
                            };
                        }
                    }
                }

                if (collection == null) return null;

                // 2. Resolve Items based on Target Type
                // 1=Audio, 2=Video, 3=Image, 4=Post, 5=SubCollection
                string sqlItems = @"
                    SELECT 
                        ci.target_id, ci.target_type, ci.sort_order,
                        COALESCE(aud.file_name, vid.file_name, img.file_name, p.title, sub_c.title, 'Untitled Item') AS resolved_title,
                        COALESCE(aud.file_path, vid.file_path, img.file_path, p.video_url, '') AS resolved_url
                    FROM collection_items ci
                    LEFT JOIN media_audio aud ON ci.target_id = aud.audio_id AND ci.target_type = 1
                    LEFT JOIN media_video vid ON ci.target_id = vid.video_id AND ci.target_type = 2
                    LEFT JOIN media_images img ON ci.target_id = img.image_id AND ci.target_type = 3
                    LEFT JOIN posts p ON ci.target_id = p.post_id AND ci.target_type = 4
                    LEFT JOIN collections sub_c ON ci.target_id = sub_c.collection_id AND ci.target_type = 5
                    WHERE ci.collection_id = @cid
                    ORDER BY ci.sort_order ASC";

                using (var cmd = new MySqlCommand(sqlItems, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            string url = rdr["resolved_url"].ToString();
                            if (!string.IsNullOrEmpty(url) && !url.StartsWith("/") && !url.StartsWith("http")) url = "/" + url;

                            collection.Items.Add(new CollectionItemDto
                            {
                                TargetId = rdr.GetInt64("target_id"),
                                TargetType = rdr.GetInt32("target_type"),
                                Title = rdr["resolved_title"].ToString(),
                                Url = url
                            });
                        }
                    }
                }
            }
            return collection;
        }
    }
}