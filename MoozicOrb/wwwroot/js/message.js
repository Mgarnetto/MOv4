(() => {
    // =============================
    // 0. RINGTONE GENERATOR (Web Audio API)
    // =============================
    const RingtoneService = {
        audioCtx: null,
        intervalId: null,

        start() {
            if (this.intervalId) return; // Already ringing

            // Create Context (Safe to do on event)
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();

            const playPulse = () => {
                if (!this.audioCtx) return;
                const t = this.audioCtx.currentTime;

                // Oscillator 1 (Main Tone 800Hz)
                const osc1 = this.audioCtx.createOscillator();
                osc1.type = "sine";
                osc1.frequency.value = 800;

                // Oscillator 2 (Modulator 650Hz)
                const osc2 = this.audioCtx.createOscillator();
                osc2.type = "sine";
                osc2.frequency.value = 650;

                // Volume Envelope (Fade In/Out)
                const gain = this.audioCtx.createGain();
                gain.gain.setValueAtTime(0, t);
                gain.gain.linearRampToValueAtTime(0.3, t + 0.1);
                gain.gain.linearRampToValueAtTime(0, t + 1.5);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(this.audioCtx.destination);

                osc1.start(t);
                osc2.start(t);
                osc1.stop(t + 1.6);
                osc2.stop(t + 1.6);
            };

            // Play immediately, then repeat every 2.5 seconds
            playPulse();
            this.intervalId = setInterval(playPulse, 2500);
        },

        stop() {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            if (this.audioCtx) {
                this.audioCtx.close().catch(e => console.error(e));
                this.audioCtx = null;
            }
        }
    };

    // =============================
    // 1. SIGNALR CONNECTIONS (PRIVATE - MESSAGING ONLY)
    // =============================
    const messageConn = new signalR.HubConnectionBuilder()
        .withUrl("/MessageHub")
        .withAutomaticReconnect()
        .build();

    const callConn = new signalR.HubConnectionBuilder()
        .withUrl("/CallHub")
        .withAutomaticReconnect()
        .build();

    // =============================
    // 2. STATE
    // =============================
    const AppState = { activeChat: { type: null, id: null } };

    // =============================
    // 3. UI HELPERS (Chat)
    // =============================
    const chatMessagesContainer = document.getElementById("chatMessages");
    const chatTitle = document.getElementById("chatTitle");

    function clearChatWindow() {
        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
        // Note: We generally do NOT clear the header actions here to avoid flickering,
        // but loadGroupMessages handles the gear icon specifically.
    }

    function appendMessage(msg, isHistory = false) {
        if (!chatMessagesContainer) return;

        const sName = msg.senderName || msg.SenderName || "User";
        const isForCurrentChat =
            (AppState.activeChat.type === "direct" && (msg.senderId == AppState.activeChat.id || msg.receiverId == AppState.activeChat.id)) ||
            (AppState.activeChat.type === "group" && msg.groupId == AppState.activeChat.id);

        if (!isForCurrentChat && !isHistory) return;

        const div = document.createElement("div");
        // UPDATED: Use window.AuthState for reliable ID check
        const currentUserId = window.AuthState?.userId || 0;
        const isMe = msg.senderId == currentUserId;

        div.className = isMe ? "message-row me" : "message-row them";
        div.id = `msg-${msg.messageId || msg.MessageId}`;

        // HTML Structure with Edit/Delete capabilities
        div.innerHTML = `
            <div class="msg-bubble position-relative">
                <small><strong>${sName}</strong></small>
                
                <div class="msg-content-display">
                    ${msg.text}
                </div>

                <div class="msg-content-edit d-none mt-2">
                    <textarea class="edit-mode-textarea" rows="2">${msg.text}</textarea>
                    <div class="d-flex justify-content-end gap-2 mt-1">
                        <button class="btn btn-sm btn-secondary" onclick="window.MessageService.cancelEdit('${div.id}')">Cancel</button>
                        <button class="btn btn-sm btn-primary" onclick="window.MessageService.saveEdit('${div.id}', '${msg.messageId}', ${isMe})">Save</button>
                    </div>
                </div>

                ${isMe ? `
                <button class="msg-options-btn" onclick="this.nextElementSibling.classList.toggle('active')">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="msg-context-menu">
                    <button onclick="window.MessageService.startEdit('${div.id}')">Edit</button>
                    <button class="text-danger" onclick="window.MessageService.deleteMsg('${msg.messageId}')">Delete</button>
                </div>
                ` : ''}
            </div>
        `;

        chatMessagesContainer.appendChild(div);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    // --- NEW: RENDER CREATE GROUP BUTTON (Global Helper) ---
    window.renderCreateGroupButton = function () {
        const list = document.getElementById('chatList');
        if (!list) return;

        // Check if exists
        if (document.getElementById('btn-create-group-li')) return;

        const li = document.createElement('li');
        li.id = "btn-create-group-li";
        li.style.cssText = "padding: 15px; cursor: pointer; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--accent-secondary); font-weight: bold;";
        li.innerHTML = '<i class="fas fa-plus-circle me-2"></i> Create Group';

        li.onclick = () => {
            const chatOverlay = document.getElementById('chatOverlay');
            if (chatOverlay) chatOverlay.classList.remove('active');

            const modal = document.getElementById('createGroupModal');
            if (modal) {
                modal.classList.add('active');
                modal.style.display = 'block';
            } else {
                alert("Create Group Modal missing from Layout.");
            }
        };

        list.prepend(li);
    };

    // =============================
    // 4. LOAD MESSAGES
    // =============================
    async function loadDirectMessages(userId, username) {
        AppState.activeChat = { type: "direct", id: userId };
        if (chatTitle) chatTitle.innerText = username || `User #${userId}`;

        // Remove Group Gear if it exists from a previous group chat
        const existingGear = document.getElementById('btn-group-settings');
        if (existingGear) existingGear.remove();

        clearChatWindow();

        const res = await fetch(`/api/direct/messages/with/${userId}`, { headers: { "X-Session-Id": AuthState.sessionId } });
        if (res.ok) {
            (await res.json()).forEach(m => appendMessage(m, true));
        }
        document.getElementById("chatOverlay").classList.add("active");
        document.querySelector('.chat-app-container')?.classList.add('conversation-active');
    }

    async function loadGroupMessages(groupId, groupName) {
        AppState.activeChat = { type: "group", id: groupId };

        let finalName = groupName;

        // 1. If name is generic or missing, try to find it in the Sidebar DOM first
        if (!finalName || finalName === "Group Chat") {
            const existingEl = document.getElementById(`thread-group-${groupId}`);
            if (existingEl) {
                const h4 = existingEl.querySelector("h4");
                if (h4) finalName = h4.innerText;
            }
        }

        // 2. If STILL generic (e.g. not in sidebar yet), fetch from API
        if (!finalName || finalName === "Group Chat") {
            try {
                const res = await fetch('/api/groups/mine', {
                    headers: { "X-Session-Id": AuthState.sessionId }
                });
                if (res.ok) {
                    const groups = await res.json();
                    const target = groups.find(g => (g.groupId || g.GroupId) == groupId);
                    if (target) finalName = target.groupName || target.GroupName;
                }
            } catch (e) { console.error("Error fetching group name", e); }
        }

        finalName = finalName || `Group ${groupId}`;

        if (chatTitle) {
            chatTitle.innerText = finalName;

            // --- FIXED: GEAR ICON LOGIC ---
            const headerContainer = document.getElementById('chatTitle').parentNode;

            // Check if gear button exists; if not, create it
            let gearBtn = document.getElementById('btn-group-settings');
            if (!gearBtn) {
                gearBtn = document.createElement('button');
                gearBtn.id = 'btn-group-settings';
                gearBtn.className = 'btn btn-link text-white ms-2';
                gearBtn.innerHTML = '<i class="fas fa-cog"></i>';
                headerContainer.appendChild(gearBtn);
            }

            // CRITICAL: Re-bind the click event every time to use current groupId
            gearBtn.onclick = () => window.MessageService.openGroupSettings(groupId, finalName);
        }

        clearChatWindow();

        const res = await fetch(`/api/groups/${groupId}/messages`, { headers: { "X-Session-Id": AuthState.sessionId } });
        if (res.ok) {
            (await res.json()).forEach(m => appendMessage(m, true));
        }
        document.getElementById("chatOverlay").classList.add("active");
        document.querySelector('.chat-app-container')?.classList.add('conversation-active');
    }

    // =============================
    // 5. SIGNALR EVENTS (Chat & Edits)
    // =============================
    messageConn.on("OnDirectMessage", async ({ senderId, messageId }) => {
        const res = await fetch(`/api/direct/messages/single/${messageId}`, { headers: { "X-Session-Id": AuthState.sessionId } });
        if (res.ok) {
            const msg = await res.json();
            const partnerId = (msg.senderId == AuthState.userId) ? msg.receiverId : msg.senderId;
            const partnerName = (msg.senderId == AuthState.userId) ? (msg.receiverName || msg.ReceiverName) : (msg.senderName || msg.SenderName);
            const partnerImg = (msg.senderId == AuthState.userId) ? (msg.receiverProfilePicUrl || msg.ReceiverProfilePicUrl) : (msg.senderProfilePicUrl || msg.SenderProfilePicUrl);

            // Trigger Sidebar Update
            if (window.AuthState?.ensureThread) {
                window.AuthState.ensureThread({
                    id: partnerId,
                    name: partnerName || `User ${partnerId}`,
                    type: "direct",
                    img: partnerImg
                });
            }
            appendMessage(msg);
        }
    });

    // Updated OnGroupMessage to preserve Group Name
    messageConn.on("OnGroupMessage", async ({ groupId, messageId }) => {
        const res = await fetch(`/api/groups/${groupId}/messages/${messageId}`, { headers: { "X-Session-Id": AuthState.sessionId } });
        if (res.ok) {
            const msg = await res.json();
            let groupName = `Group ${groupId}`;
            const existingEl = document.getElementById(`thread-group-${groupId}`);
            if (existingEl) {
                const titleEl = existingEl.querySelector('h4');
                if (titleEl) groupName = titleEl.innerText;
            }

            if (window.AuthState?.ensureThread) {
                window.AuthState.ensureThread({
                    id: groupId,
                    name: groupName,
                    type: "group"
                });
            }
            appendMessage(msg);
        }
    });

    // --- NEW: EDIT/DELETE LISTENERS ---

    // Direct Messages
    messageConn.on("OnDirectMessageUpdated", ({ messageId, text }) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            const display = el.querySelector('.msg-content-display');
            if (display) display.innerText = text;

            // Reset Edit Mode
            el.querySelector('.msg-content-edit')?.classList.add('d-none');
            display.classList.remove('d-none');
        }
    });

    messageConn.on("OnDirectMessageDeleted", ({ messageId }) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) el.remove();
    });

    // Group Messages
    messageConn.on("OnGroupMessageUpdated", ({ messageId, text }) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            const display = el.querySelector('.msg-content-display');
            if (display) display.innerText = text;

            // Reset Edit Mode
            el.querySelector('.msg-content-edit')?.classList.add('d-none');
            display.classList.remove('d-none');
        }
    });

    messageConn.on("OnGroupMessageDeleted", ({ messageId }) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) el.remove();
    });


    // =============================
    // 6. VIDEO CALL LOGIC (H264 & STATE)
    // =============================
    let pc = null;
    let localStream = null;
    let currentCallId = null;
    let incomingCallId = null; // Temp ID for incoming ring
    let incomingCallerId = null;

    // --- HELPER: Force H264 Codec ---
    function forceH264(sdp) {
        const sdpLines = sdp.split('\r\n');
        let mLineIndex = -1;
        for (let i = 0; i < sdpLines.length; i++) {
            if (sdpLines[i].startsWith('m=video')) { mLineIndex = i; break; }
        }
        if (mLineIndex === -1) return sdp;

        const h264Map = [];
        const regex = /a=rtpmap:(\d+)\s+H264/gi;
        for (const line of sdpLines) {
            let match;
            while ((match = regex.exec(line)) !== null) h264Map.push(match[1]);
        }
        if (h264Map.length === 0) return sdp;

        const mLine = sdpLines[mLineIndex];
        const elements = mLine.split(' ');
        const header = elements.slice(0, 3);
        const payloads = elements.slice(3);
        const nonH264 = payloads.filter(p => !h264Map.includes(p));
        const newPayloads = [...h264Map, ...nonH264];
        sdpLines[mLineIndex] = [...header, ...newPayloads].join(' ');
        return sdpLines.join('\r\n');
    }

    async function ensurePeer() {
        if (pc) return;
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        } catch (err) {
            console.error(err);
            alert("Camera access denied.");
            return;
        }

        const localVideo = document.getElementById("local-video");
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.muted = true;
            localVideo.autoplay = true;
            localVideo.playsInline = true;
        }

        pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

        pc.onicecandidate = e => {
            if (e.candidate && currentCallId) {
                callConn.invoke("SendRtcIceCandidate", currentCallId, e.candidate).catch(console.error);
            }
        };

        pc.ontrack = e => {
            const remote = document.getElementById("remote-video");
            if (remote) remote.srcObject = e.streams[0];
        };
    }

    // --- CALLER: STARTS CALL ---
    async function startCall(calleeUserId) {
        if (!calleeUserId) return;

        const modal = document.getElementById("videoCallModal");
        if (modal) modal.style.display = "flex";
        await ensurePeer();

        const res = await fetch("/api/calls/start", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Session-Id": AuthState.sessionId },
            body: JSON.stringify({ CalleeUserId: calleeUserId, Type: "audio" })
        });

        if (res.ok) {
            const { callId } = await res.json();
            currentCallId = callId.toString();
            console.log("Call started. Waiting for answer...");
        } else {
            alert("Failed to start call (User busy or offline).");
            hangupCall();
        }
    }

    // --- CALLEE: RECEIVES RING ---
    callConn.on("IncomingCall", ({ callId, fromUserId }) => {
        incomingCallId = callId;
        incomingCallerId = fromUserId;

        const modal = document.getElementById("incomingCallModal");
        const nameEl = document.getElementById("incomingCallerName");

        if (nameEl) nameEl.innerText = `User ${fromUserId}`;
        if (modal) modal.classList.add("active");

        RingtoneService.start();
    });

    async function acceptIncomingCall() {
        RingtoneService.stop();
        if (!incomingCallId) return;

        document.getElementById("incomingCallModal").classList.remove("active");

        currentCallId = incomingCallId;
        const vidModal = document.getElementById("videoCallModal");
        if (vidModal) vidModal.style.display = "flex";
        await ensurePeer();

        await fetch("/api/calls/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Session-Id": AuthState.sessionId },
            body: JSON.stringify({ CallId: currentCallId, CallerUserId: incomingCallerId })
        });
    }

    async function rejectIncomingCall() {
        RingtoneService.stop();
        if (!incomingCallId) return;

        await fetch("/api/calls/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Session-Id": AuthState.sessionId },
            body: JSON.stringify({ CallId: incomingCallId, CallerUserId: incomingCallerId })
        });

        document.getElementById("incomingCallModal").classList.remove("active");
        incomingCallId = null;
    }

    // --- SIGNALING EVENTS ---
    callConn.on("CallAccepted", async ({ callId }) => {
        if (currentCallId !== callId) return;
        const offer = await pc.createOffer();
        offer.sdp = forceH264(offer.sdp);
        await pc.setLocalDescription(offer);
        await callConn.invoke("SendRtcOffer", currentCallId, offer.sdp);
    });

    callConn.on("CallRejected", () => {
        alert("User busy or rejected the call.");
        hangupCall();
    });

    callConn.on("RtcOffer", async ({ callId, sdp }) => {
        currentCallId = callId;
        await ensurePeer();
        await pc.setRemoteDescription({ type: "offer", sdp });
        const answer = await pc.createAnswer();
        answer.sdp = forceH264(answer.sdp);
        await pc.setLocalDescription(answer);
        await callConn.invoke("SendRtcAnswer", callId, answer.sdp);
    });

    callConn.on("RtcAnswer", async ({ sdp }) => {
        if (pc) await pc.setRemoteDescription({ type: "answer", sdp });
    });

    callConn.on("RtcIceCandidate", async ({ candidate }) => {
        if (pc && candidate) await pc.addIceCandidate(candidate);
    });

    callConn.on("RtcHangup", hangupCall);

    async function hangupCall() {
        RingtoneService.stop();
        if (currentCallId) await callConn.invoke("EndCall", currentCallId);

        if (pc) { pc.close(); pc = null; }
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }

        currentCallId = null;
        document.getElementById("videoCallModal").style.display = "none";
        document.getElementById("incomingCallModal").classList.remove("active");
    }

    // =============================
    // 7. INIT & EVENT BINDING & EXPORTS
    // =============================
    const MessageService = {
        started: false,
        async start() {
            if (this.started) return;
            this.started = true;
            try {
                await messageConn.start();
                await callConn.start();
                if (AuthState?.userId) {
                    await messageConn.invoke("AttachUserSession", AuthState.userId);
                    await callConn.invoke("AttachUserSession", AuthState.userId);
                }
            } catch (e) { console.error(e); }
        },
        async joinGroups(groupIds) {
            for (const id of groupIds) await messageConn.invoke("JoinGroup", Number(id));
        },

        // --- CHAT EDIT METHODS ---
        startEdit(elementId) {
            const el = document.getElementById(elementId);
            if (!el) return;
            el.querySelector('.msg-options-btn').nextElementSibling.classList.remove('active'); // Close menu
            el.querySelector('.msg-content-display').classList.add('d-none');
            el.querySelector('.msg-content-edit').classList.remove('d-none');
        },

        cancelEdit(elementId) {
            const el = document.getElementById(elementId);
            if (!el) return;
            el.querySelector('.msg-content-display').classList.remove('d-none');
            el.querySelector('.msg-content-edit').classList.add('d-none');
            // Reset text
            const original = el.querySelector('.msg-content-display').innerText.trim();
            el.querySelector('textarea').value = original;
        },

        async saveEdit(elementId, messageId) {
            const el = document.getElementById(elementId);
            const newText = el.querySelector('textarea').value;
            const isGroup = AppState.activeChat.type === "group";

            let url = isGroup
                ? `/api/groups/${AppState.activeChat.id}/messages/${messageId}`
                : `/api/direct/messages/${messageId}`;

            try {
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { "Content-Type": "application/json", "X-Session-Id": AuthState.sessionId },
                    body: JSON.stringify({ text: newText })
                });
                if (!res.ok) alert("Failed to update message.");
            } catch (e) { console.error(e); }
        },

        async deleteMsg(messageId) {
            if (!confirm("Unsend this message?")) return;
            const isGroup = AppState.activeChat.type === "group";

            let url = isGroup
                ? `/api/groups/${AppState.activeChat.id}/messages/${messageId}`
                : `/api/direct/messages/${messageId}`;

            try {
                const res = await fetch(url, {
                    method: 'DELETE',
                    headers: { "X-Session-Id": AuthState.sessionId }
                });
                if (!res.ok) alert("Failed to delete.");
            } catch (e) { console.error(e); }
        },

        // --- GROUP SETTINGS METHODS (ROBUST MAPPING & SEARCH FIX) ---
        async openGroupSettings(groupId, groupName) {
            const modal = document.getElementById('groupInfoModal');
            if (!modal) {
                console.error("ERROR: Group Info Modal (#groupInfoModal) not found in DOM.");
                return;
            }

            // 1. Setup Header
            const nameInput = document.getElementById('groupNameInput');
            if (nameInput) nameInput.value = groupName;

            // 2. Fetch Members
            // We fetch the current list of members to display
            const members = await window.GroupService.getMembers(groupId);

            const myId = window.AuthState.userId;

            // ROBUST FIND: Handle both PascalCase (UserId) and camelCase (userId)
            const me = members.find(m => (m.userId || m.UserId) == myId);
            const myRole = me ? (me.role !== undefined ? me.role : me.Role) : 0;

            // 3. Handle Delete Button (Owner Only)
            const delBtn = document.getElementById('btnDeleteGroup');
            if (delBtn) {
                if (myRole === 1) {
                    delBtn.classList.remove('d-none');
                    delBtn.onclick = async () => {
                        if (confirm("Destroy this group permanently?")) {
                            if (await window.GroupService.deleteGroup(groupId)) {
                                window.location.reload();
                            }
                        }
                    };
                } else {
                    delBtn.classList.add('d-none');
                }
            }

            // 4. Handle Rename
            if (nameInput) {
                if (myRole > 0) {
                    nameInput.removeAttribute('readonly');
                    nameInput.onblur = async () => {
                        if (nameInput.value !== groupName) {
                            await window.GroupService.renameGroup(groupId, nameInput.value);
                        }
                    };
                } else {
                    nameInput.setAttribute('readonly', true);
                }
            }

            // 5. Handle Leave Logic
            const leaveBtn = document.getElementById('btnLeaveGroup');
            if (leaveBtn) {
                leaveBtn.onclick = async () => {
                    if (confirm("Leave this group?")) {
                        if (await window.GroupService.removeMember(groupId, myId)) {
                            modal.classList.remove('active');
                            window.location.reload();
                        }
                    }
                };
            }

            // 6. Render Member List (Handles Case Sensitivity)
            const list = document.getElementById('groupMemberList');
            if (list) {
                list.innerHTML = '';
                if (members.length === 0) list.innerHTML = '<div class="p-3 text-muted text-center">No members found.</div>';

                members.forEach(m => {
                    const row = document.createElement('div');
                    row.className = "member-row";

                    // Handle Property Names
                    const uid = m.userId || m.UserId;
                    const r = m.role !== undefined ? m.role : m.Role;
                    const dName = m.displayName || m.DisplayName || m.userName || m.UserName || "User";
                    const dPic = m.profilePic || m.ProfilePic || '/img/profile_default.jpg';

                    let badge = '';
                    if (r === 1) badge = '<span class="role-badge owner">OWNER</span>';
                    else if (r === 2) badge = '<span class="role-badge admin">ADMIN</span>';

                    let actions = '';
                    // Logic: Owner (1) > Admin (2) > Member (0)
                    if (uid !== myId) {
                        const canKick = (myRole === 1) || (myRole === 2 && r === 0);
                        const canPromote = (myRole === 1 && r === 0);
                        const canDemote = (myRole === 1 && r === 2);

                        if (canKick || canPromote || canDemote) {
                            actions = `
                             <button class="msg-options-btn" style="position:relative !important; right:0 !important; top:0 !important;" onclick="this.nextElementSibling.classList.toggle('active')">
                                <i class="fas fa-ellipsis-v"></i>
                             </button>
                             <div class="msg-context-menu" style="right:0; top:20px;">`;

                            if (canPromote) actions += `<button class="text-primary" onclick="window.GroupService.setMemberRole(${groupId}, ${uid}, 2).then(()=>window.MessageService.openGroupSettings(${groupId}, '${groupName}'))">Promote to Admin</button>`;
                            if (canDemote) actions += `<button class="text-warning" onclick="window.GroupService.setMemberRole(${groupId}, ${uid}, 0).then(()=>window.MessageService.openGroupSettings(${groupId}, '${groupName}'))">Demote to Member</button>`;
                            if (canKick) actions += `<button class="text-danger" onclick="window.GroupService.removeMember(${groupId}, ${uid}).then(()=>window.MessageService.openGroupSettings(${groupId}, '${groupName}'))">Remove User</button>`;

                            actions += `</div>`;
                        }
                    }

                    row.innerHTML = `
                        <div class="member-info">
                            <img src="${dPic}" width="32" height="32" class="rounded-circle" style="object-fit:cover;">
                            <div>
                                <div class="fw-bold small text-white">${dName}</div>
                                ${badge}
                            </div>
                        </div>
                        <div class="position-relative">
                            ${actions}
                        </div>
                    `;
                    list.appendChild(row);
                });
            }

            // 7. Add Member Search Logic
            const addInput = document.getElementById('groupAddMemberInput');
            const addResults = document.getElementById('groupAddMemberResults');

            if (addInput) {
                addInput.onkeyup = async () => {
                    const q = addInput.value;
                    if (q.length < 2) { addResults.innerHTML = ''; addResults.classList.remove('show'); return; }

                    // Use the Direct Messages search endpoint to find users
                    const res = await fetch(`/api/direct/messages/search?query=${encodeURIComponent(q)}`, {
                        headers: { "X-Session-Id": AuthState.sessionId }
                    });

                    if (res.ok) {
                        const users = await res.json();
                        addResults.innerHTML = '';
                        if (users.length > 0) addResults.classList.add('show');
                        else addResults.classList.remove('show');

                        // Filter out existing members
                        const existingIds = members.map(x => x.userId || x.UserId);
                        const filteredUsers = users.filter(u => !existingIds.includes(u.id));

                        if (filteredUsers.length === 0) {
                            addResults.innerHTML = '<div class="p-2 text-muted small">No new users found</div>';
                            return;
                        }

                        filteredUsers.forEach(u => {
                            const item = document.createElement('button');
                            item.className = 'dropdown-item';
                            item.innerHTML = `<img src="${u.img}" width="20" class="rounded-circle me-2"> ${u.name}`;
                            item.onclick = async () => {
                                await window.GroupService.addMember(groupId, u.id);
                                addInput.value = '';
                                addResults.classList.remove('show');
                                // Refresh list
                                window.MessageService.openGroupSettings(groupId, groupName);
                            };
                            addResults.appendChild(item);
                        });
                    }
                };
            }

            // Force display (Fix for Z-index issues)
            modal.style.display = 'block';
            setTimeout(() => modal.classList.add('active'), 10);
        }
    };

    // =============================
    // 8. NOTIFICATIONS (UPDATED)
    // =============================
    messageConn.on("OnNotification", async (n) => {
        console.log("Notification received:", n);

        if (n.type === "group_invite") {
            messageConn.invoke("JoinGroup", parseInt(n.referenceId)).catch(console.error);
            if (window.AuthState && window.AuthState.bootstrap) {
                await window.AuthState.bootstrap();
            }
        }

        showNotificationToast(n);

        const badge = document.getElementById("nav-notif-badge");
        if (badge) {
            let count = parseInt(badge.innerText) || 0;
            badge.innerText = count + 1;
            badge.style.display = "block";
        }
    });

    function showNotificationToast(n) {
        const div = document.createElement("div");
        div.className = "notif-toast";
        div.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="${n.actorPic}" class="rounded-circle me-2" width="30" height="30" style="object-fit:cover;">
                <div>
                    <strong>${n.actorName}</strong> ${n.message}
                </div>
            </div>
        `;

        div.style.cssText = `
            position: fixed; top: 80px; right: 20px; z-index: 9999;
            background: #222; color: #fff; padding: 10px 15px;
            border-left: 4px solid #00AEEF; border-radius: 4px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5); animation: slideIn 0.3s;
            cursor: pointer;
            font-family: 'Poppins', sans-serif; font-size: 13px;
        `;

        div.onclick = () => {
            if (n.type === "message") {
                if (window.startChat) window.startChat(n.actorId);
            } else if (n.type === "group_message" || n.type === "group_invite") {
                if (window.loadGroupMessages) {
                    window.loadGroupMessages(n.referenceId, "Group Chat");
                }
            } else if (n.type === "post_new") {
                window.location.href = `/home/feed?highlight=${n.referenceId}`;
            } else if (n.type === "follow") {
                window.location.href = `/creator/${n.actorId}`;
            }
            div.remove();
        };

        document.body.appendChild(div);
        setTimeout(() => { if (div.parentNode) div.remove(); }, 4000);
    }

    // NEW: Uses API to get User Info for the Header only
    async function startChat(userId) {
        if (typeof AuthState === 'undefined' || !AuthState.loggedIn) {
            const loginBtn = document.getElementById("loginToggleBtn");
            if (loginBtn) loginBtn.click();
            return;
        }

        let name = `User ${userId}`;

        try {
            const res = await fetch(`/api/direct/messages/user-info/${userId}`, {
                headers: { "X-Session-Id": AuthState.sessionId }
            });
            if (res.ok) {
                const info = await res.json();
                name = info.name;
            }
        } catch (e) {
            console.error("Failed to fetch user info for chat header", e);
        }

        const chatOverlay = document.getElementById("chatOverlay");
        const sidebar = document.getElementById('sidebar');

        if (sidebar) sidebar.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        if (chatOverlay) chatOverlay.classList.add("active");

        await loadDirectMessages(userId, name);
    }

    document.addEventListener("DOMContentLoaded", () => {
        const input = document.getElementById("msgInput");
        const sendBtn = document.getElementById("msgSendBtn");

        const triggerSend = async () => {
            if (!input.value.trim()) return;

            const isGroup = AppState.activeChat.type === "group";

            const payload = isGroup
                ? { text: input.value.trim() }
                : { receiverId: AppState.activeChat.id, text: input.value.trim() };

            const url = isGroup
                ? `/api/groups/${AppState.activeChat.id}/messages`
                : "/api/direct/messages";

            await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Session-Id": AuthState.sessionId
                },
                body: JSON.stringify(payload)
            });

            input.value = "";
        };

        if (sendBtn) sendBtn.onclick = triggerSend;
        if (input) input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); triggerSend(); } };

        const vidBtn = document.getElementById("startVideoCallBtn");
        if (vidBtn) vidBtn.onclick = () => {
            if (AppState.activeChat.type === "direct") startCall(AppState.activeChat.id);
            else alert("Direct messages only.");
        };

        const hangBtn = document.getElementById("hangupBtn");
        if (hangBtn) hangBtn.onclick = (e) => { e.preventDefault(); hangupCall(); };

        const acceptBtn = document.getElementById("btnAcceptCall");
        const rejectBtn = document.getElementById("btnRejectCall");
        if (acceptBtn) acceptBtn.onclick = acceptIncomingCall;
        if (rejectBtn) rejectBtn.onclick = rejectIncomingCall;

        const headerNewChatBtn = document.querySelector('.icon-btn.new-chat');
        if (headerNewChatBtn) {
            headerNewChatBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const chatOverlay = document.getElementById('chatOverlay');
                if (chatOverlay) chatOverlay.classList.remove('active');

                const modal = document.getElementById('createGroupModal');
                if (modal) {
                    modal.classList.add('active');
                    modal.style.display = 'block';
                } else {
                    console.warn("Create Group Modal not found in DOM");
                }
            });
        }
    });

    window.MessageService = MessageService;
    window.loadDirectMessages = loadDirectMessages;
    window.loadGroupMessages = loadGroupMessages;
    window.appendMessage = appendMessage;
    window.startCall = startCall;
    window.hangupCall = hangupCall;
    window.startChat = startChat;
})();