using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MoozicOrb.IO
{
    public class GetPost
    {
        // 1. GET SINGLE POST
        public PostDto Execute(long postId, int viewerId)
        {
            PostDto post = null;
            string sql = GetBaseSql("WHERE p.post_id = @pid");

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@pid", postId);
                    cmd.Parameters.AddWithValue("@vid", viewerId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        if (rdr.Read()) post = MapReaderToDto(rdr);
                    }
                }
                if (post != null) AttachMediaToPosts(conn, new List<PostDto> { post });
            }
            return post;
        }

        // 2. GET FEED
        public List<PostDto> Execute(string contextType, string contextId, int viewerId, int page = 1, int pageSize = 20)
        {
            var results = new List<PostDto>();
            int offset = (page - 1) * pageSize;
            string sql;

            if (contextType == "user" || contextType == "page_profile")
            {
                sql = GetBaseSql("WHERE p.user_id = @cid ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset");
            }
            else
            {
                sql = GetBaseSql("WHERE p.context_type = @ctype AND p.context_id = @cid ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset");
            }

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@ctype", contextType);
                    cmd.Parameters.AddWithValue("@cid", contextId);
                    cmd.Parameters.AddWithValue("@vid", viewerId);
                    cmd.Parameters.AddWithValue("@limit", pageSize);
                    cmd.Parameters.AddWithValue("@offset", offset);

                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read()) results.Add(MapReaderToDto(rdr));
                    }
                }
                if (results.Count > 0) AttachMediaToPosts(conn, results);
            }
            return results;
        }

        // 3. SOCIAL FEED
        public List<PostDto> GetDiscoveryFeed(int viewerId, int count = 20)
        {
            var results = new List<PostDto>();
            int freshCount = (int)(count * 0.75);
            int vintageCount = count - freshCount;

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // Fresh
                string freshSql = GetBaseSql("WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) ORDER BY RAND() LIMIT @limit");
                using (var cmd = new MySqlCommand(freshSql, conn))
                {
                    cmd.Parameters.AddWithValue("@vid", viewerId);
                    cmd.Parameters.AddWithValue("@limit", freshCount);
                    using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr)); }
                }

                // Vintage
                if (vintageCount > 0)
                {
                    string vintageSql = GetBaseSql("WHERE p.created_at < DATE_SUB(NOW(), INTERVAL 14 DAY) ORDER BY RAND() LIMIT @limit");
                    using (var cmd = new MySqlCommand(vintageSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@vid", viewerId);
                        cmd.Parameters.AddWithValue("@limit", vintageCount);
                        using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr)); }
                    }
                }

                // Fallback
                if (results.Count < count)
                {
                    var existingIds = results.Select(p => p.Id).ToList();
                    string excludeClause = existingIds.Any() ? $"AND p.post_id NOT IN ({string.Join(",", existingIds)})" : "";
                    string fallbackSql = GetBaseSql($"WHERE 1=1 {excludeClause} ORDER BY p.created_at DESC LIMIT @limit");

                    using (var cmd = new MySqlCommand(fallbackSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@vid", viewerId);
                        cmd.Parameters.AddWithValue("@limit", count - results.Count);
                        using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr)); }
                    }
                }

                if (results.Count > 0) AttachMediaToPosts(conn, results);
            }
            return results.OrderBy(x => Guid.NewGuid()).ToList();
        }

        // 4. AUDIO FEED
        public List<PostDto> GetAudioDiscoveryFeed(int viewerId, int count = 20)
        {
            var results = new List<PostDto>();
            string sql = GetBaseSql(@"WHERE EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.post_id AND pm.media_type = 1) ORDER BY RAND() LIMIT @limit");

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@vid", viewerId);
                    cmd.Parameters.AddWithValue("@limit", count);
                    using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr)); }
                }
                if (results.Count > 0) AttachMediaToPosts(conn, results);
            }
            return results;
        }

        // 5. SEARCH
        public List<PostDto> SearchPosts(string term, int viewerId)
        {
            return ExecuteSearch(term, viewerId, "WHERE (p.content_text LIKE @term OR p.title LIKE @term) ORDER BY p.created_at DESC LIMIT 20");
        }

        public List<PostDto> SearchAudio(string term, int viewerId)
        {
            return ExecuteSearch(term, viewerId, "WHERE (p.content_text LIKE @term OR p.title LIKE @term) AND EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.post_id AND pm.media_type = 1) ORDER BY p.created_at DESC LIMIT 20");
        }

        private List<PostDto> ExecuteSearch(string term, int viewerId, string whereClause)
        {
            var results = new List<PostDto>();
            string sql = GetBaseSql(whereClause);
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@term", "%" + term + "%");
                    cmd.Parameters.AddWithValue("@vid", viewerId);
                    using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr)); }
                }
                if (results.Count > 0) AttachMediaToPosts(conn, results);
            }
            return results;
        }

        private string GetBaseSql(string whereClause)
        {
            // Note: Explicitly selecting columns to avoid ambiguity
            return $@"
                SELECT 
                    p.post_id, p.user_id, p.context_type, p.context_id,
                    p.post_type, p.title, p.content_text, p.image_url, p.created_at,
                    p.price, p.location_label, p.difficulty_level, p.video_url, p.media_id, p.category,
                    u.display_name, u.profile_pic,
                    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id) AS likes_count,
                    (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
                    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id AND user_id = @vid) AS is_liked
                FROM posts p
                JOIN `user` u ON p.user_id = u.user_id
                {whereClause}";
        }

        // ==========================================
        // CRITICAL FIX: Media Attachment Logic
        // ==========================================
        private void AttachMediaToPosts(MySqlConnection conn, List<PostDto> posts)
        {
            if (posts == null || posts.Count == 0) return;
            var ids = string.Join(",", posts.Select(p => p.Id));

            // FIX: Uses 'vid.thumb_path' (Schema: thumb_path) instead of 'vid.img_path'
            // FIX: Uses 'aud.snippet_path' (Schema: snippet_path)

            string sql = $@"
                SELECT 
                    pm.post_id, 
                    pm.media_id, 
                    pm.media_type, 
                    pm.sort_order,
                    COALESCE(img.file_path, vid.file_path, aud.file_path) AS final_url,
                    vid.thumb_path AS thumb_url,
                    aud.snippet_path AS snippet_url
                FROM post_media pm
                LEFT JOIN media_images img ON pm.media_id = img.image_id AND pm.media_type = 3
                LEFT JOIN media_video vid ON pm.media_id = vid.video_id AND pm.media_type = 2
                LEFT JOIN media_audio aud ON pm.media_id = aud.audio_id AND pm.media_type = 1
                WHERE pm.post_id IN ({ids}) 
                ORDER BY pm.sort_order ASC";

            using (var cmd = new MySqlCommand(sql, conn))
            {
                using (var rdr = cmd.ExecuteReader())
                {
                    while (rdr.Read())
                    {
                        long pId = rdr.GetInt64("post_id");
                        var post = posts.FirstOrDefault(p => p.Id == pId);
                        if (post != null)
                        {
                            string dbPath = rdr["final_url"] == DBNull.Value ? "" : rdr["final_url"].ToString();
                            if (!string.IsNullOrEmpty(dbPath) && !dbPath.StartsWith("/")) dbPath = "/" + dbPath;

                            // LOGIC: If Video, use thumb_url. If Audio, use snippet_url.
                            string extraPath = null;
                            int type = rdr.GetInt32("media_type");

                            if (type == 2) // Video -> Thumbnail
                            {
                                extraPath = rdr["thumb_url"] == DBNull.Value ? null : rdr["thumb_url"].ToString();
                            }
                            else if (type == 1) // Audio -> Snippet
                            {
                                extraPath = rdr["snippet_url"] == DBNull.Value ? null : rdr["snippet_url"].ToString();
                            }

                            if (!string.IsNullOrEmpty(extraPath) && !extraPath.StartsWith("/")) extraPath = "/" + extraPath;

                            post.Attachments.Add(new MediaAttachmentDto
                            {
                                MediaId = rdr.GetInt64("media_id"),
                                MediaType = type,
                                Url = dbPath,
                                SnippetPath = extraPath // Mapped correctly
                            });
                        }
                    }
                }
            }
        }

        private PostDto MapReaderToDto(MySqlDataReader rdr)
        {
            // FIX: Explicitly treat MySQL datetime as UTC so TimeAgo works correctly
            var createdAt = DateTime.SpecifyKind(rdr.GetDateTime("created_at"), DateTimeKind.Utc);

            return new PostDto
            {
                Id = rdr.GetInt64("post_id"),
                AuthorId = rdr.GetInt32("user_id"),
                AuthorName = rdr["display_name"].ToString(),
                AuthorPic = rdr["profile_pic"] == DBNull.Value ? "/img/profile_default.jpg" : rdr["profile_pic"].ToString(),
                ContextType = rdr["context_type"].ToString(),
                ContextId = rdr["context_id"].ToString(),
                Type = rdr["post_type"].ToString(),
                Title = rdr["title"] == DBNull.Value ? null : rdr["title"].ToString(),
                Text = rdr["content_text"] == DBNull.Value ? null : rdr["content_text"].ToString(),
                ImageUrl = rdr["image_url"] == DBNull.Value ? null : rdr["image_url"].ToString(),

                // UPDATED: Use the specific UTC kind
                CreatedAt = createdAt,

                Price = rdr["price"] == DBNull.Value ? null : (decimal?)rdr.GetDecimal("price"),
                LocationLabel = rdr["location_label"] == DBNull.Value ? null : rdr["location_label"].ToString(),
                DifficultyLevel = rdr["difficulty_level"] == DBNull.Value ? null : rdr["difficulty_level"].ToString(),
                VideoUrl = rdr["video_url"] == DBNull.Value ? null : rdr["video_url"].ToString(),
                LikesCount = Convert.ToInt32(rdr["likes_count"]),
                CommentsCount = Convert.ToInt32(rdr["comments_count"]),
                IsLiked = Convert.ToInt32(rdr["is_liked"]) > 0,

                // UPDATED: Calculate relative time using the UTC object
                CreatedAgo = TimeAgo(createdAt)
            };
        }

        private string TimeAgo(DateTime date)
        {
            var span = DateTime.UtcNow - date;
            if (span.TotalMinutes < 60) return $"{span.Minutes}m ago";
            if (span.TotalHours < 24) return $"{span.Hours}h ago";
            return $"{span.Days}d ago";
        }
    }
}