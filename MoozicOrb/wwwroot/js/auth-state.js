(() => {
    // 1. ROBUST DATE PARSER (Forced UTC)
    const parseTime = (input) => {
        if (!input) return 0;
        let dateStr = input;
        // If the date string doesn't end with Z and doesn't have a timezone offset, 
        // force it to be treated as UTC by appending Z.
        if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
            dateStr += 'Z';
        }
        const d = new Date(dateStr);
        const t = d.getTime();
        return (isNaN(t) || t < 0) ? 0 : t;
    };

    // Attach logic directly to the global window object
    window.AuthState = {
        loggedIn: false,
        userId: null,
        sessionId: null,

        // ============================================
        // 1. LOGIN STATE & UI TOGGLING
        // ============================================
        setLoggedIn(userId, sessionId) {
            this.loggedIn = true;
            this.userId = userId;
            this.sessionId = sessionId;
            document.body.classList.add("auth-on");
            document.body.classList.remove("auth-off");

            const guest = document.getElementById("auth-guest");
            if (guest) guest.style.display = "none";
            const user = document.getElementById("auth-user");
            if (user) {
                user.style.display = "flex";
                const w = user.querySelector(".welcome-text");
                if (w) w.style.display = "none";
            }
            const dd = document.getElementById("loginDropdown");
            if (dd) { dd.style.display = "none"; dd.classList.remove("active"); }
            this.toggleProfileLink(true);
        },

        setLoggedOut() {
            this.loggedIn = false;
            this.userId = null;
            this.sessionId = null;
            document.body.classList.add("auth-off");
            document.body.classList.remove("auth-on");

            const guest = document.getElementById("auth-guest");
            if (guest) guest.style.display = "block";
            const user = document.getElementById("auth-user");
            if (user) user.style.display = "none";

            const chatList = document.getElementById("chatList");
            if (chatList) chatList.innerHTML = '';

            this.toggleProfileLink(false);
        },

        toggleProfileLink(enable) {
            const el = document.querySelector(".sidebar-profile > a");
            if (el) {
                el.style.pointerEvents = enable ? "auto" : "none";
                el.style.opacity = enable ? "1" : "0.5";
                el.style.cursor = enable ? "pointer" : "default";
            }
        },

        async checkSessionValid(sessionId) {
            try {
                const res = await fetch("/api/login/bootstrap", { headers: { "X-Session-Id": sessionId } });
                return res.ok;
            } catch { return false; }
        },

        // ============================================
        // 3. BOOTSTRAP (SORTING FIX)
        // ============================================
        async bootstrap() {
            if (!this.sessionId) throw new Error("Missing session");

            if (window.MessageService) try { await window.MessageService.start(); } catch (e) { }
            if (window.NotificationService) try { window.NotificationService.init(); } catch (e) { }

            // Pre-load collections cache (used in chat attachments)
            window.AuthState.userCollections = {};

            // Fire and forget (don't await it, let it load in the background)
            fetch("/api/collections/mine?type=0", { headers: { "X-Session-Id": this.sessionId } })
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    window.AuthState.userCollections = data;
                })
                .catch(err => console.error("Failed to pre-load collections cache.", err));

            const chatList = document.getElementById("chatList");
            if (chatList) chatList.innerHTML = "";
            if (window.renderCreateGroupButton) window.renderCreateGroupButton();

            try {
                const [groupsRes, dmsRes] = await Promise.all([
                    fetch("/api/groups/mine", { headers: { "X-Session-Id": this.sessionId } }),
                    fetch("/api/direct/messages", { headers: { "X-Session-Id": this.sessionId } })
                ]);

                let allThreads = [];
                const groupsToJoin = [];

                if (groupsRes.ok) {
                    const groups = await groupsRes.json();
                    groups.forEach(g => {
                        groupsToJoin.push(g.groupId || g.GroupId);
                        const rawT = g.timestamp || g.Timestamp;
                        allThreads.push({
                            id: g.groupId || g.GroupId,
                            name: g.groupName || g.GroupName,
                            type: 'group',
                            img: '/img/default_cover.jpg',
                            time: parseTime(rawT)
                        });
                    });
                }

                if (dmsRes.ok) {
                    const dataDms = await dmsRes.json();
                    const conversations = dataDms.messages || dataDms.Messages || {};

                    Object.keys(conversations).forEach(userId => {
                        let msgs = conversations[userId];
                        if (!Array.isArray(msgs)) return;

                        let lastTime = 0;
                        let displayName = `User ${userId}`;
                        let displayPic = "/img/profile_default.jpg";

                        if (msgs.length > 0) {
                            msgs.sort((a, b) => parseTime(a.timestamp || a.Timestamp) - parseTime(b.timestamp || b.Timestamp));
                            const lastMsg = msgs[msgs.length - 1];
                            lastTime = parseTime(lastMsg.timestamp || lastMsg.Timestamp);

                            const isMe = (lastMsg.senderId || lastMsg.SenderId) == this.userId;
                            displayName = isMe ? (lastMsg.receiverName || lastMsg.ReceiverName) : (lastMsg.senderName || lastMsg.SenderName);
                            displayPic = isMe ? (lastMsg.receiverProfilePicUrl || lastMsg.ReceiverProfilePicUrl) : (lastMsg.senderProfilePicUrl || lastMsg.SenderProfilePicUrl);
                        }

                        allThreads.push({
                            id: parseInt(userId),
                            name: displayName,
                            type: 'direct',
                            img: displayPic,
                            time: lastTime
                        });
                    });
                }

                // SORT DESCENDING (Newest First)
                allThreads.sort((a, b) => b.time - a.time);

                allThreads.forEach(t => this.renderThreadItem(t));

                if (groupsToJoin.length > 0 && window.MessageService) {
                    window.MessageService.joinGroups(groupsToJoin).catch(e => console.error(e));
                }

            } catch (err) {
                console.error("[AuthState] Error:", err);
            }
        },

        // ============================================
        // 4. UI GENERATOR
        // ============================================
        ensureThread({ id, name, type, img }) {
            const domId = `thread-${type}-${id}`;
            const existing = document.getElementById(domId);
            const createBtn = document.getElementById('btn-create-group-li');
            const chatList = document.getElementById("chatList");

            if (existing) {
                if (name) existing.querySelector("h4").innerText = name;
                if (createBtn) createBtn.after(existing);
                else if (chatList) chatList.prepend(existing);
                return;
            }

            if (!img || img === "null") img = type === "group" ? "/img/default_cover.jpg" : "/img/profile_default.jpg";
            this.renderThreadItem({ id, name, type, img }, true);
        },

        renderThreadItem({ id, name, type, img }, forceTop = false) {
            const chatList = document.getElementById("chatList");
            if (!chatList) return;
            const domId = `thread-${type}-${id}`;
            if (document.getElementById(domId)) return;

            const li = document.createElement("li");
            li.id = domId;
            li.className = "chat-contact-item";
            li.style.cssText = `display: flex; align-items: center; padding: 15px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.1); transition: background 0.2s;`;

            li.onmouseover = () => li.style.background = "rgba(255,255,255,0.05)";
            li.onmouseout = () => li.style.background = "transparent";

            let avatarHtml;
            if (img && img.includes("/") && !img.includes("default")) {
                avatarHtml = `<img src="${img}" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; object-fit: cover;" onerror="this.src='/img/profile_default.jpg'">`;
            } else {
                const iconClass = type === "group" ? "fa-users" : "fa-user";
                const avatarColor = type === "group" ? "#6c5ce7" : "#0984e3";
                avatarHtml = `<div class="avatar" style="width: 40px; height: 40px; background: ${avatarColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px; color: white;"><i class="fas ${iconClass}"></i></div>`;
            }

            li.innerHTML = `${avatarHtml}<div class="info" style="flex: 1; overflow: hidden;"><h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</h4><p style="margin: 0; font-size: 12px; color: #aaa;">${type === 'group' ? 'Group Chat' : 'Direct Message'}</p></div>`;

            li.onclick = () => {
                Array.from(chatList.children).forEach(c => c.style.background = "transparent");
                li.style.background = "rgba(255,255,255,0.1)";
                if (type === "group") { if (window.loadGroupMessages) window.loadGroupMessages(id, name); }
                else { if (window.loadDirectMessages) window.loadDirectMessages(id, name); }
            };

            const btn = document.getElementById('btn-create-group-li');
            if (forceTop && btn) btn.after(li);
            else chatList.appendChild(li);
        }
    };

    // --- DOM Initialization ---
    document.addEventListener("DOMContentLoaded", async () => {
        const savedSession = localStorage.getItem("moozic_session");
        window.AuthState.toggleProfileLink(false);

        if (savedSession) {
            try {
                const data = JSON.parse(savedSession);
                if (await window.AuthState.checkSessionValid(data.sessionId)) {
                    window.AuthState.setLoggedIn(data.userId, data.sessionId);
                    await window.AuthState.bootstrap();
                } else { window.AuthState.setLoggedOut(); }
            } catch { window.AuthState.setLoggedOut(); }
        } else { window.AuthState.setLoggedOut(); }

        const toggleBtn = document.getElementById("loginToggleBtn");
        const dropdown = document.getElementById("loginDropdown");
        if (toggleBtn && dropdown) {
            toggleBtn.onclick = () => dropdown.style.display = (dropdown.style.display === "none" || dropdown.style.display === "") ? "block" : "none";
        }
    });

    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible" && window.AuthState.loggedIn && window.AuthState.sessionId) {
            if (await window.AuthState.checkSessionValid(window.AuthState.sessionId)) await window.AuthState.bootstrap();
            else {
                localStorage.removeItem("moozic_session");
                window.AuthState.setLoggedOut();
                window.location.replace("/");
            }
        }
    });
})();