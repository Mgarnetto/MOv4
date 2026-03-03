using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Services;
using MoozicOrb.IO;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/media")]
    public class MediaController : ControllerBase
    {
        private readonly IMediaResolverService _resolver;

        // Dependency Injecting the Switchboard
        public MediaController(IMediaResolverService resolver)
        {
            _resolver = resolver;
        }

        [HttpGet("audio/{id}")]
        public IActionResult GetAudio(long id)
        {
            var data = new GetAudio().Execute(id);
            if (data == null) return NotFound();

            // Run it through the switchboard!
            string secureUrl = _resolver.ResolveUrl(data.RelativePath, data.StorageProvider);

            return Ok(new { url = secureUrl, duration = data.DurationSeconds });
        }

        [HttpGet("video/{id}")]
        public IActionResult GetVideo(long id)
        {
            var data = new GetVideo().Execute(id);
            if (data == null) return NotFound();

            string secureUrl = _resolver.ResolveUrl(data.RelativePath, data.StorageProvider);
            string secureThumb = _resolver.ResolveUrl(data.SnippetPath, data.StorageProvider);

            return Ok(new { url = secureUrl, thumb = secureThumb, w = data.Width, h = data.Height, duration = data.DurationSeconds });
        }

        [HttpGet("image/{id}")]
        public IActionResult GetImage(long id)
        {
            var data = new GetImage().Execute(id);
            if (data == null) return NotFound();

            string secureUrl = _resolver.ResolveUrl(data.RelativePath, data.StorageProvider);

            return Ok(new { url = secureUrl, w = data.Width, h = data.Height });
        }

        [HttpDelete("{mediaTypeStr}/{id}")]
        public IActionResult DeleteMedia(string mediaTypeStr, long id)
        {
            try
            {
                // Your Auth Logic
                var sid = HttpContext.Request.Headers["X-Session-Id"].ToString();
                var session = MoozicOrb.Services.SessionStore.GetSession(sid);
                if (session == null) return Unauthorized();

                int mediaType = mediaTypeStr.ToLower() switch
                {
                    "audio" => MoozicOrb.Constants.MarketplaceTargetTypes.AudioTrack,
                    "video" => MoozicOrb.Constants.MarketplaceTargetTypes.Video,
                    "image" => MoozicOrb.Constants.MarketplaceTargetTypes.Image,
                    _ => -1
                };

                if (mediaType == -1) return BadRequest("Invalid media type.");

                // Call the IO Class we created in the previous step
                var result = new MoozicOrb.IO.DeleteMedia().Execute(session.UserId, id, mediaType);

                if (!result.Success) return BadRequest(result.ErrorMessage);

                // Call our consolidated File Service!
                _ = _mediaFileService.DeleteMediaFilesAsync(result.PathsToDelete, result.StorageProvider);

                return Ok(new { success = true });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }
    }
}