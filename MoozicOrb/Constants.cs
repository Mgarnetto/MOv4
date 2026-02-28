namespace MoozicOrb.Constants
{
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