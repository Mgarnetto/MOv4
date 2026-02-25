using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MoozicOrb.IO
{
    public class GetPost
    {
        // HELPER: Safely resolve Cloudflare URLs while ignoring local paths
        private string SafeResolve(string urlOrKey, IMediaResolverService resolver)
        {
            if (string.IsNullOrEmpty(urlOrKey) || urlOrKey == "null") return null;
            if (urlOrKey.StartsWith("/") || urlOrKey.StartsWith("http")) return urlOrKey;
            return resolver != null ? resolver.ResolveUrl(urlOrKey, 1) : urlOrKey;
        }

        // 1. GET SINGLE POST
        public PostDto Execute(long postId, int viewerId, IMediaResolverService resolver = null)
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
                        // PASSED RESOLVER
                        if (rdr.Read()) post = MapReaderToDto(rdr, resolver);
                    }
                }
                if (post != null) AttachMediaToPosts(conn, new List<PostDto> { post }, resolver);
            }
            return post;
        }

        // 2. GET FEED
        public List<PostDto> Execute(string contextType, string contextId, int viewerId, int page = 1, int pageSize = 20, string postType = null, int? mediaType = null, IMediaResolverService resolver = null)
        {
            var results = new List<PostDto>();
            int offset = (page - 1) * pageSize;
            string sql;

            string typeFilter = string.IsNullOrEmpty(postType) ? "" : " AND p.post_type = @postType";
            string mediaFilter = "";

            if (mediaType.HasValue)
            {
                mediaFilter = " AND EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.post_id AND pm.media_type = @mediaType)";

                if (string.IsNullOrEmpty(postType))
                {
                    mediaFilter += " AND p.post_type != 'merch'";
                }
            }

            if (contextType == "user" || contextType == "page_profile")
            {
                sql = GetBaseSql($"WHERE p.user_id = @cid{typeFilter}{mediaFilter} ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset");
            }
            else
            {
                sql = GetBaseSql($"WHERE p.context_type = @ctype AND p.context_id = @cid{typeFilter}{mediaFilter} ORDER BY p.created_at DESC LIMIT @limit OFFSET @offset");
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

                    if (!string.IsNullOrEmpty(postType))
                    {
                        cmd.Parameters.AddWithValue("@postType", postType);
                    }

                    if (mediaType.HasValue)
                    {
                        cmd.Parameters.AddWithValue("@mediaType", mediaType.Value);
                    }

                    using (var rdr = cmd.ExecuteReader())
                    {
                        // PASSED RESOLVER
                        while (rdr.Read()) results.Add(MapReaderToDto(rdr, resolver));
                    }
                }
                if (results.Count > 0) AttachMediaToPosts(conn, results, resolver);
            }
            return results;
        }

        // 3. SOCIAL FEED
        public List<PostDto> GetDiscoveryFeed(int viewerId, int count = 20, IMediaResolverService resolver = null)
        {
            var results = new List<PostDto>();
            int freshCount = (int)(count * 0.75);
            int vintageCount = count - freshCount;

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                string freshSql = GetBaseSql("WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) ORDER BY RAND() LIMIT @limit");
                using (var cmd = new MySqlCommand(freshSql, conn))
                {
                    cmd.Parameters.AddWithValue("@vid", viewerId);
                    cmd.Parameters.AddWithValue("@limit", freshCount);
                    // PASSED RESOLVER
                    using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr, resolver)); }
                }

                if (vintageCount > 0)
                {
                    string vintageSql = GetBaseSql("WHERE p.created_at < DATE_SUB(NOW(), INTERVAL 14 DAY) ORDER BY RAND() LIMIT @limit");
                    using (var cmd = new MySqlCommand(vintageSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@vid", viewerId);
                        cmd.Parameters.AddWithValue("@limit", vintageCount);
                        // PASSED RESOLVER
                        using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr, resolver)); }
                    }
                }

                if (results.Count < count)
                {
                    var existingIds = results.Select(p => p.Id).ToList();
                    string excludeClause = existingIds.Any() ? $"AND p.post_id NOT IN ({string.Join(",", existingIds)})" : "";
                    string fallbackSql = GetBaseSql($"WHERE 1=1 {excludeClause} ORDER BY p.created_at DESC LIMIT @limit");

                    using (var cmd = new MySqlCommand(fallbackSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@vid", viewerId);
                        cmd.Parameters.AddWithValue("@limit", count - results.Count);
                        // PASSED RESOLVER
                        using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr, resolver)); }
                    }
                }

                if (results.Count > 0) AttachMediaToPosts(conn, results, resolver);
            }
            return results.OrderBy(x => Guid.NewGuid()).ToList();
        }

        // 4. AUDIO FEED
        public List<PostDto> GetAudioDiscoveryFeed(int viewerId, int count = 20, IMediaResolverService resolver = null)
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
                    // PASSED RESOLVER
                    using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr, resolver)); }
                }
                if (results.Count > 0) AttachMediaToPosts(conn, results, resolver);
            }
            return results;
        }

        // 5. SEARCH
        public List<PostDto> SearchPosts(string term, int viewerId, IMediaResolverService resolver = null)
        {
            return ExecuteSearch(term, viewerId, "WHERE (p.content_text LIKE @term OR p.title LIKE @term) ORDER BY p.created_at DESC LIMIT 20", resolver);
        }

        public List<PostDto> SearchAudio(string term, int viewerId, IMediaResolverService resolver = null)
        {
            return ExecuteSearch(term, viewerId, "WHERE (p.content_text LIKE @term OR p.title LIKE @term) AND EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.post_id AND pm.media_type = 1) ORDER BY p.created_at DESC LIMIT 20", resolver);
        }

        private List<PostDto> ExecuteSearch(string term, int viewerId, string whereClause, IMediaResolverService resolver = null)
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
                    // PASSED RESOLVER
                    using (var rdr = cmd.ExecuteReader()) { while (rdr.Read()) results.Add(MapReaderToDto(rdr, resolver)); }
                }
                if (results.Count > 0) AttachMediaToPosts(conn, results, resolver);
            }
            return results;
        }

        private string GetBaseSql(string whereClause)
        {
            return $@"
                SELECT 
                    p.post_id, p.user_id, p.context_type, p.context_id,
                    p.post_type, p.title, p.content_text, p.image_url, p.created_at,
                    p.price, p.quantity, p.location_label, p.difficulty_level, p.video_url, p.media_id, p.category,
                    u.display_name, u.profile_pic,
                    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id) AS likes_count,
                    (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
                    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.post_id AND user_id = @vid) AS is_liked
                FROM posts p
                JOIN `user` u ON p.user_id = u.user_id
                {whereClause}";
        }

        private void AttachMediaToPosts(MySqlConnection conn, List<PostDto> posts, IMediaResolverService resolver = null)
        {
            if (posts == null || posts.Count == 0) return;
            var ids = string.Join(",", posts.Select(p => p.Id));

            string sql = $@"
                SELECT 
                    pm.post_id, 
                    pm.media_id, 
                    pm.media_type, 
                    pm.sort_order,
                    COALESCE(img.file_path, vid.file_path, aud.file_path) AS final_url,
                    vid.thumb_path AS thumb_url,
                    aud.snippet_path AS snippet_url,
                    COALESCE(img.storage_provider, vid.storage_provider, aud.storage_provider) AS storage_provider
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
                            int storageProv = rdr["storage_provider"] == DBNull.Value ? 0 : Convert.ToInt32(rdr["storage_provider"]);

                            string dbPath = rdr["final_url"] == DBNull.Value ? "" : rdr["final_url"].ToString();
                            string extraPath = null;
                            int type = rdr.GetInt32("media_type");

                            if (type == 2)
                            {
                                extraPath = rdr["thumb_url"] == DBNull.Value ? null : rdr["thumb_url"].ToString();
                            }
                            else if (type == 1)
                            {
                                extraPath = rdr["snippet_url"] == DBNull.Value ? null : rdr["snippet_url"].ToString();
                            }

                            if (resolver != null && storageProv == 1)
                            {
                                dbPath = resolver.ResolveUrl(dbPath, 1);
                                if (!string.IsNullOrEmpty(extraPath))
                                {
                                    extraPath = resolver.ResolveUrl(extraPath, 1);
                                }
                            }
                            else
                            {
                                if (!string.IsNullOrEmpty(dbPath) && !dbPath.StartsWith("/") && !dbPath.StartsWith("http")) dbPath = "/" + dbPath;
                                if (!string.IsNullOrEmpty(extraPath) && !extraPath.StartsWith("/") && !extraPath.StartsWith("http")) extraPath = "/" + extraPath;
                            }

                            post.Attachments.Add(new MediaAttachmentDto
                            {
                                MediaId = rdr.GetInt64("media_id"),
                                MediaType = type,
                                Url = dbPath,
                                SnippetPath = extraPath
                            });
                        }
                    }
                }
            }
        }

        // PASSED RESOLVER TO DTO MAPPER
        private PostDto MapReaderToDto(MySqlDataReader rdr, IMediaResolverService resolver)
        {
            var createdAt = DateTime.SpecifyKind(rdr.GetDateTime("created_at"), DateTimeKind.Utc);

            // Raw DB Values
            string rawProfPic = rdr["profile_pic"] == DBNull.Value ? null : rdr["profile_pic"].ToString();
            string rawImgUrl = rdr["image_url"] == DBNull.Value ? null : rdr["image_url"].ToString();

            return new PostDto
            {
                Id = rdr.GetInt64("post_id"),
                AuthorId = rdr.GetInt32("user_id"),
                AuthorName = rdr["display_name"].ToString(),
                // RESOLVED: Profile Picture
                AuthorPic = SafeResolve(rawProfPic, resolver) ?? "/img/profile_default.jpg",
                ContextType = rdr["context_type"].ToString(),
                ContextId = rdr["context_id"].ToString(),
                Type = rdr["post_type"].ToString(),
                Title = rdr["title"] == DBNull.Value ? null : rdr["title"].ToString(),
                Text = rdr["content_text"] == DBNull.Value ? null : rdr["content_text"].ToString(),
                // RESOLVED: Legacy image URLs (if any exist)
                ImageUrl = SafeResolve(rawImgUrl, resolver),
                CreatedAt = createdAt,
                Price = rdr["price"] == DBNull.Value ? null : (decimal?)rdr.GetDecimal("price"),
                Quantity = rdr["quantity"] == DBNull.Value ? null : (int?)rdr.GetInt32("quantity"),
                LocationLabel = rdr["location_label"] == DBNull.Value ? null : rdr["location_label"].ToString(),
                DifficultyLevel = rdr["difficulty_level"] == DBNull.Value ? null : rdr["difficulty_level"].ToString(),
                VideoUrl = rdr["video_url"] == DBNull.Value ? null : rdr["video_url"].ToString(),
                LikesCount = Convert.ToInt32(rdr["likes_count"]),
                CommentsCount = Convert.ToInt32(rdr["comments_count"]),
                IsLiked = Convert.ToInt32(rdr["is_liked"]) > 0,
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