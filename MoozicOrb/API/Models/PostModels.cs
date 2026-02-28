using System;
using System.Collections.Generic;

namespace MoozicOrb.API.Models
{
    // ==================================================================================
    // POSTS & FEED MODELS
    // Used for transferring post data between the API (PostController) and the UI.
    // ==================================================================================

    /// <summary>
    /// Represents a single post on a feed (Timeline, Group, State Page, etc.).
    /// This is a "Polymorphic" DTO, meaning it holds data for ALL post types 
    /// (Status, Article, Classified, etc.), but some fields will be null depending on the type.
    /// </summary>
    public class PostDto
    {
        // --- Core Identity ---
        public long Id { get; set; }
        public int AuthorId { get; set; }

        public int? ViewerId { get; set; } // The ID of the user viewing this post (for Like status)
        public string AuthorName { get; set; }
        public string AuthorPic { get; set; }

        // --- Context ---
        public string ContextType { get; set; }
        public string ContextId { get; set; }

        // --- Content ---
        public string Type { get; set; }
        public string Title { get; set; }
        public string Text { get; set; }
        public string ImageUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedAgo { get; set; }

        // --- Polymorphic Extras ---
        public decimal? Price { get; set; }
        public string LocationLabel { get; set; }
        public string DifficultyLevel { get; set; }
        public string VideoUrl { get; set; }
        public long? MediaId { get; set; }
        public string Category { get; set; }

        // --- NEW: Engagement Data (The missing pieces) ---
        public bool IsLiked { get; set; }      // Did the current user like this?
        public int LikesCount { get; set; }    // Total likes
        public int CommentsCount { get; set; } // Total comments
        public int? Quantity { get; set; }

        public List<MediaAttachmentDto> Attachments { get; set; } = new List<MediaAttachmentDto>();
    }

    /// <summary>
    /// Represents a single item inside a Post's gallery (e.g., one photo in a carousel).
    /// </summary>
    public class MediaAttachmentDto
    {
        public long MediaId { get; set; }   // ID of the media record
        public int MediaType { get; set; }  // Enum Code: 1=Audio, 2=Video, 3=Image
        public string? Url { get; set; }     // The full URL to the file (populated during GET)

        public string? SnippetPath { get; set; }
    }


    // ==================================================================================
    // COLLECTIONS MODELS
    // Used for creating Albums, Playlists, or Bundles.
    // ==================================================================================

    public class CreateCollectionRequest
    {
        public string Title { get; set; }
        public string Description { get; set; }
        public int Type { get; set; }
        public string DisplayContext { get; set; } // NEW: "audio", "video", "image", "store", "showcase"
        public long CoverImageId { get; set; }

        public List<ApiCollectionItemRequest> Items { get; set; }
    }

    public class ApiCollectionDto
    {
        public long Id { get; set; }
        public int UserId { get; set; }        // NEW: Allows the UI to know who owns this
        public string Title { get; set; }
        public string Description { get; set; }
        public int Type { get; set; }
        public string DisplayContext { get; set; }
        public long CoverImageId { get; set; }
        public string CoverImageUrl { get; set; }
        public decimal? Price { get; set; }           // For Bundles/Storefronts
        public bool IsLocked { get; set; }              // For Bundles/Storefronts
        public int Visibility { get; set; }             // For Albums/Playlists (1=Public, 2=Private, 3=Unlisted)

        public List<ApiCollectionItemDto> Items { get; set; }
    }


    /// <summary>
    /// Represents a pointer to a specific piece of media to add to a collection.
    /// </summary>
    public class ApiCollectionItemRequest
    {
        public long TargetId { get; set; }      // The ID of the Media file (Song/Video)
        public int TargetType { get; set; }     // 1=MediaFile (Expandable for other types later)
    }

    /// <summary>
    /// A resolved item inside a collection, ready for the Player.
    /// </summary>
    public class ApiCollectionItemDto
    {
        public long LinkId { get; set; }        // NEW: The PK from collection_items
        public long TargetId { get; set; }
        public int TargetType { get; set; }
        public string Title { get; set; }
        public string Url { get; set; }

        // --- ADDED: Required for the UI Player to render track data ---
        public string ArtUrl { get; set; }
        public string ArtistName { get; set; }
        public decimal? Price { get; set; }
        public int Visibility { get; set; }
        public bool IsLocked { get; set; }
    }

    public class CommentDto
    {
        public long CommentId { get; set; }
        public long PostId { get; set; }
        public long? ParentId { get; set; }
        public int UserId { get; set; }
        public string AuthorName { get; set; }
        public string AuthorPic { get; set; }
        public string Content { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedAgo { get; set; }
        public List<CommentDto> Replies { get; set; } = new List<CommentDto>();
    }

    public class CreateCommentDto
    {
        public long PostId { get; set; }
        public string Content { get; set; }
        public long? ParentId { get; set; }
    }

    public class LikeDto
    {
        public long PostId { get; set; }
        public bool Liked { get; set; }
    }

    public class UpdatePostDto
    {
        public string? Title { get; set; }
        public string? Text { get; set; }
        public decimal? Price { get; set; }
        public string? LocationLabel { get; set; }
        public string? DifficultyLevel { get; set; }
        public int? Quantity { get; set; }
        public List<MediaAttachmentDto>? MediaAttachments { get; set; }
    }
}