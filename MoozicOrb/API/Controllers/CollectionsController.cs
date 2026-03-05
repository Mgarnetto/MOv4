using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.Collections.Generic;
using MySql.Data.MySqlClient;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/collections")]
    public class CollectionsController : ControllerBase
    {
        private readonly IHttpContextAccessor _http;
        private readonly IMediaResolverService _resolver;
        private readonly IMediaFileService _mediaFileService;

        public CollectionsController(IHttpContextAccessor http, IMediaResolverService resolver, IMediaFileService mediaFileService)
        {
            _http = http;
            _resolver = resolver;
            _mediaFileService = mediaFileService;
        }

        private int GetUserId()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            if (string.IsNullOrEmpty(sid)) throw new UnauthorizedAccessException();
            var session = SessionStore.GetSession(sid);
            if (session == null) throw new UnauthorizedAccessException();
            return session.UserId;
        }

        [HttpPost("create")]
        public IActionResult CreateCollection([FromBody] CreateCollectionRequest req)
        {
            try
            {
                int userId = GetUserId();
                long collectionId = 0;

                // ADDED ProfileCarousel to the 1-to-1 Upsert logic
                if (req.DisplayContext == "store" || req.DisplayContext == "video" || req.DisplayContext == "image" || req.DisplayContext == "ProfileCarousel")
                {
                    collectionId = new UpsertContextCollection().Execute(userId, req.Title, req.Description, req.Type, req.DisplayContext, req.CoverImageId);

                    // Wipe the old list of items inside this collection
                    new ClearCollectionItems().Execute(collectionId);
                }
                else
                {
                    // Standard insert for generic playlists/albums where a user can have infinite amounts
                    collectionId = new InsertCollection().Execute(userId, req.Title, req.Description, req.Type, req.DisplayContext, req.CoverImageId);
                }

                // Insert the fresh items with their new sort order
                if (req.Items != null && req.Items.Count > 0)
                {
                    var itemIo = new InsertCollectionItem();
                    int sort = 0;
                    foreach (var item in req.Items)
                    {
                        itemIo.Execute(collectionId, item.TargetId, item.TargetType, sort++);
                    }
                }

                return Ok(new { id = collectionId, success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("{id}")]
        public IActionResult GetCollection(long id)
        {
            try
            {
                var collection = new GetCollectionDetails().Execute(id, _resolver);
                if (collection == null) return NotFound("Collection not found.");

                return Ok(collection);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("user/{userId}/context/{displayContext}")]
        public IActionResult GetUserCollectionsByContext(int userId, string displayContext)
        {
            try
            {
                var results = new List<ApiCollectionDto>();

                using (var conn = new MySqlConnection(DBConn1.ConnectionString))
                {
                    conn.Open();
                    string sql = @"
                        SELECT c.*, img.file_path as cover_url 
                        FROM collections c 
                        LEFT JOIN media_images img ON c.cover_image_id = img.image_id 
                        WHERE c.user_id = @uid AND c.display_context = @ctx
                        ORDER BY c.created_at DESC";

                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@uid", userId);
                        cmd.Parameters.AddWithValue("@ctx", displayContext);

                        using (var rdr = cmd.ExecuteReader())
                        {
                            while (rdr.Read())
                            {
                                string coverUrl = rdr["cover_url"] == DBNull.Value ? "/img/default_cover.jpg" : rdr["cover_url"].ToString();
                                if (!coverUrl.StartsWith("/")) coverUrl = "/" + coverUrl;

                                results.Add(new ApiCollectionDto
                                {
                                    Id = rdr.GetInt64("collection_id"),
                                    UserId = rdr.GetInt32("user_id"),
                                    Title = rdr["title"].ToString(),
                                    Description = rdr["description"].ToString(),
                                    Type = rdr.GetInt32("collection_type"),
                                    DisplayContext = rdr["display_context"].ToString(),
                                    CoverImageUrl = coverUrl
                                });
                            }
                        }
                    }
                }

                return Ok(results);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpGet("mine")]
        public IActionResult GetMyCollections([FromQuery] int type)
        {
            try
            {
                // Require the user to be logged in to pull "mine"
                int userId = GetUserId();

                var results = new GetUserCollectionsByType().Execute(userId, type, true);

                return Ok(results);
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPut("{id}")]
        public IActionResult UpdateCollection(long id, [FromBody] CreateCollectionRequest req)
        {
            try
            {
                int userId = GetUserId();

                // APPLICATION-LEVEL SECURITY PRE-CHECK
                if (!new CheckCollectionOwner().Execute(id, userId)) return StatusCode(403, "Access denied.");

                bool success = new UpdateCollection().Execute(id, userId, req.Title, req.Description, req.Type, req.DisplayContext, req.CoverImageId);

                if (!success) return BadRequest("Update failed.");
                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("{id}")]
        public IActionResult DeleteCollection(long id)
        {
            try
            {
                var sid = HttpContext.Request.Headers["X-Session-Id"].ToString();
                var session = MoozicOrb.Services.SessionStore.GetSession(sid);
                if (session == null) return Unauthorized();

                // Fire the new IO class
                var result = new MoozicOrb.IO.DeleteCollection().Execute(id, session.UserId);

                if (!result.Success) return BadRequest(result.ErrorMessage);

                // FIRE THE CLOUDFLARE WRECKING BALL FOR ORPHANED ARTWORK!
                if (result.PathsToDelete != null && result.PathsToDelete.Count > 0)
                {
                    _ = _mediaFileService.DeleteMediaFilesAsync(result.PathsToDelete, result.StorageProvider);
                }

                return Ok(new { success = true });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("{id}/add-item")]
        public IActionResult AddItem(long id, [FromBody] ApiCollectionItemRequest req)
        {
            try
            {
                int userId = GetUserId();

                // APPLICATION-LEVEL SECURITY PRE-CHECK
                if (!new CheckCollectionOwner().Execute(id, userId)) return StatusCode(403, "Access denied.");

                var itemIo = new InsertCollectionItem();
                itemIo.Execute(id, req.TargetId, req.TargetType, 999);

                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("items/{linkId}")]
        public IActionResult RemoveItem(long linkId, [FromQuery] long collectionId)
        {
            try
            {
                int userId = GetUserId();

                // Check ownership of the parent collection before allowing item removal
                if (!new CheckCollectionOwner().Execute(collectionId, userId)) return StatusCode(403, "Access denied.");

                new DeleteCollectionItem().Execute(linkId, collectionId);

                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPut("{id}/reorder")]
        public IActionResult ReorderCollectionItems(long id, [FromBody] List<long> linkIds)
        {
            try
            {
                int userId = GetUserId();

                // APPLICATION-LEVEL SECURITY PRE-CHECK
                if (!new CheckCollectionOwner().Execute(id, userId)) return StatusCode(403, "Access denied.");

                if (linkIds == null || linkIds.Count == 0) return Ok(new { success = true });

                var updateSortIo = new UpdateCollectionItemSort();

                // Loop through the array. The index (i) becomes the new sort_order.
                for (int i = 0; i < linkIds.Count; i++)
                {
                    updateSortIo.Execute(linkIds[i], i);
                }

                return Ok(new { success = true });
            }
            catch (UnauthorizedAccessException) { return Unauthorized(); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }
    }
}