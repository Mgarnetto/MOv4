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
        // 1. IMAGE UPLOAD (Standard)
        // ==========================================
        [HttpPost("image")]
        public async Task<IActionResult> UploadImage([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file provided");

            int uid = GetUserId();
            if (uid == 0) return Unauthorized("User not logged in");

            try
            {
                // Save File
                string relativePath = await _fileService.SaveFileAsync(file, "Image");
                string physPath = _fileService.GetPhysicalPath(relativePath);
                int width = 0, height = 0;

                // Server-Side Metadata (Fast for images)
                try
                {
                    var meta = await _processor.ProcessImageAsync(physPath, relativePath);
                    width = meta.Width;
                    height = meta.Height;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Upload] Image metadata failed: {ex.Message}. Continuing...");
                }

                string webUrl = "/" + relativePath.Replace("\\", "/");
                long newId = new InsertImage().Execute(uid, file.FileName, webUrl, width, height);

                return Ok(new { id = newId, type = 3, url = webUrl });
            }
            catch (Exception ex) { return BadRequest($"Image Upload Error: {ex.Message}"); }
        }

        // ==========================================
        // 2. AUDIO UPLOAD (Standard)
        // ==========================================
        [HttpPost("audio")]
        public async Task<IActionResult> UploadAudio([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("No file provided");

            int uid = GetUserId();
            if (uid == 0) return Unauthorized("User not logged in");

            try
            {
                // Save File
                string dbPath = await _fileService.SaveFileAsync(file, "Audio");
                string physPath = _fileService.GetPhysicalPath(dbPath);
                string snippetPath = "";
                int duration = 0;

                // Server-Side Processing (Waveform/Duration)
                try
                {
                    var meta = await _processor.ProcessAudioAsync(physPath, dbPath);
                    snippetPath = meta.SnippetPath;
                    duration = (int)meta.DurationSeconds;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Upload] Audio processing failed: {ex.Message}. Continuing...");
                }

                string webUrl = "/" + dbPath.Replace("MoozicOrb/", "").Replace("\\", "/");
                long newId = new InsertAudio().Execute(uid, file.FileName, webUrl, snippetPath, duration);

                return Ok(new { id = newId, type = 1, url = webUrl });
            }
            catch (Exception ex) { return BadRequest($"Audio Upload Error: {ex.Message}"); }
        }

        // ==========================================
        // 3. VIDEO UPLOAD (Client-Side Optimized)
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
                // 1. Save Main Video File
                string dbPath = await _fileService.SaveFileAsync(file, "Video");

                // 2. Handle Client-Side Thumbnail (If provided)
                string thumbPath = "";
                if (thumbnail != null && thumbnail.Length > 0)
                {
                    // Reuse file service to save the thumb (force "Image" type)
                    string rawThumbPath = await _fileService.SaveFileAsync(thumbnail, "Image");
                    thumbPath = rawThumbPath;
                }

                // 3. Prepare URLs
                string webUrl = "/" + dbPath.Replace("MoozicOrb/", "").Replace("\\", "/");
                string webThumbUrl = string.IsNullOrEmpty(thumbPath)
                    ? ""
                    : "/" + thumbPath.Replace("MoozicOrb/", "").Replace("\\", "/");

                // 4. Insert Record (Trusting client metadata)
                // We skip server-side _processor.ProcessVideoAsync() entirely here.
                long newId = new InsertVideo().Execute(uid, file.FileName, webUrl, webThumbUrl, duration, width, height);

                return Ok(new { id = newId, type = 2, url = webUrl });
            }
            catch (Exception ex) { return BadRequest($"Video Upload Error: {ex.Message}"); }
        }
    }
}