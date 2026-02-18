(() => {
    const NotificationService = {
        initialized: false,
        connection: null,

        // Called by AuthState.bootstrap()
        init() {
            if (this.initialized) {
                this.fetchNotifications();
                return;
            }

            const btn = document.getElementById("notifToggleBtn");
            const dropdown = document.getElementById("notifDropdown");
            const markReadBtn = document.getElementById("markAllReadBtn");

            // 1. Initial Fetch
            this.fetchNotifications();

            // 2. Setup SignalR (Real-time Updates)
            this.setupSignalR();

            if (!btn || !dropdown) return;

            // 3. Toggle Handler
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains("show");
                if (isOpen) this.closeDropdown();
                else this.openDropdown();
            });

            // 4. Outside Click Handler
            document.addEventListener("click", (e) => {
                if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
                    this.closeDropdown();
                }
            });

            // 5. Mark Read Handler
            if (markReadBtn) {
                markReadBtn.addEventListener("click", () => this.markAllRead());
            }

            this.initialized = true;
        },

        // --- HANDLES SIGNALR CONNECTION ---
        setupSignalR() {
            if (this.connection) return;

            // Ensure signalR lib is loaded
            if (typeof signalR === 'undefined') return;

            // Connect to the correct Hub URL (/PostHub)
            this.connection = new signalR.HubConnectionBuilder()
                .withUrl("/PostHub")
                .withAutomaticReconnect()
                .build();

            // A. Listen for Notifications
            this.connection.on("ReceiveNotification", (data) => {
                this.fetchNotifications();
            });

            // B. Listen for Stats Updates (Followers/Following)
            this.connection.on("ReceiveStatsUpdate", (data) => {
                if (window.SidebarManager && window.SidebarManager.handleStatsUpdate) {
                    window.SidebarManager.handleStatsUpdate(data);
                }
            });

            // Start Connection and Join User Group
            this.connection.start()
                .then(() => {
                    console.log("Connected to PostHub");
                    if (window.AuthState && window.AuthState.userId) {
                        const myGroup = "user_" + window.AuthState.userId;
                        this.connection.invoke("JoinGroup", myGroup)
                            .catch(err => console.error("Failed to join group:", err));
                    }
                })
                .catch(err => console.error("SignalR Error:", err));
        },

        openDropdown() {
            const btn = document.getElementById("notifToggleBtn");
            const dropdown = document.getElementById("notifDropdown");
            if (!dropdown) return;

            dropdown.style.display = "block";
            setTimeout(() => dropdown.classList.add("show"), 10);
            if (btn) btn.classList.add("active");

            this.fetchNotifications();
        },

        closeDropdown() {
            const btn = document.getElementById("notifToggleBtn");
            const dropdown = document.getElementById("notifDropdown");
            if (!dropdown) return;

            dropdown.classList.remove("show");
            setTimeout(() => dropdown.style.display = "none", 200);
            if (btn) btn.classList.remove("active");
        },

        async fetchNotifications() {
            if (!window.AuthState?.sessionId) return;

            const list = document.getElementById("notification-list");

            if (list && list.children.length === 0) {
                list.innerHTML = '<div style="padding:20px;text-align:center;color:#666;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            }

            try {
                const res = await fetch("/api/notifications", {
                    headers: { "X-Session-Id": window.AuthState.sessionId }
                });

                if (res.ok) {
                    const data = await res.json();
                    this.renderList(data);
                    this.updateBadge(data.length);
                } else if (list) {
                    list.innerHTML = '<div class="notif-empty">Failed to load</div>';
                }
            } catch (e) {
                console.error(e);
                if (list) list.innerHTML = '<div class="notif-empty">Error loading</div>';
            }
        },

        async markAllRead() {
            if (!window.AuthState?.sessionId) return;
            const badge = document.getElementById("nav-notif-badge");
            const list = document.getElementById("notification-list");

            try {
                await fetch("/api/notifications/mark-read", {
                    method: "POST",
                    headers: { "X-Session-Id": window.AuthState.sessionId }
                });

                if (badge) {
                    badge.innerText = "0";
                    badge.style.display = "none";
                }
                if (list) {
                    const items = list.querySelectorAll(".notif-item.unread");
                    items.forEach(i => i.classList.remove("unread"));
                }

                this.closeDropdown();

            } catch (e) {
                console.error("Failed to mark read", e);
            }
        },

        updateBadge(count) {
            const badge = document.getElementById("nav-notif-badge");
            if (!badge) return;

            if (count > 0) {
                badge.innerText = count > 9 ? "9+" : count;
                badge.style.display = "flex";
            } else {
                badge.style.display = "none";
            }
        },

        renderList(notifications) {
            const list = document.getElementById("notification-list");
            if (!list) return;

            if (!notifications || notifications.length === 0) {
                list.innerHTML = '<div class="notif-empty">No new notifications</div>';
                return;
            }

            list.innerHTML = '';

            notifications.forEach(n => {
                const li = document.createElement("a");
                li.className = `notif-item ${n.isRead ? '' : 'unread'}`;
                li.href = "#";

                let isModalAction = false;
                let autoComment = false;

                if (n.type === "post_new" || n.type === "like") {
                    isModalAction = true;
                } else if (n.type === "comment" || n.type === "comment_reply") {
                    isModalAction = true;
                    autoComment = true;
                } else if (n.type === "follow") {
                    li.href = `/creator/${n.actorId}`;
                }

                // USE WINDOW.TIMEAGO IF AVAILABLE, ELSE FALLBACK TO SERVER STRING
                const timeDisplay = (window.timeAgo && n.createdAt)
                    ? window.timeAgo(n.createdAt)
                    : (n.createdAgo || 'Just now');

                li.innerHTML = `
                    <img src="${n.actorPic || '/img/profile_default.jpg'}" class="notif-img">
                    <div class="notif-content">
                        <div class="notif-text">
                            <strong>${n.actorName}</strong> ${n.message}
                        </div>
                        <div class="notif-time">${timeDisplay}</div>
                    </div>
                `;

                li.onclick = (e) => {
                    // 1. Direct Message Click
                    if (n.type === "message") {
                        e.preventDefault();
                        if (window.startChat) window.startChat(n.actorId);
                        this.closeDropdown();
                        return;
                    }

                    // 2. Group Message / Invite Click
                    if (n.type === "group_message" || n.type === "group_invite") {
                        e.preventDefault();
                        if (window.loadGroupMessages) {
                            window.loadGroupMessages(n.referenceId, "Group Chat");
                        }
                        this.closeDropdown();
                        return;
                    }

                    // 3. Post Click (Modal)
                    if (isModalAction) {
                        e.preventDefault();
                        if (window.FeedService && window.FeedService.openPostModal) {
                            window.FeedService.openPostModal(n.referenceId, autoComment);
                        }
                        this.closeDropdown();
                        return;
                    }

                    // 4. Normal navigation (Follow, etc)
                    if (n.type === "follow") {
                        this.closeDropdown();
                        return;
                    }

                    this.closeDropdown();
                };

                list.appendChild(li);
            });
        }
    };

    window.NotificationService = NotificationService;
})();