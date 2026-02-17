using Microsoft.AspNetCore.Mvc;
using MoozicOrb.Extensions;
using MoozicOrb.Models;
using MoozicOrb.IO;
using MoozicOrb.Services;
using MoozicOrb.Services.Interfaces;
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

        public SettingsController(IUserAuthService authService)
        {
            _userQuery = new UserQuery();
            _authService = authService;
        }

        private int GetUserId()
        {
            string sid = Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            return session?.UserId ?? HttpContext.Session.GetInt32("UserId") ?? 0;
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

            // Populate Dropdowns
            ViewBag.AccountTypes = _userQuery.GetAccountTypes();
            ViewBag.Genres = _userQuery.GetGenres();

            var model = new PageSettingsViewModel
            {
                Bio = user.Bio,
                CoverImage = user.CoverImageUrl,
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
                model.CoverImage,
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

            // --- CRITICAL ADDITION: Populate Location Dropdowns ---
            // Note: You need to ensure _userQuery has these methods or create a LocationIO helper.
            // Assuming _userQuery can now fetch locations based on our previous discussions.
            // If not, you'll need to add GetCountries() to UserQuery.cs

            // 1. Always get countries
            ViewBag.Countries = new MoozicOrb.IO.LocationIO().GetCountries();

            // 2. Only get states if a country is selected
            if (user.CountryId.HasValue)
            {
                ViewBag.States = new MoozicOrb.IO.LocationIO().GetStates(user.CountryId.Value);
            }

            var model = new AccountSettingsViewModel
            {
                DisplayName = user.DisplayName,
                Email = user.Email,
                ProfilePic = user.ProfilePic,
                Dob = user.Dob,

                // Updated Mapping
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

            // Updated to pass Country and State separately
            bool success = updateIo.UpdateAccountSettings(
                userId,
                model.DisplayName,
                model.Dob,
                model.CountryId, // Changed from LocationId
                model.StateId,   // Added StateId
                model.PhoneMain,
                model.VisibilityId
            );

            return Ok(new { success = success });
        }

        // ... (Avatar Update remains unchanged) ...
        [HttpPost("update-avatar")]
        public IActionResult UpdateAvatar([FromBody] dynamic req)
        {
            int userId = GetUserId();
            if (userId == 0) return Unauthorized();

            string url = req.GetProperty("url").ToString();
            var updateIo = new UpdateUser();
            bool success = updateIo.UpdateProfilePic(userId, url);

            return Ok(new { success });
        }
    }
}
