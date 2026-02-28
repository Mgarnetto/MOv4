using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services; // <-- ADDED for IMediaResolverService
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.Collections.Generic;
using MySql.Data.MySqlClient;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/notifications")]
    public class NotificationsController : ControllerBase
    {
        private readonly IHttpContextAccessor _http;
        private readonly IMediaResolverService _resolver; // <-- ADDED

        // <-- ADDED resolver to DI constructor
        public NotificationsController(IHttpContextAccessor http, IMediaResolverService resolver)
        {
            _http = http;
            _resolver = resolver;
        }

        private int GetUserId()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            if (session == null) throw new UnauthorizedAccessException();
            return session.UserId;
        }

        [HttpGet]
        public IActionResult GetNotifications()
        {
            try
            {
                int userId = GetUserId();
                var io = new NotificationIO();

                // <-- PASSED resolver to IO method
                var list = io.GetUnread(userId, _resolver);
                return Ok(list);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("mark-read")]
        public IActionResult MarkAllRead()
        {
            try
            {
                int userId = GetUserId();
                string sql = "UPDATE notifications SET is_read = 1 WHERE user_id = @uid";

                using (var conn = new MySqlConnection(DBConn1.ConnectionString))
                {
                    conn.Open();
                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@uid", userId);
                        cmd.ExecuteNonQuery();
                    }
                }
                return Ok();
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }
    }
}
