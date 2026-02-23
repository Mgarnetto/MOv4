class SpaRouter {
    constructor() {
        this.rootElement = document.getElementById("mainContent");
        this.currentGroup = null;

        window.addEventListener("popstate", () => {
            this.loadHtml(window.location.pathname);
        });

        document.body.addEventListener("click", (e) => {
            const link = e.target.closest("a");
            if (link &&
                link.href.startsWith(window.location.origin) &&
                !link.getAttribute("target") &&
                !link.href.includes("#") &&
                !link.classList.contains("no-spa")
            ) {
                e.preventDefault();
                this.navigate(link.getAttribute("href"));
            }
        });
    }

    navigate(url) {
        window.history.pushState(null, null, url);
        this.loadHtml(url);
    }

    async loadHtml(url) {
        this.rootElement.style.opacity = "0.5";
        this.rootElement.style.pointerEvents = "none";

        try {
            const res = await fetch(url, {
                headers: {
                    "X-Spa-Request": "true",
                    "X-Session-Id": window.AuthState?.sessionId || ""
                }
            });

            if (res.ok) {
                const html = await res.text();

                this.rootElement.innerHTML = html;
                this.rootElement.style.opacity = "1";
                this.rootElement.style.pointerEvents = "auto";
                window.scrollTo(0, 0);

                // 1. Close Sidebar on Navigation
                const sidebar = document.getElementById('sidebar');
                if (sidebar && sidebar.classList.contains('active')) {
                    sidebar.classList.remove('active');
                    document.body.classList.remove('sidebar-open');
                }

                // 2. Handle SignalR Context (FeedService)
                const contextEl = document.getElementById("page-signalr-context");
                if (contextEl && window.FeedService) {
                    const newGroup = contextEl.value;
                    if (this.currentGroup !== newGroup) {
                        if (this.currentGroup) window.FeedService.leaveGroup(this.currentGroup);
                        window.FeedService.joinGroup(newGroup);
                        this.currentGroup = newGroup;
                    }
                }

                // 3. Re-initialize page-specific scripts
                this.reinitScripts();

            } else {
                this.rootElement.innerHTML = "<div class='section'><h3>Error loading content.</h3></div>";
                this.rootElement.style.opacity = "1";
                this.rootElement.style.pointerEvents = "auto";
            }
        } catch (err) {
            console.error("Router Error:", err);
            this.rootElement.style.opacity = "1";
            this.rootElement.style.pointerEvents = "auto";
        }
    }

    reinitScripts() {
        try {
            // A. Globe
            if (document.getElementById("chartdiv") && window.initGlobe) {
                window.initGlobe();
            }

            // B. Calendar
            if (document.querySelector(".calendar-box") && window.initCalendar) {
                window.initCalendar();
            }

            // C. Settings Pages
            if (window.location.pathname.includes("/settings") && window.initSettings) {
                window.initSettings();
            }

            // D. Social Feed Loader & Carousel Loader
            const feedContainer = document.getElementById("feed-stream-container");
            const storeCarouselContainer = document.getElementById("store-carousel-container");
            const contextEl = document.getElementById("page-signalr-context");

            if (contextEl) {
                const groupValue = contextEl.value;

                if (groupValue === 'feed_global') {
                    if (feedContainer && window.loadFeedHistory) {
                        window.loadFeedHistory('global', '0');
                    }
                }
                else if (groupValue && groupValue.startsWith('user_')) {
                    const userId = groupValue.split('_')[1];

                    if (feedContainer && window.loadFeedHistory) {
                        window.loadFeedHistory('user', userId);
                    }

                    // CAROUSEL TRIGGER
                    if (storeCarouselContainer && window.loadStoreCarousel) {
                        window.loadStoreCarousel(userId);
                    }
                }
            }

            // E. Audio Discovery Loader (Playlist)
            const audioContainer = document.getElementById("audio-feed-list");
            if (audioContainer && window.loadAudioPlaylist) {
                window.loadAudioPlaylist();
            }

            // F. Storefront Loader
            const storefrontContainer = document.getElementById("storefront-grid-container");
            const storefrontUserIdEl = document.getElementById("storefront-user-id");

            if (storefrontContainer && storefrontUserIdEl && window.loadStorefront) {
                const userId = storefrontUserIdEl.value;
                window.loadStorefront(userId);
            }

            // G. Photo Gallery Loader
            const photoContainer = document.getElementById("photo-gallery-container");
            const galleryUserIdEl = document.getElementById("gallery-user-id");

            if (photoContainer && galleryUserIdEl && window.loadPhotoGallery) {
                const userId = galleryUserIdEl.value;
                window.loadPhotoGallery(userId);
            }

            // H. Video Hub Loader
            const videoContainer = document.getElementById("video-hub-container");
            const videoUserIdEl = document.getElementById("video-user-id");

            if (videoContainer && videoUserIdEl && window.loadVideoHub) {
                const userId = videoUserIdEl.value;
                window.loadVideoHub(userId);
            }

        } catch (err) {
            console.error("Initialization error in router:", err);
        }
    }
}

// Start Engine
window.AppRouter = new SpaRouter();

// NEW: Guarantee the loaders fire on a hard refresh of the browser
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => window.AppRouter.reinitScripts(), 100);
    });
} else {
    setTimeout(() => window.AppRouter.reinitScripts(), 100);
}