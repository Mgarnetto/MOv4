using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MoozicOrb.Services;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
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
        private readonly IMediaResolverService _resolver;

        public UploadController(IMediaFileService f, IMediaProcessor p, IHttpContextAccessor http, IMediaResolverService resolver)
        {
            _fileService = f;
            _processor = p;
            _http = http;
            _resolver = resolver;
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

                // Resolve the URL before handing it back to the frontend for instant preview
                string previewUrl = _resolver.ResolveUrl(cloudKey, 1);

                // CHANGED: Returning the rawKey alongside the presigned URL
                return Ok(new { id = newId, type = 3, url = previewUrl, rawKey = cloudKey });
            }
            catch (Exception ex) { return BadRequest($"Image Upload Error: {ex.Message}"); }
        }

        // ==========================================
        // 2. AUDIO UPLOAD (Clean Pipeline)
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
                string cloudKey = $"audio/{uniqueName}";

                string dbPath = await _fileService.SaveFileAsync(file, "Audio");
                string physPath = _fileService.GetPhysicalPath(dbPath);
                int duration = 0;

                try
                {
                    var meta = await _processor.ProcessAudioAsync(physPath, dbPath);
                    duration = (int)meta.DurationSeconds;
                }
                catch (Exception ex) { Console.WriteLine($"[Upload] Audio processing failed: {ex.Message}"); }

                // Upload Main File Only
                await _fileService.UploadToCloudAsync(physPath, cloudKey);
                await _fileService.DeleteLocalFileAsync(physPath);

                // CLEAN INSERT: Pass an empty string for the snippet to leave it blank in the DB
                long newId = new InsertAudio().Execute(uid, file.FileName, cloudKey, "", duration);

                string previewUrl = _resolver.ResolveUrl(cloudKey, 1);

                return Ok(new { id = newId, type = 1, url = previewUrl, snippetPath = "" });
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

                // Resolve the URLs before handing them back to the frontend
                string previewUrl = _resolver.ResolveUrl(cloudKey, 1);
                string previewThumb = _resolver.ResolveUrl(thumbKey, 1);

                return Ok(new { id = newId, type = 2, url = previewUrl, snippetPath = previewThumb });
            }
            catch (Exception ex) { return BadRequest($"Video Upload Error: {ex.Message}"); }
        }

        // ==========================================
        // 4. BATCH AUDIO UPLOAD (Clean Pipeline)
        // ==========================================
        [HttpPost("audio/batch")]
        public async Task<IActionResult> UploadAudioBatch([FromForm] List<IFormFile> files)
        {
            if (files == null || files.Count == 0) return BadRequest("No files provided");
            int uid = GetUserId();
            if (uid == 0) return Unauthorized("User not logged in");

            var results = new List<object>();

            foreach (var file in files)
            {
                if (file.Length == 0) continue;

                try
                {
                    string uniqueName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName).ToLower()}";
                    string cloudKey = $"audio/{uniqueName}";

                    string dbPath = await _fileService.SaveFileAsync(file, "Audio");
                    string physPath = _fileService.GetPhysicalPath(dbPath);
                    int duration = 0;

                    try
                    {
                        var meta = await _processor.ProcessAudioAsync(physPath, dbPath);
                        duration = (int)meta.DurationSeconds;
                    }
                    catch (Exception ex) { Console.WriteLine($"[Batch Upload] Audio processing failed for {file.FileName}: {ex.Message}"); }

                    // Upload Main File Only
                    await _fileService.UploadToCloudAsync(physPath, cloudKey);
                    await _fileService.DeleteLocalFileAsync(physPath);

                    // Insert with blank snippet
                    long newId = new InsertAudio().Execute(uid, file.FileName, cloudKey, "", duration);

                    // SECURE THE ASSET
                    using (var conn = new MySqlConnection(DBConn1.ConnectionString))
                    {
                        conn.Open();
                        string sql = "UPDATE media_audio SET visibility = 2 WHERE audio_id = @id";
                        using (var cmd = new MySqlCommand(sql, conn))
                        {
                            cmd.Parameters.AddWithValue("@id", newId);
                            cmd.ExecuteNonQuery();
                        }
                    }

                    string previewUrl = _resolver.ResolveUrl(cloudKey, 1);

                    results.Add(new
                    {
                        targetId = newId,
                        type = 1,
                        title = file.FileName,
                        url = previewUrl,
                        snippetPath = "", // Pass empty snippet path back to UI
                        isLocked = false,
                        price = (decimal?)null,
                        visibility = 2
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Batch Upload] Error saving {file.FileName}: {ex.Message}");
                }
            }

            return Ok(new { success = true, items = results });
        }
    }
}