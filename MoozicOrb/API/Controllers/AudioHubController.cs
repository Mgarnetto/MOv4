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

        // Inject IHttpContextAccessor so we can read the headers globally
        public AudioHubController(IMediaResolverService resolver, IHttpContextAccessor http)
        {
            _resolver = resolver;
            _http = http;
        }

        // ==========================================
        // SESSION HELPERS
        // ==========================================

        // Safe version for READ requests (so fans can view public profiles without crashing)
        private int GetCurrentUserIdSafe()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            if (string.IsNullOrEmpty(sid)) return 0;

            var session = SessionStore.GetSession(sid);
            return session?.UserId ?? 0;
        }

        // Strict version for WRITE/UPLOAD requests (blocks unauthorized users)
        private int GetUserIdStrict()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);

            if (session == null)
                throw new UnauthorizedAccessException("You must be logged in to perform this action.");

            return session.UserId;
        }

        // ==========================================
        // PUBLIC READ ENDPOINTS (The Display Zones)
        // ==========================================

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

                // 2 is the locked-in Type for standard Audio Albums
                var albums = new GetUserCollectionsByType().Execute(userId, 7, isOwner);
                return Ok(albums);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // POST: api/audiohub/metadata
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