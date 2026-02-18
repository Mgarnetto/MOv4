using MoozicOrb.API.Models;
using System.Collections.Generic;

namespace MoozicOrb.Models
{
    // ==========================================
    // 1. BASE VIEW MODEL
    // ==========================================
    // Every page that needs realtime updates inherits this
    public class BaseSignalRViewModel
    {
        public string SignalRGroup { get; set; } = "global";
    }

    // ==========================================
    // 2. PAGE SPECIFIC MODELS
    // ==========================================

    public class HomeViewModel : BaseSignalRViewModel
    {
    }

    public class LocationViewModel : BaseSignalRViewModel
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public List<ArtistDto> TopArtists { get; set; } = new();
    }

    public class CreatorViewModel : BaseSignalRViewModel
    {
        public int UserId { get; set; }
        public string DisplayName { get; set; }
        public string UserName { get; set; } // Added for URL generation
        public string ProfilePic { get; set; }
        public string CoverImage { get; set; }
        public string Bio { get; set; }

        // --- NEW FIELDS FOR LOGIC ---
        public bool IsCurrentUser { get; set; } // True if viewing own profile
        public List<string> LayoutOrder { get; set; } = new List<string>(); // ["posts", "music", "store"]

        public List<CollectionDto> Collections { get; set; } = new();

        public int FollowersCount { get; set; }
        public int FollowingCount { get; set; }
        public bool IsFollowing { get; set; } // True if the Viewer follows this Creator
    }

    public class PageViewModel : BaseSignalRViewModel
    {
        public string Title { get; set; }
    }

    public class RadioViewModel : BaseSignalRViewModel
    {
        public SongDto CurrentSong { get; set; }
        public List<SongDto> History { get; set; } = new();
    }

    public class GenresViewModel : BaseSignalRViewModel
    {
        public List<GenreDto> Genres { get; set; } = new();
    }

    // ==========================================
    // 3. SETTINGS MODELS
    // ==========================================

    // Inside MoozicOrb/Models/ViewModels.cs

    public class PageSettingsViewModel
    {
        public string Bio { get; set; }
        public string CoverImage { get; set; }
        public string BookingEmail { get; set; }
        public System.Collections.Generic.List<string> LayoutOrder { get; set; } = new List<string>();

        public string PhoneBooking { get; set; }

        // CHANGED: int -> int? (Nullable)
        public int? AccountTypePrimary { get; set; }
        public int? AccountTypeSecondary { get; set; }
        public int? GenrePrimary { get; set; }
        public int? GenreSecondary { get; set; }
    }

    public class AccountSettingsViewModel
    {
        public string DisplayName { get; set; }
        public string Email { get; set; }
        public string ProfilePic { get; set; }

        // --- ADDITIONS ---
        public System.DateTime? Dob { get; set; }

        // Updated Location Logic
        public int? CountryId { get; set; }
        public int? StateId { get; set; }

        public string PhoneMain { get; set; }
        public int VisibilityId { get; set; }
    }

    // ==========================================
    // 4. DATA TRANSFER OBJECTS (DTOs)
    // ==========================================
    // These represent the small chunks of data inside lists

    public class Location
    {
        public int Id { get; set; }
        public int? ParentId { get; set; } // Null for Countries, Set for States
        public string Name { get; set; }
        public string Code { get; set; }   // e.g. "US", "GA"
    }

    public class ArtistDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Pic { get; set; }
    }

    public class CollectionDto
    {
        public long Id { get; set; }
        public string Title { get; set; }
        public string Description { get; set; }
        public string ArtUrl { get; set; }
        public int Type { get; set; } // 0=Album, 1=Playlist, etc.
        public long CoverImageId { get; set; }

        // ADDED: The list of tracks
        public List<CollectionItemDto> Items { get; set; } = new List<CollectionItemDto>();
    }

    // ADDED: The Track/Item Definition
    public class CollectionItemDto
    {
        public long TargetId { get; set; }
        public int TargetType { get; set; } // 1=Audio
        public string Title { get; set; }
        public string Url { get; set; }     // File path
        public string ArtUrl { get; set; }
        public string ArtistName { get; set; }
    }

    public class GenreDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Color { get; set; }     // Hex Code
        public string IconClass { get; set; } // FontAwesome class
    }

    public class SongDto
    {
        public int Id { get; set; }
        public string Title { get; set; }
        public string Artist { get; set; }
        public string CoverArt { get; set; }
    }

    // Add to Models/ViewModels.cs

    public class SearchViewModel : BaseSignalRViewModel
    {
        public string Query { get; set; }
        public List<User> Users { get; set; } = new();
        public List<PostDto> Posts { get; set; } = new();
    }
}
