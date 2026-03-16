using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.IO;
using MoozicOrb.Models;
using MoozicOrb.Services;
using MoozicOrb.Services.Interfaces;
using MoozicOrb.API.Services; // NEW: Added for IMediaResolverService
using System;
using System.Linq;

namespace MoozicOrb.Controllers
{
    [ApiController]
    [Route("api/login")]
    public class LoginController : ControllerBase
    {
        private readonly ILoginService _loginService;
        private readonly IMediaResolverService _resolver; // NEW: Injecting the resolver

        // NEW: Updated constructor to accept the resolver
        public LoginController(ILoginService loginService, IMediaResolverService resolver)
        {
            _loginService = loginService;
            _resolver = resolver;
        }

        // NEW: Helper to safely resolve R2 keys into full URLs (Matches CreatorController)
        private string SafeResolve(string urlOrKey)
        {
            if (string.IsNullOrEmpty(urlOrKey)) return urlOrKey;
            if (urlOrKey.StartsWith("/") || urlOrKey.StartsWith("http")) return urlOrKey;
            return _resolver.ResolveUrl(urlOrKey, 1);
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

            var session = SessionStore.GetSession(sessionId);
            if (session == null) return Unauthorized();

            var user = new UserQuery().GetUserById(session.UserId);
            if (user == null) return Unauthorized();

            var groupIds = (user.UserGroups ?? "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(g => long.Parse(g.Trim()))
                .ToList();

            // 1. Grab the raw string
            string finalAvatar = user.ProfilePic;

            // 2. Validate for bad data
            if (string.IsNullOrWhiteSpace(finalAvatar) || finalAvatar == "null" || finalAvatar == "undefined")
            {
                finalAvatar = "/img/profile_default.jpg";
            }
            // 3. Resolve the path properly using the injected resolver
            else
            {
                finalAvatar = SafeResolve(finalAvatar);
            }

            return Ok(new
            {
                userId = user.UserId,
                groups = groupIds,
                avatarUrl = finalAvatar
            });
        }
    }
}







