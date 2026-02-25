using Microsoft.AspNetCore.Mvc;
using MoozicOrb.Extensions;
using MoozicOrb.Models;
using MoozicOrb.IO;
using MoozicOrb.Services;
using MoozicOrb.Services.Interfaces;
using MoozicOrb.API.Services; // NEW: Added to use IMediaResolverService
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using System.Collections.Generic;

namespace MoozicOrb.Controllers
{
    [Route("settings")]
    public class SettingsController : Controller
    {
        private readonly UserQuery _userQuery;
        private readonly IUserAuthService _authService;
        private readonly IMediaResolverService _resolver; // NEW: Injecting the resolver

        public SettingsController(IUserAuthService authService, IMediaResolverService resolver)
        {
            _userQuery = new UserQuery();
            _authService = authService;
            _resolver = resolver;
        }

        private int GetUserId()
        {
            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            return session?.UserId ?? HttpContext.Session.GetInt32("UserId") ?? 0;
        }

        // Helper to prevent resolving local/default images via Cloudflare
        private string SafeResolve(string urlOrKey)
        {
            if (string.IsNullOrEmpty(urlOrKey)) return urlOrKey;
            if (urlOrKey.StartsWith("/") || urlOrKey.StartsWith("http")) return urlOrKey;
            return _resolver.ResolveUrl(urlOrKey, 1);
        }

        // ------------------------------------
        // PAGE SETTINGS (Bio, Cover, Artist Info)
        // ------------------------------------
        [HttpGet("page")]
        public IActionResult Page()
        {
            int userId = GetUserId();
            if (userId == 0) return RedirectToAction("Index", "Home");

            var user = _userQuery.GetUserById(userId);
            if (user == null) return NotFound();

            ViewBag.AccountTypes = _userQuery.GetAccountTypes();
            ViewBag.Genres = _userQuery.GetGenres();

            var model = new PageSettingsViewModel
            {
                Bio = user.Bio,
                CoverImage = SafeResolve(user.CoverImageUrl), // NEW: Resolving Cover Art
                BookingEmail = user.BookingEmail,
                LayoutOrder = user.LayoutOrder,
                PhoneBooking = user.PhoneBooking,
                AccountTypePrimary = user.AccountTypePrimary,
                AccountTypeSecondary = user.AccountTypeSecondary,
                GenrePrimary = user.GenrePrimary,
                GenreSecondary = user.GenreSecondary
            };

            if (Request.IsSpaRequest()) return PartialView("_PageSettingsPartial", model);
            return RedirectToAction("Index", "Home");
        }

        [HttpPost("update-page")]
        public IActionResult UpdatePage([FromBody] PageSettingsViewModel model)
        {
            int userId = GetUserId();
            if (userId == 0) return Unauthorized();

            var updateIo = new UpdateUser();

            string json = model.LayoutOrder != null ?
                          System.Text.Json.JsonSerializer.Serialize(model.LayoutOrder) :
                          "[]";

            bool success = updateIo.UpdatePageSettings(
                userId,
                model.Bio,
                model.CoverImage, // Receives the raw cloudKey from JS
                model.BookingEmail,
                json,
                model.PhoneBooking,
                model.AccountTypePrimary,
                model.AccountTypeSecondary,
                model.GenrePrimary,
                model.GenreSecondary
            );

            if (success) return Ok(new { success = true });
            return BadRequest("Failed.");
        }

        // ------------------------------------
        // ACCOUNT SETTINGS (Avatar, Password, Personal Info)
        // ------------------------------------
        [HttpGet("account")]
        public IActionResult Account()
        {
            int userId = GetUserId();
            if (userId == 0) return RedirectToAction("Index", "Home");

            var user = _userQuery.GetUserById(userId);

            ViewBag.Countries = new MoozicOrb.IO.LocationIO().GetCountries();

            if (user.CountryId.HasValue)
            {
                ViewBag.States = new MoozicOrb.IO.LocationIO().GetStates(user.CountryId.Value);
            }

            var model = new AccountSettingsViewModel
            {
                DisplayName = user.DisplayName,
                Email = user.Email,
                ProfilePic = SafeResolve(user.ProfilePic), // NEW: Resolving Profile Pic
                Dob = user.Dob,
                CountryId = user.CountryId,
                StateId = user.StateId,
                PhoneMain = user.PhoneMain,
                VisibilityId = user.VisibilityId
            };

            if (Request.IsSpaRequest()) return PartialView("_AccountSettingsPartial", model);
            return RedirectToAction("Index", "Home");
        }

        [HttpPost("update-account")]
        public IActionResult UpdateAccount([FromBody] AccountSettingsViewModel model)
        {
            int userId = GetUserId();
            if (userId == 0) return Unauthorized();

            var updateIo = new UpdateUser();

            bool success = updateIo.UpdateAccountSettings(
                userId,
                model.DisplayName,
                model.Dob,
                model.CountryId,
                model.StateId,
                model.PhoneMain,
                model.VisibilityId
            );

            return Ok(new { success = success });
        }

        [HttpPost("update-avatar")]
        public IActionResult UpdateAvatar([FromBody] dynamic req)
        {
            int userId = GetUserId();
            if (userId == 0) return Unauthorized();

            string url = req.GetProperty("url").ToString(); // Receives raw cloudKey from JS
            var updateIo = new UpdateUser();
            bool success = updateIo.UpdateProfilePic(userId, url);

            return Ok(new { success });
        }
    }
}
