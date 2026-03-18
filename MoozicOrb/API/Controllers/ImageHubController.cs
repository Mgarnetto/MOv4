using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/imagehub")]
    public class ImageHubController : Controller
    {
        private readonly IHttpContextAccessor _http;
        private readonly IMediaResolverService _resolver;

        public ImageHubController(IHttpContextAccessor http, IMediaResolverService resolver)
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

        // GET: api/imagehub/vault/{targetUserId}
        [HttpGet("vault/{targetUserId}")]
        public IActionResult GetVaultImages(int targetUserId)
        {
            try
            {
                int viewerId = GetUserId();
                var getPostIo = new GetPost();

                // Param 7 is PostType (7 = Image)
                var allImages = getPostIo.Execute(1, targetUserId, viewerId, 1, 100, null, 7, _resolver);

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
                var collections = io.Execute(targetUserId, 8, isOwner, _resolver);

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
    }
}
