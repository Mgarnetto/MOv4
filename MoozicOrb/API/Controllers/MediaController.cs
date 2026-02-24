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
    }
}