using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.IO;
using MoozicOrb.Models;
using MoozicOrb.Services;
using MoozicOrb.Services.Interfaces;
using System;
using System.Linq;

namespace MoozicOrb.Controllers
{
    [ApiController]
    [Route("api/login")]
    public class LoginController : ControllerBase
    {
        private readonly ILoginService _loginService;

        public LoginController(ILoginService loginService)
        {
            _loginService = loginService;
        }

        // ==========================================
        // 1. LOGIN (Standard)
        // ==========================================
        [HttpPost]
        public IActionResult Login([FromForm] string username, [FromForm] string password)
        {
            // 1. Authenticate via Service
            int userId = _loginService.Login(username, password);
            if (userId <= 0)
                return Unauthorized(new { message = "Invalid credentials" });

            // 2. Set ASP.NET Session (Legacy/Backup)
            HttpContext.Session.SetInt32("UserId", userId);

            // 3. Create Custom App Session
            var session = SessionStore.CreateSession(userId);

            return Ok(new { sessionId = session.SessionId, userId = session.UserId });
        }

        // ==========================================
        // 2. LOGOUT
        // ==========================================
        [HttpPost("logout")]
        public IActionResult Logout([FromForm] string sessionId)
        {
            if (string.IsNullOrEmpty(sessionId))
                return BadRequest(new { message = "Missing sessionId" });

            _loginService.Logout(sessionId);
            return Ok(new { message = "Logged out" });
        }

        // ==========================================
        // 3. BOOTSTRAP (Session Validation)
        // ==========================================
        [HttpGet("bootstrap")]
        public IActionResult Bootstrap([FromHeader(Name = "X-Session-Id")] string sessionId)
        {
            if (string.IsNullOrEmpty(sessionId)) return Unauthorized();

            // 1. Check Session Cache
            var session = SessionStore.GetSession(sessionId);
            if (session == null) return Unauthorized();

            // Refresh Activity
            //session.LastActive = DateTime.UtcNow;

            // 2. Get User Details
            var user = new UserQuery().GetUserById(session.UserId);
            if (user == null) return Unauthorized();

            // 3. Parse Group IDs (from CSV)
            // This allows the frontend to know which SignalR groups to join immediately
            var groupIds = (user.UserGroups ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(g =>
                {
                    if (long.TryParse(g.Trim(), out long id)) return id;
                    return 0L;
                })
                .Where(id => id > 0)
                .ToList();

            return Ok(new
            {
                userId = user.UserId,
                username = user.UserName,
                groups = groupIds
            });
        }
    }
}








