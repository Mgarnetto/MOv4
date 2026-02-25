/* =========================================
   GLOBAL VARIABLES
   ========================================= */
let globeRoot = null; // Track the amCharts instance to dispose of it later

/* =========================================
   GLOBAL UTILITIES
   ========================================= */

// NEW: Time Ago Helper (Client-side calculation)
window.timeAgo = function (dateString) {
    if (!dateString) return 'Just now';

    // Ensure date ends with 'Z' to treat as UTC if missing, preventing timezone offset errors
    if (typeof dateString === 'string' && !dateString.endsWith('Z') && !dateString.includes('+')) {
        dateString += 'Z';
    }

    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";

    return "Just now";
};

// =========================================
// GLOBAL INIT FUNCTIONS (Called by Router)
// =========================================

window.initGlobe = function () {
    const chartDiv = document.getElementById('chartdiv');

    // 1. Safety Checks
    if (!chartDiv) return;
    if (typeof am5 === 'undefined') return;

    // 2. CRITICAL: Dispose of the previous instance if it exists.
    if (globeRoot) {
        globeRoot.dispose();
        globeRoot = null;
    }

    // 3. Prevent double-initialization
    if (chartDiv.innerHTML !== "") return;

    am5.ready(function () {
        var root = am5.Root.new("chartdiv");
        globeRoot = root;

        root.setThemes([am5themes_Animated.new(root)]);

        var chart = root.container.children.push(am5map.MapChart.new(root, {
            panX: "rotateX",
            panY: "rotateY",
            projection: am5map.geoOrthographic(),
            paddingBottom: 20, paddingTop: 20, paddingLeft: 20, paddingRight: 20
        }));

        var polygonSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {
            geoJSON: am5geodata_worldLow
        }));

        polygonSeries.mapPolygons.template.setAll({
            fill: am5.color(0x333333),
            stroke: am5.color(0x00AEEF),
            strokeWidth: 0.5,
            interactive: true
        });

        polygonSeries.mapPolygons.template.states.create("hover", {
            fill: am5.color(0x00AEEF),
            stroke: am5.color(0xffffff)
        });

        var backgroundSeries = chart.series.push(am5map.MapPolygonSeries.new(root, {}));
        backgroundSeries.mapPolygons.template.setAll({
            fill: am5.color(0x000000),
            fillOpacity: 0.1,
            strokeOpacity: 0
        });
        backgroundSeries.data.push({
            geometry: am5map.getGeoRectangle(90, 180, -90, -180)
        });

        chart.animate({
            key: "rotationX",
            from: 0,
            to: 360,
            duration: 30000,
            loops: Infinity
        });

        chart.appear(1000, 100);
    });
};

window.initCalendar = function () {
    const daysBox = document.querySelector('.cal-days');
    const monthLabel = document.querySelector('.cal-month-label');
    const prevBtn = document.querySelector('.prev-month');
    const nextBtn = document.querySelector('.next-month');

    if (!daysBox) return;

    let calendarDate = new Date();

    const eventsDB = [
        { date: '2026-01-15', time: '8:00 PM', title: 'Studio Session', loc: 'Atlanta, GA' },
        { date: '2026-01-22', time: '10:00 PM', title: 'Live Stream', loc: 'Twitch.tv' }
    ];

    function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        if (monthLabel) monthLabel.textContent = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        daysBox.innerHTML = '';

        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDayIndex; i++) {
            const d = document.createElement('div');
            d.className = 'day-cell dim';
            daysBox.appendChild(d);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const d = document.createElement('div');
            d.className = 'day-cell';
            d.textContent = i;

            const checkDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            if (eventsDB.some(e => e.date === checkDate)) {
                d.classList.add('has-event');
            }

            d.onclick = () => {
                document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('active'));
                d.classList.add('active');
                updateEvents(year, month, i);
            };

            daysBox.appendChild(d);
        }
    }

    function updateEvents(y, m, d) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const list = document.querySelector('.events-list-container');

        const selWeekday = document.querySelector('.sel-weekday');
        const selFullDate = document.querySelector('.sel-full-date');
        const dateObj = new Date(y, m, d);

        if (selWeekday) selWeekday.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        if (selFullDate) selFullDate.textContent = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        if (!list) return;

        list.innerHTML = '';
        const evts = eventsDB.filter(e => e.date === dateStr);

        if (evts.length === 0) {
            list.innerHTML = '<div style="color:#666">No events scheduled.</div>';
        } else {
            evts.forEach(e => {
                list.innerHTML += `
                    <div class="event-entry">
                        <div class="evt-time">${e.time}</div>
                        <div class="evt-title">${e.title}</div>
                        <div style="font-size:0.8rem; color:#888">${e.loc}</div>
                    </div>`;
            });
        }
    }

    if (prevBtn) {
        prevBtn.onclick = () => {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderCalendar();
        };
    }
    if (nextBtn) {
        nextBtn.onclick = () => {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderCalendar();
        };
    }

    renderCalendar();
    updateEvents(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate());
};

// =========================================
// DOM CONTENT LOADED (Runs Once)
// =========================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. SIDEBAR TOGGLE
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const body = document.body;

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            body.classList.toggle('sidebar-open');
        });
    }

    document.addEventListener('click', (e) => {
        if (sidebar && toggleBtn && !sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
            body.classList.remove('sidebar-open');
        }
    });

    // 2. LOGIN DROPDOWN LOGIC
    const loginBtn = document.getElementById('loginToggleBtn');
    const loginDropdown = document.getElementById('loginDropdown');
    const signupRadio = document.getElementById('signupRadio');
    const loginRadio = document.getElementById('loginRadio');
    const formInner = document.querySelector('.form-inner');
    const switchToSignupLink = document.getElementById('switchToSignup');

    if (loginBtn && loginDropdown) {
        loginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loginDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!loginDropdown.contains(e.target) && e.target !== loginBtn) {
                loginDropdown.classList.remove('active');
            }
        });

        if (signupRadio && loginRadio && formInner) {
            signupRadio.addEventListener('change', () => { formInner.style.marginLeft = "-100%"; });
            loginRadio.addEventListener('change', () => { formInner.style.marginLeft = "0%"; });

            if (switchToSignupLink) {
                switchToSignupLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    signupRadio.checked = true;
                    formInner.style.marginLeft = "-100%";
                });
            }
        }
    }

    // 3. CHAT OVERLAY LOGIC
    const messagesTrigger = document.getElementById('messages-trigger');
    const chatOverlay = document.getElementById('chatOverlay');
    const closeChatWindowBtn = document.getElementById('closeOverlayWindow');
    const closeChatSidebarBtn = document.getElementById('closeOverlaySidebar');
    const chatContainer = document.querySelector('.chat-app-container');
    const chatBackBtn = document.getElementById('chatBackBtn');

    if (messagesTrigger && chatOverlay) {
        messagesTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            chatOverlay.classList.add('active');
            if (sidebar) {
                sidebar.classList.remove('active');
                body.classList.remove('sidebar-open');
            }
        });

        const closeAll = () => {
            chatOverlay.classList.remove('active');
            if (chatContainer) chatContainer.classList.remove('conversation-active');
        };

        if (closeChatWindowBtn) closeChatWindowBtn.addEventListener('click', closeAll);
        if (closeChatSidebarBtn) closeChatSidebarBtn.addEventListener('click', closeAll);

        if (chatBackBtn) {
            chatBackBtn.addEventListener('click', () => {
                if (chatContainer) chatContainer.classList.remove('conversation-active');
            });
        }
    }

    // 4. INITIALIZE VIEW SCRIPTS (First Load)
    window.initGlobe();
    window.initCalendar();
});

// =========================================
// GLOBAL SEARCH FUNCTIONS
// =========================================

// Triggered by "GO" button or Enter Key
window.triggerGlobalSearch = function () {
    const input = document.getElementById('globalSearchInput');
    const term = input.value.trim();

    if (term) {
        // 1. Navigate
        if (window.AppRouter) {
            window.AppRouter.navigate(`/discover/search?q=${encodeURIComponent(term)}`);
        } else {
            window.location.href = `/discover/search?q=${encodeURIComponent(term)}`;
        }

        // 2. FORCE CLOSE SIDEBAR (Mobile Fix)
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('sidebarToggle');

        if (sidebar) sidebar.classList.remove('active');
        if (toggle) toggle.classList.remove('active'); // Reset hamburger icon
        document.body.classList.remove('sidebar-open');

        // Blur input to hide mobile keyboard
        input.blur();
    }
};

// Bind to Input Keydown
window.handleGlobalSearch = function (e) {
    if (e.key === 'Enter') {
        window.triggerGlobalSearch();
    }
};

/* =========================================
   SCROLL SYNC MANAGER
   Hides player when scrolling, reveals after delay.
   ========================================= */
const ScrollSync = {
    elements: ['#globalPlayerBar'], // Add other IDs here if you want them to hide too
    scrollTimer: null,
    isScrolling: false,

    init() {
        // Passive listener for better performance
        window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
    },

    handleScroll() {
        // 1. If we weren't scrolling before, HIDE immediately
        if (!this.isScrolling) {
            this.toggleElements(true); // true = hide
            this.isScrolling = true;
        }

        // 2. Clear the timer (reset the countdown)
        clearTimeout(this.scrollTimer);

        // 3. Set timer for 0.8s (800ms) AFTER scroll stops
        this.scrollTimer = setTimeout(() => {
            this.toggleElements(false); // false = show
            this.isScrolling = false;
        }, 800);
    },

    toggleElements(shouldHide) {
        this.elements.forEach(selector => {
            const el = document.querySelector(selector);
            if (el) {
                if (shouldHide) el.classList.add('player-hidden');
                else el.classList.remove('player-hidden');
            }
        });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    ScrollSync.init();
});

/* =========================================
SOCIAL FEED AUTO-RETRACTOR (SPA SAFE)
========================================= */
document.addEventListener('DOMContentLoaded', () => {

    // 1. Define the logic once
    const queueBannerRetraction = () => {
        const banner = document.getElementById('social-feed-banner');

        // Only run if:
        // a) The banner exists
        // b) It isn't already retracted
        // c) We haven't already queued the timer (checked via a custom data attribute)
        if (banner && !banner.classList.contains('retracted') && !banner.dataset.retractQueued) {

            // Mark it so we don't start 100 timers
            banner.dataset.retractQueued = "true";

            setTimeout(() => {
                banner.classList.add('retracted');
            }, 2000);
        }
    };

    // 2. Check immediately (For Ctrl+F5 / Hard Refresh)
    queueBannerRetraction();

    // 3. Create a "MutationObserver" (For SPA Navigation)
    // This watches the document for any new elements being added
    const observer = new MutationObserver((mutations) => {
        // Optimization: We only care if nodes were added
        const nodesAdded = mutations.some(m => m.addedNodes.length > 0);
        if (nodesAdded) {
            queueBannerRetraction();
        }
    });

    // Start watching the body (or your specific '#main-wrapper' if you prefer)
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});

/* =========================================
MODAL SCROLL LOCK MANAGER
Prevents background scrolling when modals are open
========================================= */
const ModalScrollManager = {
    // IDs of all the modals you want to lock scrolling for
    modalIds: [
        'chatOverlay',        // The main chat window
        'groupInfoModal',     // Group settings/management
        'createGroupModal',   // Create group
        'editPostModal',      // Edit post
        'singlePostModal',    // View single post
        'videoCallModal',     // Video call
        'incomingCallModal',  // Incoming call
        'orbSavePanel'   // playlist modal
    ],

    init() {
        const body = document.body;

        // Function to check if ANY of the modals are currently open
        const checkModals = () => {
            let isAnyOpen = false;

            this.modalIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    // Check if it has the 'active' class OR inline display style (not none)
                    const isActiveClass = el.classList.contains('active');
                    const isVisibleStyle = el.style.display && el.style.display !== 'none';

                    if (isActiveClass || isVisibleStyle) {
                        isAnyOpen = true;
                    }
                }
            });

            // Toggle the body class based on result
            if (isAnyOpen) {
                body.classList.add('no-scroll');
            } else {
                body.classList.remove('no-scroll');
            }
        };

        // Create an observer that watches for attribute changes (class or style)
        const observer = new MutationObserver(checkModals);

        // Attach observer to each modal
        this.modalIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
            }
        });
    }
};

// Initialize it when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ModalScrollManager.init();
});

// ============================================
// UNIVERSAL COLLECTIONS MANAGER (Phase 4 Upgrade)
// ============================================
window.OrbSavePanel = {
    currentPlayingUrl: null,
    currentPlayingLinkId: null,
    currentPlayingCollectionId: null,
    currentlyViewingCollectionId: null,

    // Memory Management
    cachedItems: {}, // Level 2 Cache: Holds JSON data OR pending Promises
    preloadQueue: [],
    isPreloading: false,

    // --- OPTIMIZATION 1: Sequential Background Loader ---
    processPreloadQueue: async function () {
        if (this.isPreloading) return;
        this.isPreloading = true;

        while (this.preloadQueue.length > 0) {
            const cId = this.preloadQueue.shift();

            if (!this.cachedItems[cId]) {
                try {
                    // Create the promise and store it in cache so the UI can attach to it if clicked early
                    const fetchPromise = fetch(`/api/collections/${cId}`, { headers: { "X-Session-Id": window.AuthState.sessionId } })
                        .then(r => r.ok ? r.json() : null)
                        .then(data => {
                            if (data) {
                                this.cachedItems[cId] = data; // Swap promise for real data
                                return data;
                            }
                        })
                        .catch(e => {
                            delete this.cachedItems[cId];
                        });

                    this.cachedItems[cId] = fetchPromise;

                    // Await it to prevent network queue flooding
                    await fetchPromise;
                } catch (e) { }
            }
        }
        this.isPreloading = false;
    },

    open: async function (targetId, targetType, displayContext) {
        const isViewMode = !targetId;

        document.getElementById('collectionTargetId').value = targetId || '';
        document.getElementById('collectionTargetType').value = targetType || 1;
        document.getElementById('collectionTargetContext').value = displayContext || 'audio';
        document.getElementById('newCollectionTitle').value = '';

        let fetchType = 5;
        let tType = targetType || 1;
        if (tType == 1) fetchType = 2; // Audio = Playlist
        if (tType == 2) fetchType = 3; // Video = Series
        if (tType == 3) fetchType = 4; // Image = Gallery

        const titleMap = { 'audio': 'My Playlists', 'video': 'My Watchlists', 'image': 'My Galleries', 'store': 'My Showcases' };
        const saveTitleMap = { 'audio': 'Save to Playlist', 'video': 'Save to Watchlist', 'image': 'Save to Gallery', 'store': 'Save to Showcase' };

        document.getElementById('orbSavePanelTitle').innerText = isViewMode
            ? (titleMap[displayContext || 'audio'] || 'My Collections')
            : (saveTitleMap[displayContext] || 'Save Media');

        document.getElementById('orbSaveOverlay').classList.remove('d-none');
        document.getElementById('orbSavePanel').classList.add('active');

        const listContainer = document.getElementById('existingCollectionsList');
        const footer = document.getElementById('orbSavePanelFooter');

        if (!window.AuthState?.userId) {
            listContainer.innerHTML = '<div class="text-muted small text-center mt-4">Please log in to organize your media.</div>';
            if (footer) footer.style.display = 'none';
            return;
        }

        if (footer) footer.style.display = 'flex';

        // 1. Level 1 Cache Read
        let collections = [];
        if (window.AuthState?.userCollections && window.AuthState.userCollections.length > 0) {
            collections = window.AuthState.userCollections.filter(c => c.type === fetchType || fetchType === 5);
        }

        if (collections.length === 0) {
            listContainer.innerHTML = '<div class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            try {
                const res = await fetch(`/api/collections/mine?type=${fetchType}`, {
                    headers: { "X-Session-Id": window.AuthState.sessionId }
                });
                if (res.ok) collections = await res.json();
            } catch (err) { console.error(err); }
        }

        listContainer.innerHTML = '';
        if (collections.length === 0) {
            listContainer.innerHTML = '<div class="text-muted small text-center mt-3">No folders yet. Create one below!</div>';
            return;
        }

        // --- OPTIMIZATION 2: Animation-Aware Preloader ---
        // Wait 400ms for the CSS sidebar transition to finish before hitting the network
        setTimeout(() => {
            const topPlaylists = collections.slice(0, 4); // Top 4 is lightweight
            topPlaylists.forEach(c => {
                if (!this.cachedItems[c.id] && !this.preloadQueue.includes(c.id)) {
                    this.preloadQueue.push(c.id);
                }
            });
            this.processPreloadQueue();
        }, 400);

        // 3. Render Level 1
        collections.forEach(c => {
            const isActiveFolder = (String(c.id) === String(this.currentPlayingCollectionId));
            const folderClass = isActiveFolder ? 'active-track' : '';
            const folderIcon = isActiveFolder ? '<i class="fas fa-volume-up text-info ms-2"></i>' : '';

            if (isViewMode) {
                listContainer.innerHTML += `
                    <div class="orb-save-panel-item ${folderClass}" onclick="window.OrbSavePanel.viewCollection('${c.id}')">
                        <img src="${c.coverImageUrl}" alt="cover" onerror="this.src='/img/default_cover.jpg'">
                        <span class="text-truncate" style="flex-grow: 1;">${c.title} ${folderIcon}</span>
                        <button class="orb-panel-play-btn" onclick="window.OrbSavePanel.playCollection('${c.id}'); event.stopPropagation();" title="Play Playlist">
                            <i class="fas fa-play" style="margin-left: 2px;"></i>
                        </button>
                    </div>
                `;
            } else {
                listContainer.innerHTML += `
                    <div class="orb-save-panel-item" onclick="window.OrbSavePanel.saveItem('${c.id}')">
                        <img src="${c.coverImageUrl}" alt="cover" onerror="this.src='/img/default_cover.jpg'">
                        <span class="text-truncate">${c.title}</span>
                        <i class="fas fa-plus text-muted" style="margin-left: auto;"></i>
                    </div>
                `;
            }
        });
    },

    viewCollection: async function (collectionId) {
        this.currentlyViewingCollectionId = collectionId;
        const listContainer = document.getElementById('existingCollectionsList');
        const footer = document.getElementById('orbSavePanelFooter');
        if (footer) footer.style.display = 'none';

        let collectionData = this.cachedItems[collectionId];

        // --- OPTIMIZATION 3: Promise Interception ---
        // If the item is currently fetching in the background, we cleanly attach to the active Promise
        if (collectionData && typeof collectionData.then === 'function') {
            listContainer.innerHTML = '<div class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            collectionData = await collectionData;
        }

        // Cache miss
        if (!collectionData) {
            listContainer.innerHTML = '<div class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            try {
                const res = await fetch(`/api/collections/${collectionId}`, {
                    headers: { "X-Session-Id": window.AuthState.sessionId }
                });
                if (res.ok) {
                    collectionData = await res.json();
                    this.cachedItems[collectionId] = collectionData;
                }
            } catch (err) { console.error(err); }
        }

        if (!collectionData) {
            listContainer.innerHTML = '<div class="text-danger small text-center mt-3">Error loading playlist.</div>';
            return;
        }

        const items = collectionData.items || collectionData.Items || [];
        document.getElementById('orbSavePanelTitle').innerText = collectionData.title || collectionData.Title || 'Playlist';

        let html = `<button class="orb-panel-back-btn" onclick="window.OrbSavePanel.open(null, 1, 'audio')">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>`;

        if (items.length === 0) {
            html += `<div class="text-muted small text-center mt-3">This folder is empty.</div>`;
        } else {
            html += `<div id="drag-drop-container" style="display: flex; flex-direction: column; gap: 5px;">`;

            items.forEach((item, index) => {
                const title = item.title || item.Title || 'Unknown Track';
                const artist = item.artistName || item.ArtistName || 'Unknown Artist';
                const coverRaw = item.artUrl || item.ArtUrl || '';
                const url = item.url || item.Url;
                const linkId = item.linkId || item.LinkId;
                const tType = item.targetType || item.TargetType;

                if (tType === 4) {
                    html += `
                        <div class="orb-save-panel-item track-item" onclick="window.OrbSavePanel.viewCollection('${item.targetId}')">
                            <i class="fas fa-folder text-info" style="font-size: 1.5rem; flex-shrink: 0; margin-right: 15px;"></i>
                            <div style="flex-grow: 1;">
                                <div class="text-truncate" style="font-weight: 600; color: #fff;">${title}</div>
                                <div class="text-truncate" style="font-size: 0.8rem; color: #aaa;">Collection</div>
                            </div>
                            <i class="fas fa-chevron-right text-muted"></i>
                        </div>`;
                    return;
                }

                let isActive = (this.currentPlayingLinkId && String(this.currentPlayingLinkId) === String(linkId));
                const activeClass = isActive ? 'active-track' : '';
                const iconClass = isActive ? 'fa-volume-up' : 'fa-play';

                // --- OPTIMIZATION 4: No-Glitch Image Logic ---
                let iconFallback = tType === 2 ? 'fa-video' : (tType === 3 ? 'fa-image' : 'fa-music');
                let coverHtml = '';

                if (coverRaw) {
                    coverHtml = `
                        <div style="flex-shrink: 0; width: 40px; height: 40px;">
                            <img src="${coverRaw}" alt="cover" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; margin: 0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div class="orb-panel-fallback-icon" style="display:none; width: 100%; height: 100%; align-items: center; justify-content: center; background: #333; border-radius: 6px; margin: 0;"><i class="fas ${iconFallback}"></i></div>
                        </div>`;
                } else {
                    coverHtml = `
                        <div style="flex-shrink: 0; width: 40px; height: 40px;">
                            <div class="orb-panel-fallback-icon" style="display:flex; width: 100%; height: 100%; align-items: center; justify-content: center; background: #333; border-radius: 6px; margin: 0;"><i class="fas ${iconFallback}"></i></div>
                        </div>`;
                }

                html += `
                    <div class="orb-save-panel-item track-item draggable-item ${activeClass}" 
                         draggable="true" 
                         data-link-id="${linkId}"
                         id="playlist-track-${linkId}"
                         style="padding-right: 10px;">
                        
                        <div style="display:flex; flex-grow:1; align-items:center; cursor: pointer; gap: 15px;" onclick="window.OrbSavePanel.playTrack('${url}', '${title.replace(/'/g, "\\'")}', '${artist.replace(/'/g, "\\'")}', '${coverRaw}', '${linkId}')">
                            <div class="prominent-play-btn" style="margin: 0;">
                                <i class="track-icon fas ${iconClass}"></i>
                            </div>
                            <div style="flex-grow: 1; overflow: hidden; text-align: left;">
                                <div class="text-truncate" style="font-weight: 600; color: #fff; font-size: 0.95rem;">${title}</div>
                                <div class="text-truncate" style="font-size: 0.8rem; color: #aaa; margin-top: 2px;">${artist}</div>
                            </div>
                            ${coverHtml}
                        </div>

                        <div style="position: relative; flex-shrink: 0; display: flex; align-items: center; padding-left: 10px;">
                            <button onclick="window.OrbSavePanel.toggleTrackMenu(event, '${linkId}')" style="background: transparent; border: none; outline: none; box-shadow: none; color: #ccc; padding: 5px 10px; cursor: pointer;">
                                <i class="fas fa-ellipsis-v" style="font-size: 1.1rem;"></i>
                            </button>
                            
                            <div id="menu-dropdown-${linkId}" class="shadow" style="display: none; position: absolute; right: 0; top: 100%; background: #222; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; z-index: 100; white-space: nowrap; overflow: hidden;">
                                <button style="padding: 12px 15px; text-align: left; background: transparent; border: none; outline: none; color: #ff4d4d; width: 100%; cursor: pointer; font-size: 0.9rem;" onclick="window.OrbSavePanel.executeRemove(event, '${linkId}', '${collectionId}', this)">
                                    <i class="fas fa-trash-alt me-2"></i> Remove
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        listContainer.innerHTML = html;
        this.initDragAndDrop(collectionId);
    },

    toggleTrackMenu: function (event, linkId) {
        event.stopPropagation();
        const menu = document.getElementById(`menu-dropdown-${linkId}`);
        const isCurrentlyOpen = menu.style.display === 'block';

        document.querySelectorAll('[id^="menu-dropdown-"]').forEach(el => el.style.display = 'none');

        if (!isCurrentlyOpen) {
            menu.style.display = 'block';
            const resetFn = () => {
                menu.style.display = 'none';
                document.removeEventListener('click', resetFn);
            };
            setTimeout(() => document.addEventListener('click', resetFn), 10);
        }
    },

    executeRemove: async function (event, linkId, collectionId, btn) {
        event.stopPropagation();
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Removing...';
        btn.disabled = true;

        try {
            const res = await fetch(`/api/collections/items/${linkId}?collectionId=${collectionId}`, {
                method: 'DELETE',
                headers: { "X-Session-Id": window.AuthState.sessionId }
            });
            if (res.ok) {
                const row = document.getElementById(`playlist-track-${linkId}`);
                if (row) row.remove();
                if (this.cachedItems[collectionId]) {
                    this.cachedItems[collectionId].items = this.cachedItems[collectionId].items.filter(i => String(i.linkId) !== String(linkId));
                }
            } else {
                alert("Failed to remove.");
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (e) {
            console.error(e);
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    initDragAndDrop: function (collectionId) {
        const container = document.getElementById('drag-drop-container');
        if (!container) return;

        let draggedItem = null;

        container.addEventListener('dragstart', e => {
            const targetItem = e.target.closest('.draggable-item');
            if (!targetItem) return;
            draggedItem = targetItem;
            targetItem.style.opacity = 0.5;
        });

        container.addEventListener('dragend', e => {
            const targetItem = e.target.closest('.draggable-item');
            if (!targetItem) return;
            targetItem.style.opacity = "";

            const newOrder = Array.from(container.querySelectorAll('.draggable-item')).map(el => parseInt(el.dataset.linkId));

            const cache = window.OrbSavePanel.cachedItems[collectionId];
            if (cache && cache.items) {
                cache.items.sort((a, b) => {
                    const idA = parseInt(a.linkId || a.LinkId);
                    const idB = parseInt(b.linkId || b.LinkId);
                    return newOrder.indexOf(idA) - newOrder.indexOf(idB);
                });
            }

            fetch(`/api/collections/${collectionId}/reorder`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState.sessionId },
                body: JSON.stringify(newOrder)
            }).catch(err => console.error("Reorder failed", err));
        });

        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                if (draggedItem) container.appendChild(draggedItem);
            } else {
                if (draggedItem) container.insertBefore(draggedItem, afterElement);
            }
        });
    },

    getDragAfterElement: function (container, y) {
        const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    syncActiveTrackUI: function (newLinkId) {
        this.currentPlayingLinkId = newLinkId;
        const allTracks = document.querySelectorAll('.orb-save-panel-item.track-item');
        allTracks.forEach(el => {
            el.classList.remove('active-track');
            const icon = el.querySelector('.track-icon');
            if (icon) icon.className = 'track-icon fas fa-play';
        });

        const activeEl = document.getElementById(`playlist-track-${newLinkId}`);
        if (activeEl) {
            activeEl.classList.add('active-track');
            const icon = activeEl.querySelector('.track-icon');
            if (icon) icon.className = 'track-icon fas fa-volume-up';
        }
    },

    playTrack: function (url, title, artist, cover, linkId = null) {
        let isMenuOpen = false;
        document.querySelectorAll('[id^="menu-dropdown-"]').forEach(el => {
            if (el.style.display === 'block') isMenuOpen = true;
        });
        if (isMenuOpen) return;

        this.currentPlayingUrl = url;
        this.currentPlayingLinkId = linkId;
        this.currentPlayingCollectionId = this.currentlyViewingCollectionId;

        this.syncActiveTrackUI(linkId);

        if (window.AudioPlayer) {
            const safeCover = (cover && cover.trim() !== '') ? cover : '/img/default_cover.jpg';

            const currentCollectionData = this.cachedItems[this.currentlyViewingCollectionId];
            if (currentCollectionData && currentCollectionData.items) {
                const items = currentCollectionData.items || currentCollectionData.Items;
                let startIndex = items.findIndex(i => String(i.linkId || i.LinkId) === String(linkId));

                if (startIndex !== -1 && startIndex < items.length - 1) {
                    const queueArray = items.slice(startIndex + 1).map(item => {
                        const iTitle = item.title || item.Title || 'Unknown Track';
                        const iArtist = item.artistName || item.ArtistName || 'Unknown Artist';
                        const iCover = item.artUrl || item.ArtUrl || '/img/default_cover.jpg';
                        const iUrl = item.url || item.Url;
                        const iLinkId = item.linkId || item.LinkId;
                        return { url: iUrl, title: iTitle, artist: iArtist, cover: iCover, linkId: iLinkId };
                    });
                    window.AudioPlayer.setQueue(queueArray);
                } else {
                    window.AudioPlayer.setQueue([]);
                }
            }

            window.AudioPlayer.playTrack(url, { title: title, artist: artist, cover: safeCover });
        }
    },

    playCollection: async function (collectionId) {
        this.currentPlayingCollectionId = collectionId;
        await this.viewCollection(collectionId);

        const items = this.cachedItems[collectionId]?.items || [];
        if (items.length > 0) {
            const first = items[0];
            const safeUrl = first.url || first.Url;
            const safeTitle = first.title || first.Title;
            const safeArtist = first.artistName || first.ArtistName;
            const safeArt = first.artUrl || first.ArtUrl;
            const safeId = first.linkId || first.LinkId;

            this.playTrack(safeUrl, safeTitle, safeArtist, safeArt, safeId);
        } else {
            alert("This playlist is empty.");
        }
    },

    close: function () {
        document.getElementById('orbSaveOverlay').classList.add('d-none');
        document.getElementById('orbSavePanel').classList.remove('active');

        // Note: We don't wipe the cache here anymore! 
        // We let the pre-fetched promises stay in memory for a lightning-fast reopening UX.
    },

    saveItem: async function (collectionId) {
        const targetId = document.getElementById('collectionTargetId').value;
        const targetType = document.getElementById('collectionTargetType').value;
        if (!targetId) return;

        try {
            const res = await fetch(`/api/collections/${collectionId}/add-item`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState.sessionId },
                body: JSON.stringify({ TargetId: parseInt(targetId), TargetType: parseInt(targetType) })
            });

            if (res.ok) {
                alert("Saved to collection!");
                delete this.cachedItems[collectionId];
                this.close();
            } else {
                alert("Failed to save.");
            }
        } catch (err) { console.error(err); }
    },

    createNew: async function () {
        if (!window.AuthState?.userId) {
            alert("You must be logged in to do this.");
            return;
        }

        const title = document.getElementById('newCollectionTitle').value.trim();
        if (!title) return;

        const targetId = document.getElementById('collectionTargetId').value;
        const targetType = document.getElementById('collectionTargetType').value;
        const displayContext = document.getElementById('collectionTargetContext').value;

        let colType = 5;
        if (targetType == 1) colType = 2;
        if (targetType == 2) colType = 3;
        if (targetType == 3) colType = 4;

        let itemsPayload = targetId ? [{ TargetId: parseInt(targetId), TargetType: parseInt(targetType) }] : [];

        try {
            const payload = { Title: title, Description: "", Type: colType, DisplayContext: displayContext, CoverImageId: 0, Items: itemsPayload };

            const res = await fetch('/api/collections/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState.sessionId },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert(targetId ? "Folder created and item saved!" : "Playlist created!");
                window.AuthState.userCollections = [];

                if (!targetId) this.open(null, targetType, displayContext);
                else this.close();
            } else {
                alert("Failed to create folder.");
            }
        } catch (err) { console.error(err); }
    }
};

window.closeCollectionModal = window.OrbSavePanel.close;
window.openSaveToCollectionModal = window.OrbSavePanel.open;