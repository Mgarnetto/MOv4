using Microsoft.AspNetCore.Mvc;
using MoozicOrb.IO;
using MoozicOrb.Models;
using MoozicOrb.Services;
using MoozicOrb.Extensions;
using MoozicOrb.API.Services; // NEW: Added for IMediaResolverService
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MoozicOrb.Controllers
{
    public class CreatorController : Controller
    {
        private readonly NotificationService _notify;
        private readonly UserQuery _userQuery;
        private readonly IMediaResolverService _resolver; // NEW: Injecting the resolver

        // NEW: Updated constructor to accept the resolver
        public CreatorController(NotificationService notify, IMediaResolverService resolver)
        {
            _userQuery = new UserQuery();
            _notify = notify;
            _resolver = resolver;
        }

        // NEW: Helper to prevent resolving local/default images via Cloudflare
        private string SafeResolve(string urlOrKey)
        {
            if (string.IsNullOrEmpty(urlOrKey)) return urlOrKey;
            if (urlOrKey.StartsWith("/") || urlOrKey.StartsWith("http")) return urlOrKey;
            return _resolver.ResolveUrl(urlOrKey, 1);
        }

        // ==========================================
        // 1. "My Profile" Route (/creator/profile)
        // ==========================================
        [HttpGet("creator/profile")]
        public IActionResult MyProfile()
        {
            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            int currentUserId = session?.UserId ?? 0;

            if (currentUserId == 0)
            {
                if (Request.IsSpaRequest() || Request.Headers["X-Spa-Request"] == "true")
                {
                    return Unauthorized();
                }
                return RedirectToAction("Index", "Home");
            }

            return Index(currentUserId);
        }

        // ==========================================
        // 2. Specific User Route (/creator/105)
        // ==========================================
        [HttpGet("creator/{id:int}")]
        public IActionResult Index(int id)
        {
            var user = _userQuery.GetUserById(id);
            if (user == null || user.UserId == 0) return NotFound();

            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            int currentUserId = session?.UserId ?? 0;
            bool isMe = (currentUserId == id);

            var counts = new GetFollowCounts().Execute(id);
            bool isFollowing = false;

            if (!isMe && currentUserId > 0)
            {
                isFollowing = new IsFollowing().Execute(currentUserId, id);
            }

            var model = new CreatorViewModel
            {
                UserId = user.UserId,
                DisplayName = user.DisplayName ?? user.UserName,
                UserName = user.UserName,
                // CHANGED: Resolving Profile and Cover Images
                ProfilePic = SafeResolve(user.ProfilePic),
                CoverImage = SafeResolve(user.CoverImageUrl),
                Bio = user.Bio,
                IsCurrentUser = isMe,
                LayoutOrder = user.LayoutOrder ?? new List<string>(),
                SignalRGroup = $"user_{user.UserId}",
                Collections = new List<CollectionDto>(),
                FollowersCount = counts.Followers,
                FollowingCount = counts.Following,
                IsFollowing = isFollowing,
                PrimaryRole = user.AccountTypePrimaryName,
                SecondaryRole = user.AccountTypeSecondaryName
            };

            if (Request.IsSpaRequest() || Request.Headers["X-Spa-Request"] == "true")
            {
                return PartialView("_ProfilePartial", model);
            }

            return View("Index", model);
        }

        // ==========================================
        // 3. Sidebar Info Endpoint (UPDATED)
        // ==========================================
        [HttpGet("api/creator/sidebar-info")]
        public IActionResult GetSidebarInfo()
        {
            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            int currentUserId = session?.UserId ?? 0;

            if (currentUserId == 0) return Unauthorized();

            var user = _userQuery.GetUserById(currentUserId);
            if (user == null) return NotFound();

            var counts = new GetFollowCounts().Execute(currentUserId);

            return Ok(new
            {
                name = user.DisplayName ?? user.UserName,
                // CHANGED: Resolving the sidebar profile picture
                pic = SafeResolve(user.ProfilePic) ?? "/img/profile_default.jpg",
                followers = counts.Followers,
                following = counts.Following
            });
        }

        // ==========================================
        // 4. FOLLOW ACTION API
        // ==========================================
        [HttpPost("api/creator/follow/{id}")]
        public async Task<IActionResult> FollowUser(int id)
        {
            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            int currentUserId = session?.UserId ?? 0;

            if (currentUserId == 0) return Unauthorized();

            bool success = new InsertFollow().Execute(currentUserId, id);

            if (success)
            {
                await _notify.SendStatsUpdate(id);
                await _notify.SendStatsUpdate(currentUserId);
            }

            return Ok(new { success });
        }

        [HttpPost("api/creator/unfollow/{id}")]
        public async Task<IActionResult> UnfollowUser(int id)
        {
            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            int currentUserId = session?.UserId ?? 0;

            if (currentUserId == 0) return Unauthorized();

            bool success = new DeleteFollow().Execute(currentUserId, id);

            if (success)
            {
                await _notify.SendStatsUpdate(id);
                await _notify.SendStatsUpdate(currentUserId);
            }

            return Ok(new { success });
        }

        // ==========================================
        // 5. Storefront Destination Route (/creator/105/store)
        // ==========================================
        [HttpGet("creator/{id:int}/store")]
        public IActionResult Storefront(int id)
        {
            var user = _userQuery.GetUserById(id);
            if (user == null || user.UserId == 0) return NotFound();

            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            int currentUserId = session?.UserId ?? 0;
            bool isMe = (currentUserId == id);

            var model = new CreatorViewModel
            {
                UserId = user.UserId,
                DisplayName = user.DisplayName ?? user.UserName,
                UserName = user.UserName,
                // CHANGED: Resolving Profile Image
                ProfilePic = SafeResolve(user.ProfilePic),
                IsCurrentUser = isMe,
                SignalRGroup = $"user_{user.UserId}"
            };

            if (Request.IsSpaRequest() || Request.Headers["X-Spa-Request"] == "true")
            {
                return PartialView("_StorefrontPartial", model);
            }

            return RedirectToAction("Index", "Home");
        }

        // ==========================================
        // 6. Photo Gallery Destination Route (/creator/105/photos)
        // ==========================================
        [HttpGet("creator/{id:int}/photos")]
        public IActionResult PhotoGallery(int id)
        {
            var user = _userQuery.GetUserById(id);
            if (user == null || user.UserId == 0) return NotFound();

            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            bool isMe = ((session?.UserId ?? 0) == id);

            var model = new CreatorViewModel
            {
                UserId = user.UserId,
                DisplayName = user.DisplayName ?? user.UserName,
                // CHANGED: Resolving Profile Image
                ProfilePic = SafeResolve(user.ProfilePic),
                IsCurrentUser = isMe,
                SignalRGroup = $"user_{user.UserId}"
            };

            if (Request.IsSpaRequest() || Request.Headers["X-Spa-Request"] == "true")
                return PartialView("_PhotoGalleryPartial", model);

            return View("PhotoGallery", model);
        }

        // ==========================================
        // 7. Video Hub Destination Route (/creator/105/videos)
        // ==========================================
        [HttpGet("creator/{id:int}/videos")]
        public IActionResult VideoHub(int id)
        {
            var user = _userQuery.GetUserById(id);
            if (user == null || user.UserId == 0) return NotFound();

            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            bool isMe = ((session?.UserId ?? 0) == id);

            var model = new CreatorViewModel
            {
                UserId = user.UserId,
                DisplayName = user.DisplayName ?? user.UserName,
                // CHANGED: Resolving Profile Image
                ProfilePic = SafeResolve(user.ProfilePic),
                IsCurrentUser = isMe,
                SignalRGroup = $"user_{user.UserId}"
            };

            if (Request.IsSpaRequest() || Request.Headers["X-Spa-Request"] == "true")
                return PartialView("_VideoHubPartial", model);

            return View("VideoHub", model);
        }

        // ==========================================
        // Audio Destination Route (/creator/105/audio)
        // ==========================================
        [HttpGet("creator/{id:int}/audio")]
        public IActionResult Audio(int id)
        {
            var user = _userQuery.GetUserById(id);
            if (user == null || user.UserId == 0) return NotFound();

            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            int currentUserId = session?.UserId ?? 0;
            bool isMe = (currentUserId == id);

            var model = new CreatorViewModel
            {
                UserId = user.UserId,
                DisplayName = user.DisplayName ?? user.UserName,
                UserName = user.UserName,
                ProfilePic = SafeResolve(user.ProfilePic),
                IsCurrentUser = isMe,
                SignalRGroup = $"user_{user.UserId}"
            };

            if (Request.IsSpaRequest() || Request.Headers["X-Spa-Request"] == "true")
            {
                return PartialView("_AudioPartial", model);
            }

            // Fallback for hard refreshes 
            return View("Audio", model);
        }
    }
}
