using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.IO;
using System.Threading.Tasks;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/upload")]
    public class UploadController : ControllerBase
    {
        private readonly IMediaFileService _fileService;
        private readonly IMediaProcessor _processor;
        private readonly IHttpContextAccessor _http;

        public UploadController(IMediaFileService f, IMediaProcessor p, IHttpContextAccessor http)
        {
            _fileService = f;
            _processor = p;
            _http = http;
        }

        private int GetUserId()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            if (!string.IsNullOrEmpty(sid))
            {
                var session = SessionStore.GetSession(sid);
                if (session != null) return session.UserId;
            }
            int? cookieId = _http.HttpContext?.Session.GetInt32("UserId");
            if (cookieId.HasValue && cookieId.Value > 0) return cookieId.Value;
            return 0;
        }

        // ==========================================
        // 1. IMAGE UPLOAD (Hybrid Pipeline)
        // ==========================================
        [HttpPost("image")]
        public async Task<IActionResult> UploadImage([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file provided");
            int uid = GetUserId();
            if (uid == 0) return Unauthorized("User not logged in");

            try
            {
                string uniqueName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName).ToLower()}";
                // FLATTENED: No user ID in the path
                string cloudKey = $"image/{uniqueName}";

                string relativePath = await _fileService.SaveFileAsync(file, "Image");
                string physPath = _fileService.GetPhysicalPath(relativePath);
                int width = 0, height = 0;

                try
                {
                    var meta = await _processor.ProcessImageAsync(physPath, relativePath);
                    width = meta.Width;
                    height = meta.Height;
                }
                catch (Exception ex) { Console.WriteLine($"[Upload] Image metadata failed: {ex.Message}"); }

                // Upload to Vault and Wipe Local
                await _fileService.UploadToCloudAsync(physPath, cloudKey);
                await _fileService.DeleteLocalFileAsync(physPath);

                // CLEAN INSERT: IO class defaults to storage_provider = 1 under the hood
                long newId = new InsertImage().Execute(uid, file.FileName, cloudKey, width, height);

                return Ok(new { id = newId, type = 3, url = cloudKey });
            }
            catch (Exception ex) { return BadRequest($"Image Upload Error: {ex.Message}"); }
        }

        // ==========================================
        // 2. AUDIO UPLOAD (Hybrid Pipeline)
        // ==========================================
        [HttpPost("audio")]
        public async Task<IActionResult> UploadAudio([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file provided");
            int uid = GetUserId();
            if (uid == 0) return Unauthorized("User not logged in");

            try
            {
                string uniqueName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName).ToLower()}";
                string snippetName = $"{Path.GetFileNameWithoutExtension(uniqueName)}_snippet.wav";

                // FLATTENED
                string cloudKey = $"audio/{uniqueName}";
                string cloudSnippetKey = $"audio/{snippetName}";

                string dbPath = await _fileService.SaveFileAsync(file, "Audio");
                string physPath = _fileService.GetPhysicalPath(dbPath);
                string snippetPath = "";
                int duration = 0;

                try
                {
                    var meta = await _processor.ProcessAudioAsync(physPath, dbPath);
                    snippetPath = meta.SnippetPath;
                    duration = (int)meta.DurationSeconds;
                }
                catch (Exception ex) { Console.WriteLine($"[Upload] Audio processing failed: {ex.Message}"); }

                // Upload Main File
                await _fileService.UploadToCloudAsync(physPath, cloudKey);

                // Upload Snippet (if successful)
                if (!string.IsNullOrEmpty(snippetPath))
                {
                    string physSnippet = _fileService.GetPhysicalPath(snippetPath);
                    if (System.IO.File.Exists(physSnippet))
                    {
                        await _fileService.UploadToCloudAsync(physSnippet, cloudSnippetKey);
                        await _fileService.DeleteLocalFileAsync(physSnippet);
                    }
                }
                await _fileService.DeleteLocalFileAsync(physPath);

                // CLEAN INSERT: IO class defaults to storage_provider = 1 under the hood
                long newId = new InsertAudio().Execute(uid, file.FileName, cloudKey, cloudSnippetKey, duration);

                return Ok(new { id = newId, type = 1, url = cloudKey, snippetPath = cloudSnippetKey });
            }
            catch (Exception ex) { return BadRequest($"Audio Upload Error: {ex.Message}"); }
        }

        // ==========================================
        // 3. VIDEO UPLOAD (Direct Stream to Edge)
        // ==========================================
        [HttpPost("video")]
        public async Task<IActionResult> UploadVideo(
            [FromForm] IFormFile file,
            [FromForm] IFormFile thumbnail = null,
            [FromForm] int duration = 0,
            [FromForm] int width = 0,
            [FromForm] int height = 0)
        {
            if (file == null || file.Length == 0) return BadRequest("No file provided");
            int uid = GetUserId();
            if (uid == 0) return Unauthorized("User not logged in");

            try
            {
                string uniqueName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName).ToLower()}";
                // FLATTENED
                string cloudKey = $"video/{uniqueName}";
                string thumbKey = "";

                // Stream video straight to Cloudflare
                await _fileService.UploadStreamToCloudAsync(file.OpenReadStream(), cloudKey, file.ContentType);

                if (thumbnail != null && thumbnail.Length > 0)
                {
                    string thumbExt = Path.GetExtension(thumbnail.FileName).ToLower();
                    if (string.IsNullOrEmpty(thumbExt)) thumbExt = ".jpg";
                    thumbKey = $"video/{Guid.NewGuid()}{thumbExt}";

                    await _fileService.UploadStreamToCloudAsync(thumbnail.OpenReadStream(), thumbKey, thumbnail.ContentType);
                }

                // CLEAN INSERT: IO class defaults to storage_provider = 1 under the hood
                long newId = new InsertVideo().Execute(uid, file.FileName, cloudKey, thumbKey, duration, width, height);

                return Ok(new { id = newId, type = 2, url = cloudKey, snippetPath = thumbKey });
            }
            catch (Exception ex) { return BadRequest($"Video Upload Error: {ex.Message}"); }
        }
    }
}