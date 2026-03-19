using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.Threading.Tasks;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/imagehub")]
    public class ImageHubController : Controller
    {
        private readonly IHttpContextAccessor _http;
        private readonly IMediaResolverService _resolver;
        private readonly IMediaFileService _mediaFileService;

        public ImageHubController(IHttpContextAccessor http, IMediaResolverService resolver, IMediaFileService mediaFileService)
        {
            _http = http;
            _resolver = resolver;
            _mediaFileService = mediaFileService;
        }

        private int GetUserId()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            if (string.IsNullOrEmpty(sid)) return 0;
            var session = SessionStore.GetSession(sid);
            return session?.UserId ?? 0;
        }

        // GET: api/imagehub/vault/{targetUserId}
        [HttpGet("vault/{targetUserId}")]
        public IActionResult GetVaultImages(int targetUserId, [FromQuery] bool unassigned = true)
        {
            try
            {
                int viewerId = GetUserId();

                // Use our new Micro-Query engine
                var io = new GetVaultImagesLight();
                var allImages = io.Execute(targetUserId, viewerId, unassigned, _resolver);

                return Ok(allImages);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // GET: api/imagehub/collections/{targetUserId}
        [HttpGet("collections/{targetUserId}")]
        public IActionResult GetImageCollections(int targetUserId)
        {
            try
            {
                int viewerId = GetUserId();
                bool isOwner = (viewerId == targetUserId);

                var io = new GetUserCollectionsByType();
                // Type 8 = Collections. The front-end filters by DisplayContext 'gallery' or 'album'
                var collections = io.Execute(targetUserId, 4, isOwner, _resolver);

                return Ok(collections);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // PUT: api/imagehub/image/{id}
        [HttpPut("image/{id}")]
        public IActionResult UpdateImageInspector(long id, [FromBody] UpdatePostDto req)
        {
            try
            {
                int userId = GetUserId();
                if (userId == 0) return Unauthorized();

                var io = new UpdateImageMetadata();
                // TargetType 3 = Image Media (Audio=1, Video=2, Image=3)
                io.Execute(userId, req, id, 3);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // PUT: api/imagehub/collection/{id}
        [HttpPut("collection/{id}")]
        public IActionResult UpdateCollectionInspector(long id, [FromBody] UpdatePostDto req)
        {
            try
            {
                int userId = GetUserId();
                if (userId == 0) return Unauthorized();

                var io = new UpdateImageMetadata();
                // TargetType 0 = Collection
                io.Execute(userId, req, id, 0);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("vault/{postId}/media/{mediaId}")]
        public async Task<IActionResult> DeleteVaultImage(long postId, long mediaId)
        {
            try
            {
                // 1. Get the User ID securely using your helper method
                int userId = GetUserId();
                if (userId == 0) return Unauthorized();

                // 2. Unlink Post and Media (Prevents SQL FK constraint crash)
                var unlinkIo = new IO.DeletePostMedia();
                unlinkIo.Execute(userId, postId, mediaId);

                // 3. Delete the Post wrapper (This wipes out Likes, Comments, and Social Feed presence)
                var delPostIo = new IO.DeletePost();
                delPostIo.Execute(userId, postId);

                // 4. Delete the Media row and extract the raw file paths (3 = Image type)
                var delMediaIo = new IO.DeleteMedia();
                var deletionResult = delMediaIo.Execute(userId, mediaId, 3);

                // 5. Safely nuke the physical files (Local or Cloud)
                if (deletionResult.Success && deletionResult.PathsToDelete.Count > 0)
                {
                    // Your MediaFileService safely ignores missing local files and handles Cloudflare R2!
                    await _mediaFileService.DeleteMediaFilesAsync(deletionResult.PathsToDelete, deletionResult.StorageProvider);
                }

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
