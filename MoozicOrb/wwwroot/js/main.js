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
// UNIVERSAL COLLECTIONS MANAGER (Sliding Panel)
// ============================================
window.OrbSavePanel = {
    currentPlayingUrl: null,
    currentPlayingLinkId: null,
    currentPlayingCollectionId: null, // Tracks which folder is playing
    currentlyViewingCollectionId: null, // Tracks which folder we are currently looking inside

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

        listContainer.innerHTML = '<div class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

        const userId = window.AuthState?.userId;
        if (!userId) {
            listContainer.innerHTML = '<div class="text-muted small text-center mt-4">Please log in to organize your media.</div>';
            if (footer) footer.style.display = 'none';
            return;
        }

        if (footer) footer.style.display = 'flex';

        try {
            const res = await fetch(`/api/collections/mine?type=${fetchType}`, {
                headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
            });

            if (res.ok) {
                const collections = await res.json();
                listContainer.innerHTML = '';

                if (collections.length === 0) {
                    listContainer.innerHTML = '<div class="text-muted small text-center mt-3">No folders yet. Create one below!</div>';
                    return;
                }

                collections.forEach(c => {
                    // Check if this specific playlist is currently spinning
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
            }
        } catch (err) {
            console.error(err);
            listContainer.innerHTML = '<div class="text-danger small text-center mt-3">Error loading folders.</div>';
        }
    },

    viewCollection: async function (collectionId) {
        this.currentlyViewingCollectionId = collectionId; // Track where we are

        const listContainer = document.getElementById('existingCollectionsList');
        const footer = document.getElementById('orbSavePanelFooter');

        if (footer) footer.style.display = 'none';

        listContainer.innerHTML = '<div class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Loading tracks...</div>';

        try {
            const res = await fetch(`/api/collections/${collectionId}`, {
                headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
            });

            if (res.ok) {
                const collection = await res.json();
                const items = collection.items || collection.Items || [];

                document.getElementById('orbSavePanelTitle').innerText = collection.title || collection.Title || 'Playlist';

                let html = `<button class="orb-panel-back-btn" onclick="window.OrbSavePanel.open(null, 1, 'audio')">
                                <i class="fas fa-arrow-left"></i> Back to Playlists
                            </button>`;

                if (items.length === 0) {
                    html += `<div class="text-muted small text-center mt-3">This playlist is empty.</div>`;
                } else {
                    let urlMatchedOnce = false;

                    items.forEach((item) => {
                        const title = item.title || item.Title || 'Unknown Track';
                        const artist = item.artistName || item.ArtistName || 'Unknown Artist';
                        const cover = item.artUrl || item.ArtUrl || '';
                        const url = item.url || item.Url;
                        const linkId = item.linkId || item.LinkId;

                        const safeTitle = title.replace(/'/g, "\\'");
                        const safeArtist = artist.replace(/'/g, "\\'");

                        // --- ART FALLBACK RENDERER ---
                        let coverHtml = '';
                        if (cover && cover.trim() !== '') {
                            coverHtml = `<img src="${cover}" alt="cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                         <div class="orb-panel-fallback-icon" style="display:none;"><i class="fas fa-music"></i></div>`;
                        } else {
                            coverHtml = `<div class="orb-panel-fallback-icon"><i class="fas fa-music"></i></div>`;
                        }

                        // --- ACTIVE TRACK CHECK ---
                        let isActive = false;

                        if (this.currentPlayingLinkId && String(this.currentPlayingLinkId) === String(linkId)) {
                            isActive = true;
                            urlMatchedOnce = true;
                        } else if (this.currentPlayingUrl === url && !urlMatchedOnce && !this.currentPlayingLinkId) {
                            isActive = true;
                            urlMatchedOnce = true;
                        }

                        const activeClass = isActive ? 'active-track' : '';
                        const iconClass = isActive ? 'fa-volume-up text-info' : 'fa-play text-muted';

                        html += `
                            <div class="orb-save-panel-item track-item ${activeClass}" id="playlist-track-${linkId}" data-track-url="${url}" onclick="window.OrbSavePanel.playTrack('${url}', '${safeTitle}', '${safeArtist}', '${cover}', '${linkId}')">
                                ${coverHtml}
                                <div style="flex-grow: 1; overflow: hidden; text-align: left;">
                                    <div class="text-truncate" style="font-weight: 600; color: #fff; font-size: 0.95rem;">${title}</div>
                                    <div class="text-truncate" style="font-size: 0.8rem; color: #aaa;">${artist}</div>
                                </div>
                                <i class="track-icon fas ${iconClass}" style="margin-left: auto;"></i>
                            </div>
                        `;
                    });
                }

                listContainer.innerHTML = html;
            }
        } catch (err) {
            console.error(err);
            listContainer.innerHTML = '<div class="text-danger small text-center mt-3">Error loading playlist.</div>';
        }
    },

    playTrack: function (url, title, artist, cover, linkId = null) {
        this.currentPlayingUrl = url;
        this.currentPlayingLinkId = linkId;

        // Tie the track back to the folder we are currently viewing
        this.currentPlayingCollectionId = this.currentlyViewingCollectionId;

        // Visual UI Update inside list
        const allTracks = document.querySelectorAll('.orb-save-panel-item.track-item');
        allTracks.forEach(el => {
            el.classList.remove('active-track');
            const icon = el.querySelector('.track-icon');
            if (icon) icon.className = 'track-icon fas fa-play text-muted';
        });

        if (linkId) {
            const activeEl = document.getElementById(`playlist-track-${linkId}`);
            if (activeEl) {
                activeEl.classList.add('active-track');
                const icon = activeEl.querySelector('.track-icon');
                if (icon) icon.className = 'track-icon fas fa-volume-up text-info';
            }
        } else {
            const activeEl = document.querySelector(`.orb-save-panel-item.track-item[data-track-url="${url}"]`);
            if (activeEl) {
                activeEl.classList.add('active-track');
                const icon = activeEl.querySelector('.track-icon');
                if (icon) icon.className = 'track-icon fas fa-volume-up text-info';
            }
        }

        if (window.AudioPlayer) {
            // Prevent the player from breaking if it tries to load a null cover
            const safeCover = (cover && cover.trim() !== '') ? cover : '/img/default_cover.jpg';
            window.AudioPlayer.playTrack(url, { title: title, artist: artist, cover: safeCover });
        }
    },

    playCollection: async function (collectionId) {
        // Set the active folder immediately
        this.currentPlayingCollectionId = collectionId;

        try {
            const res = await fetch(`/api/collections/${collectionId}`, {
                headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
            });

            if (res.ok) {
                const collection = await res.json();
                const items = collection.items || collection.Items || [];

                if (items.length > 0) {
                    const firstTrack = items[0];
                    const url = firstTrack.url || firstTrack.Url;
                    const linkId = firstTrack.linkId || firstTrack.LinkId;
                    const title = firstTrack.title || firstTrack.Title;
                    const artist = firstTrack.artistName || firstTrack.ArtistName;
                    const cover = firstTrack.artUrl || firstTrack.ArtUrl;

                    await this.viewCollection(collectionId);
                    this.playTrack(url, title, artist, cover, linkId);

                } else {
                    alert("This playlist is empty.");
                }
            }
        } catch (err) { console.error(err); }
    },

    close: function () {
        document.getElementById('orbSaveOverlay').classList.add('d-none');
        document.getElementById('orbSavePanel').classList.remove('active');
    },

    saveItem: async function (collectionId) {
        const targetId = document.getElementById('collectionTargetId').value;
        const targetType = document.getElementById('collectionTargetType').value;

        if (!targetId) return;

        try {
            const res = await fetch(`/api/collections/${collectionId}/add-item`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': window.AuthState?.sessionId || ''
                },
                body: JSON.stringify({ TargetId: parseInt(targetId), TargetType: parseInt(targetType) })
            });

            if (res.ok) {
                alert("Saved to collection!");
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

        let itemsPayload = [];
        if (targetId) {
            itemsPayload.push({ TargetId: parseInt(targetId), TargetType: parseInt(targetType) });
        }

        try {
            const payload = {
                Title: title,
                Description: "",
                Type: colType,
                DisplayContext: displayContext,
                CoverImageId: 0,
                Items: itemsPayload
            };

            const res = await fetch('/api/collections/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': window.AuthState?.sessionId || ''
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert(targetId ? "Folder created and item saved!" : "Playlist created!");

                if (!targetId) {
                    this.open(null, targetType, displayContext);
                } else {
                    this.close();
                }
            } else {
                alert("Failed to create folder.");
            }
        } catch (err) { console.error(err); }
    }
};

window.closeCollectionModal = window.OrbSavePanel.close;
window.openSaveToCollectionModal = window.OrbSavePanel.open;