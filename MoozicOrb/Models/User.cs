using System;
using System.Collections.Generic;
using System.Text.Json;

namespace MoozicOrb.Models
{
    public class User
    {
        public int UserId { get; set; }
        public string FirstName { get; set; }
        public string MiddleName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string UserName { get; set; }
        public string DisplayName { get; set; }
        public string ProfilePic { get; set; }
        public string CoverImageUrl { get; set; }
        public string Bio { get; set; }
        public bool IsCreator { get; set; }
        public string UserGroups { get; set; } = "9";
        public string ProfileLayoutJson { get; set; }

        // --- NEW INTEGER COLUMNS ---
        public DateTime? Dob { get; set; }

        // --- UPDATED LOCATION FIELDS ---
        public int? CountryId { get; set; }
        public string CountryName { get; set; } // e.g. "United States"

        public int? StateId { get; set; }
        public string StateName { get; set; }   // e.g. "Georgia"

        // Account Types (ID for logic, Name for display)
        public int? AccountTypePrimary { get; set; }
        public string AccountTypePrimaryName { get; set; } // e.g. "Producer"

        public int? AccountTypeSecondary { get; set; }
        public string AccountTypeSecondaryName { get; set; }

        // Genres (ID for logic, Name for display)
        public int? GenrePrimary { get; set; }
        public string GenrePrimaryName { get; set; } // e.g. "Jazz"

        public int? GenreSecondary { get; set; }
        public string GenreSecondaryName { get; set; }

        public int VisibilityId { get; set; } = 0;
        public string BookingEmail { get; set; }
        public string PhoneMain { get; set; }
        public string PhoneBooking { get; set; }

        public string PublicName => !string.IsNullOrEmpty(DisplayName) ? DisplayName : $"{FirstName} {LastName}".Trim();

        public List<string> LayoutOrder
        {
            get
            {
                if (string.IsNullOrEmpty(ProfileLayoutJson)) return new List<string> { "posts", "music", "store" };
                try { return JsonSerializer.Deserialize<List<string>>(ProfileLayoutJson); }
                catch { return new List<string> { "posts", "music", "store" }; }
            }
        }
    }
}