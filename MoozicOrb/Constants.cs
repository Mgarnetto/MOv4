using Microsoft.Extensions.Hosting;
using MoozicOrb.Models;

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
        public const int Image = 7;        // Was "image"
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
        public const int VideoCarousel = 9;  // (NOT USED YET, Relies on featured display context) Featured Video Profile Carousel
        public const int ImageCarousel = 10; // Featured Image Profile Carousel

        // --- COMMERCE / OFFICIAL RELEASES (Monetized) ---
        public const int AudioAlbum = 7;     // Official Monetized Audio Album/EP
        public const int VideoSeries = 8;    // Official Monetized Video Series/Season
    }

    namespace MoozicOrb.Constants
    {
        /// <summary>
        /// Master Taxonomy for the Orbital Engine (9-Digit DNA System).
        /// Format: [T] [XXX] [YYY] [ZZ]
        /// T = Origin, XXX = Dominant Parent, YYY = Fusion Parent, ZZ = PostType (Format)
        /// Max DB Integer: 2,147,483,647. Our max: 999,999,999.
        /// </summary>
        public static class OrbitalTaxonomy
        {
            /// <summary>
            /// The [T] Digit (100-Millions place). Defines how the number was generated.
            /// </summary>
            public static class Origins
            {
                public const int ManualAudio = 1;         // Creator explicitly tagged an audio genre
                public const int MachineAudioNovel = 2;   // Machine discovered a completely new audio cluster
                public const int MachineAudioHybrid = 3;  // Machine fused two known audio genres
                public const int ManualSocial = 7;        // Inherited from Creator's Account Type
                public const int MachineSocialHybrid = 8; // Machine fused a visual/social culture
                public const int SystemAdmin = 9;         // Master overrides/Hardcoded collections
            }

            /// <summary>
            /// The [XXX] and [YYY] Digits (100-Thousands and 100s places). 
            /// Base cultures and roles. Values 000-999.
            /// </summary>
            public static class MasterBases
            {
                // ==========================================
                // AUDIO SPECTRUM (001 - 499)
                // ==========================================

                // --- Urban / Rhythm Block (010 - 049) ---
                public const int HipHop = 10;
                public const int Rap = 11;
                public const int Trap = 12;
                public const int Drill = 13;
                public const int RnB = 20;
                public const int NeoSoul = 21;
                public const int Soul = 22;
                public const int Funk = 30;
                public const int Disco = 31;

                // --- Electronic / Dance Block (050 - 099) ---
                public const int EDM = 50;
                public const int House = 51;
                public const int Techno = 52;
                public const int Trance = 53;
                public const int Dubstep = 54;
                public const int DrumAndBass = 55;
                public const int LoFi = 80;
                public const int Ambient = 81;

                // --- Pop / Rock / Alternative Block (100 - 149) ---
                public const int Pop = 100;
                public const int KPop = 101;
                public const int Rock = 110;
                public const int Alternative = 111;
                public const int Indie = 112;
                public const int Metal = 120;
                public const int Punk = 121;

                // --- Organic / Global Roots Block (150 - 199) ---
                public const int Country = 150;
                public const int Folk = 151;
                public const int Americana = 152;
                public const int Jazz = 160;
                public const int Blues = 161;
                public const int Reggae = 170;
                public const int Dancehall = 171;
                public const int Afrobeat = 172;
                public const int Latin = 180;
                public const int Reggaeton = 181;
                public const int WorldMusic = 190;

                // --- Composition / Acoustic Block (200 - 249) ---
                public const int Singer = 200;
                public const int Songwriter = 201;
                public const int Classical = 210;
                public const int Instrumental = 211;
                public const int Soundtrack = 220;
                public const int Score = 221;

                // --- Spiritual / Faith Block (250 - 299) ---
                public const int Gospel = 250;
                public const int ChristianContemporary = 251; // CCM
                public const int Worship = 252;
                public const int ChristianHipHop = 260;
                public const int ChristianRock = 261;

                // ==========================================
                // SOCIAL / CREATOR SPECTRUM (500 - 999)
                // ==========================================

                // --- The Studio Block (Creation & Performance) (500 - 599) ---
                public const int Producer = 500;
                public const int Artist = 501;
                public const int Engineer = 502;
                public const int Writer = 503;
                public const int Instrumentalist = 504;
                public const int DJ = 505;

                // --- The Aesthetic Block (Visuals & Motion) (600 - 699) ---
                public const int Photographer = 600;
                public const int Videographer = 601;
                public const int GraphicDesign = 602;
                public const int FashionDesign = 603;
                public const int Apparel = 604;
                public const int Stylist = 605;
                public const int Choreographer = 606;

                // --- The Hustle Block (Business & Industry) (700 - 799) ---
                public const int Promoter = 700;
                public const int EntertainmentLaw = 701;
                public const int Venue = 702;
                public const int ArtistDevelopment = 703;
                public const int RecordLabel = 704;
                public const int Manager = 705;
                public const int Publicist = 706;
                public const int Distributor = 707;

                // --- The Discourse Block (Media & Education) (800 - 899) ---
                public const int Blogger = 800;
                public const int Critic = 801;
                public const int Educator = 802;
                public const int Podcaster = 803;

                // --- The Consumer Block (Read-Only) (900 - 999) ---
                public const int Enthusiast = 900;
                public const int Listener = 901;
            }

            /// <summary>
            /// Utility to dynamically generate the 9-Digit DNA Plate for the database.
            /// </summary>
            /// <param name="origin">From OrbitalTaxonomy.Origins</param>
            /// <param name="dominantBase">From OrbitalTaxonomy.MasterBases</param>
            /// <param name="fusionBase">From OrbitalTaxonomy.MasterBases (Use 0 for Pure)</param>
            /// <param name="postType">From Constants.PostTypes</param>
            /// <returns>A 9-Digit Integer (e.g. 101300006)</returns>
            public static int GeneratePlate(int origin, int dominantBase, int fusionBase, int postType)
            {
                // Calculation: 
                // Origin * 100,000,000
                // DominantBase * 100,000
                // FusionBase * 100
                // PostType (Formats up to 99 max)

                return (origin * 100000000) +
                       (dominantBase * 100000) +
                       (fusionBase * 100) +
                       postType;
            }

            /// <summary>
            /// Utility to decode a 9-Digit Plate back into its constituent parts.
            /// </summary>
            public static (int Origin, int Dominant, int Fusion, int PostType) DecodePlate(int plateId)
            {
                int origin = plateId / 100000000;
                int dominant = (plateId / 100000) % 1000;
                int fusion = (plateId / 100) % 1000;
                int postType = plateId % 100;

                return (origin, dominant, fusion, postType);
            }
        }

        // ==========================================================================================
        // ARCHITECTURE REFERENCE: THE ORBITAL "GRAVITY" ENGINE (v2.1)
        // ==========================================================================================
        // This is pseudo-code to serve as a mental model for MoozicOrb developers. 
        // It explains how the 9-Digit taxonomy is utilized dynamically in the database.
        // Do not instantiate this interface. It is purely for documentation.

        /// <summary>
        /// The 4-Phase Lifecycle of MoozicOrb's Unsupervised Recommendation Engine.
        /// </summary>
        public interface IOrbitalEngineWorkflow
        {
            /// <summary>
            /// PHASE 1: THE LIQUID STATE (Data Ingestion)
            /// Untagged posts enter the system with no permanent DNA. 
            /// We log raw human behavior to figure out what the post is.
            /// </summary>
            /// <remarks>
            /// - Captures: Plays, Skips, Likes, and View Durations.
            /// - Trust Multiplier: A User's TrustScore (0-100) dictates the weight of their interaction.
            /// - The Math: If User A interacts with Post 1 and Post 2, the relational "Gravity" 
            ///   between those two posts increases in the PostGravity database table.
            /// </remarks>
            void Phase1_LogMicrogravity(int userId, int postId, int duration, int userTrustScore);

            /// <summary>
            /// PHASE 2: SOLIDIFICATION (The Freeze & Fusion)
            /// Runs via Background Worker. Converts expensive graph math into cheap integers.
            /// </summary>
            /// <remarks>
            /// - Identifies clumps of posts with high relational Gravity.
            /// - Calculates the Dominant Base (XXX) and Fusion Base (YYY) based on user overlap.
            /// - Checks TaxonomyLedger. If this hybrid DNA is new, it generates a new 9-Digit plate.
            /// - CRITICAL: Assigns the new 9-Digit Plate to the posts and DELETES their raw PostGravity 
            ///   tracking rows to permanently save database CPU.
            /// </remarks>
            void Phase2_FreezeClustersAndAssignDNA(List<int> untaggedPostIds);

            /// <summary>
            /// PHASE 3: THE FEED MIXER (Delivery)
            /// Located in DiscoverController. Zips feeds together using Proximity Math.
            /// </summary>
            /// <remarks>
            /// Executes a single, fast UNION ALL SQL query:
            /// - 35% Social Graph (Who they follow)
            /// - 25% Core Plate (Long-term 9-Digit DNA, protected by Logarithmic Decay)
            /// - 25% Radar Plate (Hyper-recent 24-hour DNA)
            /// - 15% Orbit Plate (Tangential Machine Hybrids for discovery)
            /// </remarks> 
            /// 
            //  Example of how the feed query might look in DiscoverController:
            //  List<Post> Phase3_GenerateDiscoverFeed(int userId, int userCorePlate, int userRadarPlate);

            /// <summary>
            /// PHASE 4: THE TRIPWIRE (Self-Healing Concept Drift)
            /// Automatically detects if a post's cultural context has shifted.
            /// </summary>
            /// <remarks>
            /// - Compares the post's 'OriginalTrace' (Birth DNA) against its 'DriftBuffer' 
            ///   (a JSON array of the last 50 users who interacted with it).
            /// - If the Mode of the DriftBuffer conflicts with the OriginalTrace, the wire trips.
            /// - The post's Plate is stripped, and it is thrown back into Phase 1 (Liquid State) 
            ///   to let gravity find its new audience.
            /// </remarks>
            void Phase4_DetectDriftAndRemelt(int postId, int originalTrace, string driftBufferJson);
        }
    }
}