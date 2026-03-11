using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/videohub")]
    public class VideoHubController : Controller
    {
        private readonly IHttpContextAccessor _http;
        private readonly IMediaResolverService _resolver;

        public VideoHubController(IHttpContextAccessor http, IMediaResolverService resolver)
        {
            _http = http;
            _resolver = resolver;
        }

        private int GetUserId()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            if (string.IsNullOrEmpty(sid)) return 0;
            var session = SessionStore.GetSession(sid);
            return session?.UserId ?? 0;
        }

        // GET: api/videohub/vault/{targetUserId}
        // Fetches ALL Videos for a specific user (Old standard posts + New Vault posts)
        [HttpGet("vault/{targetUserId}")]
        public IActionResult GetVaultVideos(int targetUserId)
        {
            try
            {
                int viewerId = GetUserId();
                var getPostIo = new GetPost();

                // We pass 'null' for PostType so it grabs Type 1 AND Type 6.
                // We pass '2' for MediaType so it strictly filters to Videos.
                var allVideos = getPostIo.Execute(1, targetUserId, viewerId, 1, 100, null, 2, _resolver);

                return Ok(allVideos);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/videohub/collections/{targetUserId}
        // Fetches all Video Collections (Type 8) using your existing IO class
        [HttpGet("collections/{targetUserId}")]
        public IActionResult GetVideoCollections(int targetUserId)
        {
            try
            {
                int viewerId = GetUserId();
                bool isOwner = (viewerId == targetUserId);

                // Use the EXISTING plural class
                var io = new GetUserCollectionsByType();

                // Type 8 = Video Series / Collections
                var collections = io.Execute(targetUserId, 8, isOwner, _resolver);

                return Ok(collections);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // POST: api/videohub/collections/{id}/like
        // Toggles a like on a video collection
        [HttpPost("collections/{id}/like")]
        public IActionResult ToggleCollectionLike(long id)
        {
            try
            {
                int viewerId = GetUserId();
                if (viewerId == 0) return Unauthorized();

                var io = new ToggleCollectionLike();
                bool isLiked = io.Execute(viewerId, id);

                return Ok(new { liked = isLiked });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("video/{id}")]
        public IActionResult UpdateVideoInspector(long id, [FromBody] UpdatePostDto req)
        {
            try
            {
                int userId = GetUserId();
                if (userId == 0) return Unauthorized();

                var io = new UpdateVideoMetadata();
                // TargetType 2 = Video
                io.Execute(userId, req, id, 2);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // PUT: api/videohub/collection/{id}
        [HttpPut("collection/{id}")]
        public IActionResult UpdateCollectionInspector(long id, [FromBody] UpdatePostDto req)
        {
            try
            {
                int userId = GetUserId();
                if (userId == 0) return Unauthorized();

                var io = new UpdateVideoMetadata();
                // TargetType 0 = Collection
                io.Execute(userId, req, id, 0);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}