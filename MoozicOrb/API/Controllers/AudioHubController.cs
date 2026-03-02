using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;

namespace MoozicOrb.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AudioHubController : ControllerBase
    {
        private readonly IMediaResolverService _resolver;
        private readonly IHttpContextAccessor _http;

        public AudioHubController(IMediaResolverService resolver, IHttpContextAccessor http)
        {
            _resolver = resolver;
            _http = http;
        }

        private int GetCurrentUserIdSafe()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            if (string.IsNullOrEmpty(sid)) return 0;

            var session = SessionStore.GetSession(sid);
            return session?.UserId ?? 0;
        }

        private int GetUserIdStrict()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);

            if (session == null)
                throw new UnauthorizedAccessException("You must be logged in to perform this action.");

            return session.UserId;
        }

        [HttpGet("orphans/{userId}")]
        public IActionResult GetOrphans(int userId)
        {
            try
            {
                int currentUserId = GetCurrentUserIdSafe();
                bool isOwner = (currentUserId != 0 && currentUserId == userId);

                var collection = new GetOrphanedAudio().Execute(userId, isOwner, _resolver);
                return Ok(collection);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpGet("albums/{userId}")]
        public IActionResult GetAlbums(int userId)
        {
            try
            {
                int currentUserId = GetCurrentUserIdSafe();
                bool isOwner = (currentUserId != 0 && currentUserId == userId);

                // Pass the _resolver into the Execution class here
                var albums = new GetUserCollectionsByType().Execute(userId, 7, isOwner, _resolver);
                return Ok(albums);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpPost("metadata")]
        public IActionResult UpdateMetadata([FromBody] AudioItemMetadataDto req)
        {
            int userId = GetCurrentUserIdSafe();
            if (userId == 0) return Unauthorized("User is not logged in.");

            try
            {
                new UpdateAudioMetadata().Execute(userId, req);
                return Ok(new { success = true, message = "Metadata updated successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AudioHub] Metadata update error: {ex.Message}");
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}