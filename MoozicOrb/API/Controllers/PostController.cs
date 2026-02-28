using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services; // <-- ADDED
using MoozicOrb.Hubs;
using MoozicOrb.IO;
using MoozicOrb.Services;
using MoozicOrb.Services.Interfaces;
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/posts")]
    public class PostController : Controller
    {
        private readonly IHubContext<PostHub> _hub;
        private readonly IHttpContextAccessor _http;
        private readonly IUserService _userService;
        private readonly NotificationService _notify;
        private readonly IMediaResolverService _resolver; // <-- ADDED

        public PostController(
            IHubContext<PostHub> hub,
            IHttpContextAccessor http,
            IUserService userService,
            NotificationService notify,
            IMediaResolverService resolver) // <-- ADDED
        {
            _hub = hub;
            _http = http;
            _userService = userService;
            _notify = notify;
            _resolver = resolver; // <-- ADDED
        }

        // --- HELPERS ----------------------------------------------------

        private int GetUserId()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            if (string.IsNullOrEmpty(sid)) throw new UnauthorizedAccessException();
            var session = SessionStore.GetSession(sid);
            if (session == null) throw new UnauthorizedAccessException();
            return session.UserId;
        }

        private int GetViewerId()
        {
            try { return GetUserId(); }
            catch { return 0; }
        }

        private string GetSignalRGroupName(string type, string id)
        {
            return (type?.ToLower()) switch
            {
                "loc" => $"loc_{id}",
                "page" => $"page_{id}",
                "user" => $"user_{id}",
                "creator" => $"user_{id}",
                "feed" => "feed_global",
                "discover" => "page_discover",
                _ => "feed_global"
            };
        }

        // --- POSTS ------------------------------------------------------

        [HttpPost]
        public async Task<IActionResult> CreatePost([FromBody] CreatePostDto req)
        {
            try
            {
                int userId = GetUserId();

                // ENFORCEMENT: Limit standard posts to 1 media attachment
                if (req.Type == "standard" && req.MediaAttachments != null && req.MediaAttachments.Count > 1)
                {
                    return BadRequest("Standard posts only support one media attachment.");
                }

                // 1. Fetch Real User Info for the live update
                var user = new UserQuery().GetUserById(userId);
                string authorName = user?.UserName ?? "Unknown";

                string rawPic = user?.ProfilePic;
                if (!string.IsNullOrEmpty(rawPic) && !rawPic.StartsWith("/") && !rawPic.StartsWith("http"))
                {
                    rawPic = _resolver.ResolveUrl(rawPic, 1);
                }
                string authorPic = rawPic ?? "/img/profile_default.jpg";

                // 2. Insert Post
                var postIo = new InsertPost();
                long postId = postIo.Execute(userId, req);

                // 3. Insert Attachments & Sync Audio Titles
                if (req.MediaAttachments != null && req.MediaAttachments.Count > 0)
                {
                    var mediaIo = new InsertPostMedia();
                    var updateAudioTitleIo = new UpdateAudioTitle(); // Instantiate new IO class

                    int sort = 0;
                    foreach (var item in req.MediaAttachments)
                    {
                        // Link media to post
                        mediaIo.Execute(postId, item.MediaId, item.MediaType, sort++);

                        // SYNC FIX: If it's an Audio track (Type 1), force the vault to match the post title
                        if (item.MediaType == 1 && !string.IsNullOrWhiteSpace(req.Title))
                        {
                            updateAudioTitleIo.Execute(item.MediaId, req.Title);
                        }
                    }
                }

                // 4. Construct DTO for Broadcast (MANUAL BINDING - NO DB QUERY)
                var livePost = new PostDto
                {
                    Id = postId,
                    AuthorId = userId,
                    ViewerId = userId,
                    AuthorName = authorName,
                    AuthorPic = authorPic,
                    ContextType = req.ContextType,
                    ContextId = req.ContextId,
                    Type = req.Type,
                    Title = req.Title,
                    Text = req.Text,
                    ImageUrl = req.ImageUrl,
                    CreatedAt = DateTime.UtcNow,
                    CreatedAgo = "Just now",

                    // Because feed.js now sends SnippetPath in the JSON, it automatically exists right here!
                    Attachments = req.MediaAttachments ?? new List<MediaAttachmentDto>(),

                    Price = req.Price,
                    Quantity = req.Quantity,
                    LocationLabel = req.LocationLabel,
                    DifficultyLevel = req.DifficultyLevel,
                    VideoUrl = req.VideoUrl,
                    MediaId = req.MediaId,
                    Category = req.Category,
                    IsLiked = false,
                    LikesCount = 0,
                    CommentsCount = 0
                };

                // 5. Broadcast via SignalR
                string targetGroup = GetSignalRGroupName(req.ContextType, req.ContextId);
                await _hub.Clients.Group(targetGroup).SendAsync("ReceivePost", new
                {
                    targetGroup = targetGroup,
                    data = livePost
                });

                // 6. NOTIFY FOLLOWERS
                string preview = req.Title ?? (req.Text?.Length > 20 ? req.Text.Substring(0, 20) + "..." : "New Post");
                await _notify.NotifyFollowers(userId, postId, preview);

                return Ok(new { id = postId });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet]
        public IActionResult GetPosts(
            [FromQuery] string contextType,
            [FromQuery] string contextId,
            [FromQuery] int page = 1,
            [FromQuery] string postType = null,
            [FromQuery] int? mediaType = null)
        {
            try
            {
                int viewerId = GetViewerId();
                var io = new GetPost();
                List<PostDto> posts;

                if (contextType == "global" || contextType == "feed_global")
                {
                    posts = io.GetDiscoveryFeed(viewerId, 20, _resolver); // <-- PASSED RESOLVER
                }
                else if (contextType == "discover")
                {
                    posts = io.GetAudioDiscoveryFeed(viewerId, 20, _resolver); // <-- PASSED RESOLVER
                }
                else
                {
                    posts = io.Execute(contextType, contextId, viewerId, page, 20, postType, mediaType, _resolver); // <-- PASSED RESOLVER
                }

                if (posts != null)
                {
                    foreach (var p in posts) p.ViewerId = viewerId;
                }

                return Ok(posts);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("{id}")]
        public IActionResult GetSingle(long id)
        {
            try
            {
                int viewerId = GetViewerId();
                var io = new GetPost();
                var post = io.Execute(id, viewerId, _resolver); // <-- PASSED RESOLVER

                if (post == null) return NotFound("Post not found");

                // <--- SET VIEWER ID
                post.ViewerId = viewerId;

                return Ok(post);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // Endpoint to render the Partial View for the Modal
        [HttpGet("{id}/card")]
        public IActionResult GetSingleCard(long id)
        {
            try
            {
                int viewerId = GetViewerId();
                var io = new GetPost();
                var post = io.Execute(id, viewerId, _resolver); // <-- PASSED RESOLVER

                if (post == null) return NotFound("Post not found");

                // <--- SET VIEWER ID (Crucial for Edit/Delete buttons in modal)
                post.ViewerId = viewerId;

                return PartialView("~/Views/Shared/_PostCard.cshtml", post);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // --- COMMENTS ---------------------------------------------------

        [HttpPost("comment")]
        public async Task<IActionResult> AddComment([FromBody] CreateCommentDto req)
        {
            try
            {
                int userId = GetUserId();

                // ENFORCEMENT: Restrict to 1 sub-comment level deep
                if (req.ParentId.HasValue)
                {
                    var commentsIo = new GetComments();
                    var allComments = commentsIo.Execute(req.PostId);

                    bool isParentAReply = false;
                    foreach (var root in allComments)
                    {
                        if (root.CommentId == req.ParentId.Value) { break; } // Parent is root, OK
                        if (root.Replies != null && root.Replies.Exists(r => r.CommentId == req.ParentId.Value))
                        {
                            isParentAReply = true; // Parent is already a reply, BLOCK
                            break;
                        }
                    }

                    if (isParentAReply)
                    {
                        return BadRequest("Nesting is limited to one sub-comment level.");
                    }
                }

                var io = new InsertComment();
                long id = io.Execute(userId, req);

                // NOTIFY POST AUTHOR
                var postIo = new GetPost();
                var post = postIo.Execute(req.PostId, userId, _resolver); // <-- PASSED RESOLVER

                if (post != null && post.AuthorId != userId)
                {
                    string commentPreview = req.Content.Length > 20 ? req.Content.Substring(0, 20) + "..." : req.Content;
                    await _notify.NotifyUser(post.AuthorId, userId, "comment", req.PostId, $"commented: {commentPreview}");
                }

                return Ok(new { id });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("{id}/comments")]
        public IActionResult GetComments(long id)
        {
            try
            {
                var io = new GetComments();
                var comments = io.Execute(id);
                return Ok(comments);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // --- LIKES ------------------------------------------------------

        [HttpPost("{id}/like")]
        public async Task<IActionResult> LikePost(long id)
        {
            try
            {
                int userId = GetUserId();
                var io = new ToggleLike();
                bool liked = io.Execute(userId, id);

                // NOTIFY POST AUTHOR
                if (liked)
                {
                    var postIo = new GetPost();
                    var post = postIo.Execute(id, userId, _resolver); // <-- PASSED RESOLVER

                    if (post != null && post.AuthorId != userId)
                    {
                        await _notify.NotifyUser(post.AuthorId, userId, "like", id, "liked your post");
                    }
                }

                return Ok(new { liked });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // --- UPDATE / DELETE --------------------------------------------

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePost(long id, [FromBody] UpdatePostDto req)
        {
            try
            {
                int userId = GetUserId();

                // 1. Update text, title, price, and quantity
                var io = new UpdatePost();
                io.Execute(userId, id, req);

                // 2. NEW: Intercept newly uploaded files and append them to the post
                if (req.MediaAttachments != null && req.MediaAttachments.Count > 0)
                {
                    var mediaIo = new InsertPostMedia();
                    foreach (var item in req.MediaAttachments)
                    {
                        // Passing 0 for sort_order appends it to the list
                        mediaIo.Execute(id, item.MediaId, item.MediaType, 0);
                    }
                }

                // 3. Get updated post to broadcast via SignalR
                var getIo = new GetPost();
                var updatedPost = getIo.Execute(id, userId, _resolver); // <-- PASSED RESOLVER

                if (updatedPost != null)
                {
                    // Ensure viewer ID is set for real-time update payload
                    updatedPost.ViewerId = userId;

                    string targetGroup = GetSignalRGroupName(updatedPost.ContextType, updatedPost.ContextId);
                    await _hub.Clients.Group(targetGroup).SendAsync("UpdatePost", new
                    {
                        postId = id,
                        data = updatedPost
                    });
                }

                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePost(long id)
        {
            try
            {
                int userId = GetUserId();
                var getIo = new GetPost();
                var existing = getIo.Execute(id, userId, _resolver); // <-- PASSED RESOLVER
                if (existing == null) return NotFound();

                var delIo = new DeletePost();
                bool success = delIo.Execute(userId, id);

                if (success)
                {
                    string targetGroup = GetSignalRGroupName(existing.ContextType, existing.ContextId);
                    await _hub.Clients.Group(targetGroup).SendAsync("RemovePost", new { postId = id });
                    return Ok(new { success = true });
                }
                return BadRequest("Could not delete post.");
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}/media/{mediaId}")]
        public IActionResult DeleteMedia(long id, long mediaId)
        {
            try
            {
                int userId = GetUserId();
                var io = new DeletePostMedia();
                io.Execute(userId, id, mediaId);
                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // =========================================
        // PUT: Edit Comment
        // =========================================
        [HttpPut("{id}/comments/{commentId}")]
        public async Task<IActionResult> EditComment(long id, long commentId, [FromBody] JsonElement body)
        {
            try
            {
                if (!body.TryGetProperty("text", out var t)) return BadRequest("Text required");
                string newText = t.GetString();
                if (string.IsNullOrWhiteSpace(newText)) return BadRequest("Text cannot be empty");

                int userId = GetUserId();
                var io = new UpdateComment();
                bool success = io.Execute(userId, commentId, newText);

                if (!success) return BadRequest("Could not edit comment (Access Denied or Not Found)");

                // Get Post to find the correct SignalR group
                var post = new GetPost().Execute(id, userId, _resolver); // <-- PASSED RESOLVER
                if (post != null)
                {
                    string targetGroup = GetSignalRGroupName(post.ContextType, post.ContextId);

                    // Broadcast Update
                    await _hub.Clients.Group(targetGroup).SendAsync("OnCommentUpdated", new
                    {
                        postId = id,
                        commentId = commentId,
                        text = newText
                    });
                }

                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // =========================================
        // DELETE: Remove Comment
        // =========================================
        [HttpDelete("{id}/comments/{commentId}")]
        public async Task<IActionResult> DeleteComment(long id, long commentId)
        {
            try
            {
                int userId = GetUserId();
                var io = new DeleteComment();
                bool success = io.Execute(userId, commentId);

                if (!success) return BadRequest("Could not delete comment (Access Denied or Not Found)");

                // Get Post to find the correct SignalR group
                var post = new GetPost().Execute(id, userId, _resolver); // <-- PASSED RESOLVER
                if (post != null)
                {
                    string targetGroup = GetSignalRGroupName(post.ContextType, post.ContextId);

                    // Broadcast Delete
                    await _hub.Clients.Group(targetGroup).SendAsync("OnCommentDeleted", new
                    {
                        postId = id,
                        commentId = commentId
                    });
                }

                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }
    }
}