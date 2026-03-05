namespace MoozicOrb.Constants
{
    /// <summary>
    /// Master Reference for Feed Post Types.
    /// Maps directly to the 'post_type' column in the 'posts' table.
    /// </summary>
    public static class PostTypes
    {
        public const int Standard = 1;     // Was "post"
        public const int Tutorial = 2;     // Was "tutorial"
        public const int Merch = 3;        // Was "merch"
        public const int Classified = 4;   // Was "classified"
        public const int Article = 5;      // Was "article"
        public const int Video = 6;        // Was "video"
    }

    /// <summary>
    /// Master Reference for Feed Contexts (Where the post lives).
    /// Maps directly to the 'context_type' column in the 'posts' table.
    /// </summary>
    public static class ContextTypes
    {
        public const int User = 1;         // Was "user"
        public const int Group = 2;        // Was "group"
        public const int Page = 3;         // Was "page_profile"
    }

    /// <summary>
    /// Master Reference for Marketplace Target Types.
    /// Maps directly to the 'target_type' column in the 'marketplace_offers' table.
    /// </summary>
    public static class MarketplaceTargetTypes
    {
        // --- COLLECTIONS & BUNDLES ---
        public const int Collection = 0;   // Monetized Albums (Type 7), Video Series (Type 8)

        // --- SINGULAR DIGITAL MEDIA ---
        public const int AudioTrack = 1;   // Individual Song, Beat, or Podcast Episode
        public const int Video = 2;        // Premium Video, Short Film, or Course Lesson
        public const int Image = 3;        // Premium Digital Art, High-Res Photography

        // --- E-COMMERCE & PHYSICAL ---
        public const int PhysicalMerch = 4; // T-Shirts, Vinyl, Hoodies (Often requires shipping/quantity)

        // --- FUTURE EXPANSION (Ideas for later) ---
        public const int EventTicket = 5;  // Pay-Per-View Livestream Access, Digital Concert Ticket
        public const int Subscription = 6; // Recurring Monthly Fan-Club or Channel Subscription
        public const int DigitalMisc = 7;  // PDFs, Zip Files, E-Books, Sheet Music, Preset Packs
    }

    /// <summary>
    /// Master Reference for Marketplace License Types.
    /// Maps directly to the 'license_type' column in the 'marketplace_offers' table.
    /// </summary>
    public static class MarketplaceLicenseTypes
    {
        public const int Standard = 1;     // Personal use, standard streaming, or physical purchase
        public const int Commercial = 2;   // Royalty-free use (e.g., background music for YouTube/Twitch)
        public const int Exclusive = 3;    // Full buyout, exclusive rights (e.g., selling a beat with stems)
    }

    /// <summary>
    /// Master Reference for Collection Types used across the MoozicOrb database.
    /// Do not alter these integers as they are hard-mapped to database rows.
    /// </summary>
    public static class CollectionTypes
    {
        // --- PERSONAL / ORGANIZATIONAL (Free) ---
        public const int Playlist = 2;       // User-created Audio Playlist
        public const int VideoGallery = 3;   // Free/Personal Video Collection
        public const int ImageGallery = 4;   // Photo Albums / Digital Booklets

        // --- PROFILE UI CAROUSELS (Docks) ---
        public const int MerchCarousel = 5;  // Featured Merch Storefront Carousel
        public const int AudioCarousel = 6;  // Featured Audio Profile Carousel

        // --- COMMERCE / OFFICIAL RELEASES (Monetized) ---
        public const int AudioAlbum = 7;     // Official Monetized Audio Album/EP
        public const int VideoSeries = 8;    // Official Monetized Video Series/Season
    }
}