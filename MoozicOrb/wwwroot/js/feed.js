/* =========================================
   FEED & POST LOGIC (Public Layer)
   ========================================= */

// 1. PUBLIC CONNECTION
const feedConnection = new signalR.HubConnectionBuilder()
    .withUrl("/PostHub")
    .withAutomaticReconnect()
    .build();

feedConnection.start().catch(err => console.error("[Feed] Connection failed", err));

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && feedConnection.state === "Disconnected") {
        feedConnection.start();
    }
});

// 2. FEED SERVICE
window.FeedService = {
    joinGroup: (g) => feedConnection.state === "Connected" && feedConnection.invoke("JoinGroup", g),
    leaveGroup: (g) => feedConnection.state === "Connected" && feedConnection.invoke("LeaveGroup", g)
};

// 3. LISTEN FOR POSTS
feedConnection.on("ReceivePost", function (message) {
    const contextInput = document.getElementById('page-signalr-context');
    const pageContext = contextInput ? contextInput.value : null;
    if (message.targetGroup === pageContext || message.targetGroup === "feed_global") {
        renderNewPost(message.data);
    }
});

// --- EXISTING SIGNALR LISTENERS ---

feedConnection.on("UpdatePost", function (msg) {
    const card = document.getElementById(`post-${msg.postId}`);
    if (card) {
        const titleEl = card.querySelector('.post-title');
        const textEl = card.querySelector('.post-text');

        if (titleEl && msg.data.title) titleEl.innerText = msg.data.title;
        if (textEl && msg.data.text) textEl.innerHTML = msg.data.text;

        card.style.transition = "background-color 0.5s";
        card.style.backgroundColor = "#2a2a2a";
        setTimeout(() => card.style.backgroundColor = "", 500);
    }
});

feedConnection.on("RemovePost", function (msg) {
    const card = document.getElementById(`post-${msg.postId}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 300);
    }
});

// --- SERVICE METHODS ---

window.FeedService.deletePost = async (id) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
        const res = await fetch(`/api/posts/${id}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (!res.ok) alert("Failed to delete post.");
    } catch (err) { console.error(err); }
};

// --- SINGLE POST MODAL ---
window.FeedService.openPostModal = async (postId, autoComment = false) => {
    const modalEl = document.getElementById('singlePostModal');
    const container = document.getElementById('singlePostContainer');

    if (!modalEl || !container) {
        console.error("Modal elements not found in Layout");
        return;
    }

    modalEl.classList.add('active');
    container.innerHTML = '<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-2x text-white"></i></div>';

    try {
        const res = await fetch(`/api/posts/${postId}/card`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (!res.ok) throw new Error("Post not found");

        const html = await res.text();
        container.innerHTML = html;

        if (autoComment) {
            setTimeout(() => {
                const commentBtn = container.querySelector('.btn-comment-toggle');
                if (commentBtn) commentBtn.click();
            }, 300);
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="text-center p-4 text-danger">Failed to load post. It may have been deleted.</div>';
    }
};

// --- EDIT MODAL LOGIC ---

window.FeedService.openEditModal = async (id) => {
    try {
        const res = await fetch(`/api/posts/${id}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        const post = await res.json();

        document.getElementById('editPostId').value = post.id;
        document.getElementById('editPostTitle').value = post.title || "";
        document.getElementById('editPostText').value = post.text || "";

        const mediaContainer = document.getElementById('editMediaList');
        mediaContainer.innerHTML = '';
        post.media?.forEach(m => {
            const div = document.createElement('div');
            div.className = "position-relative";
            div.innerHTML = `
                <img src="${m.url}" class="rounded" style="width:60px;height:60px;object-fit:cover;">
                <button onclick="window.deleteMedia('${post.id}', '${m.id}', this)" class="btn btn-sm btn-danger position-absolute top-0 start-100 translate-middle badge rounded-pill">X</button>
            `;
            mediaContainer.appendChild(div);
        });

        const modal = document.getElementById('editPostModal');
        modal.classList.add('active');

    } catch (err) { console.error(err); }
};

window.FeedService.submitEdit = async () => {
    const id = document.getElementById('editPostId').value;
    const body = {
        Title: document.getElementById('editPostTitle').value,
        Text: document.getElementById('editPostText').value
    };

    const res = await fetch(`/api/posts/${id}`, {
        method: 'PUT',
        headers: {
            "Content-Type": "application/json",
            "X-Session-Id": window.AuthState?.sessionId || ""
        },
        body: JSON.stringify(body)
    });

    if (res.ok) {
        closeAllModals();
    } else {
        alert("Update failed");
    }
};

window.deleteMedia = async (postId, mediaId, btnElement) => {
    if (!confirm("Remove this attachment?")) return;

    const wrapper = btnElement.closest('.position-relative');
    wrapper.style.opacity = '0.5';

    try {
        const res = await fetch(`/api/posts/${postId}/media/${mediaId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            wrapper.remove();
        } else {
            alert("Failed to delete media.");
            wrapper.style.opacity = '1';
        }
    } catch (err) {
        console.error(err);
        wrapper.style.opacity = '1';
    }
};

// --- GLOBAL MODAL CLOSER ---
document.addEventListener('click', function (e) {
    if (e.target.matches('.btn-close') || e.target.matches('[data-bs-dismiss="modal"]') || e.target.closest('[data-bs-dismiss="modal"]')) {
        closeAllModals();
    }
    if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        closeAllModals();
    }
});

function closeAllModals() {
    const modals = document.querySelectorAll('.modal.active');
    modals.forEach(m => {
        m.classList.remove('active');
        m.style.display = '';
        m.style.opacity = '';
    });
}

// 4. POST RENDERING (Match Server HTML)
function renderNewPost(post) {
    const container = document.getElementById('feed-stream-container');
    if (!container) return;

    const emptyMsg = document.getElementById('empty-feed-msg');
    if (emptyMsg) emptyMsg.remove();

    const authorPic = post.authorPic && post.authorPic !== "null" ? post.authorPic : "/img/profile_default.jpg";
    const isOwner = window.AuthState && String(window.AuthState.userId) === String(post.authorId);
    const div = document.createElement('div');

    div.innerHTML = `
        <div class="post-card" id="post-${post.id}" style="animation: fadeIn 0.5s ease;">
            <div class="post-header">
                <div class="d-flex align-items-center">
                    <a href="/creator/${post.authorId}" class="post-avatar-link">
                        <img src="${authorPic}" class="post-avatar-img" alt="${post.authorName}" onerror="this.src='/img/profile_default.jpg'">
                    </a>
                    <div class="post-info-col">
                        <div class="d-flex align-items-center gap-2">
                            <a href="/creator/${post.authorId}" class="post-author-name">${post.authorName || 'User'}</a>
                        </div>
                        <div class="post-meta-line"><span>Just now</span></div>
                    </div>
                </div>
                <div class="ms-auto position-relative">
                    <button class="btn btn-link text-muted p-0 btn-post-options" type="button"><i class="fas fa-ellipsis-h"></i></button>
                    <ul class="post-options-menu">
                        <li><a href="#"><i class="fas fa-flag me-2"></i> Report Post</a></li>
                        <li><a href="#"><i class="fas fa-link me-2"></i> Copy Link</a></li>
                        ${isOwner ? `
                        <li>
                            <a href="#" class="dropdown-item" onclick="window.FeedService.openEditModal('${post.id}'); return false;">
                                <i class="fas fa-edit me-2"></i> Edit
                            </a>
                        </li>
                        <li>
                            <a href="#" class="dropdown-item text-danger" onclick="window.FeedService.deletePost('${post.id}'); return false;">
                                <i class="fas fa-trash me-2"></i> Delete
                            </a>
                        </li>` : ''}
                    </ul>
                </div>
            </div>

            <div class="post-body">
                ${post.title ? `<h5 class="post-title">${post.title}</h5>` : ''}
                ${post.text ? `<div class="post-text text-break">${post.text}</div>` : ''}
                ${renderAttachments(post.attachments)}
            </div>

            <div class="post-footer">
                <button class="btn-post-action btn-like" data-id="${post.id}">
                    <i class="far fa-heart"></i> Like ${post.likesCount > 0 ? `(${post.likesCount})` : ''}
                </button>
                <button class="btn-post-action btn-comment-toggle" data-id="${post.id}">
                    <i class="far fa-comment"></i> Comment ${post.commentsCount > 0 ? `(${post.commentsCount})` : ''}
                </button>
                <button class="btn-post-action"><i class="far fa-share-square"></i> Share</button>
            </div>

            <div id="comments-${post.id}" class="d-none border-top border-secondary p-3">
                <div id="comments-list-${post.id}" class="mb-3"></div>
                
                <div class="d-flex align-items-center gap-2">
                    <img src="/img/profile_default.jpg" class="input-avatar" alt="Me">
                    <div class="comment-input-area">
                        <input type="text" id="comment-input-${post.id}" 
                               placeholder="Write a comment..." 
                               autocomplete="off">
                        <button class="btn-comment-post" onclick="submitReply('${post.id}', null)">Post</button>
                    </div>
                </div>
            </div>
        </div>`;

    container.insertBefore(div.firstElementChild, container.firstChild);
}

// -------------------------------------------------------------
// THIS IS THE CRITICAL FIX: LAZY LOADING LOGIC
// -------------------------------------------------------------
function renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    let html = `<div class="row g-2 mt-3">`;

    attachments.forEach(media => {
        const colClass = attachments.length === 1 ? "col-12" : "col-6";
        html += `<div class="${colClass}">`;

        if (media.mediaType === 3) {
            // IMAGE
            html += `
            <div class="post-media-container">
                <img src="${media.url}" class="img-fluid full-media" loading="lazy">
            </div>`;
        }
        else if (media.mediaType === 2) {
            // VIDEO

            // 1. Check if thumb exists
            const hasThumb = media.snippetPath && media.snippetPath !== "null";
            const thumbClass = hasThumb ? "thumb-mode" : "";
            // Ensure slashes are correct for CSS
            const thumbStyle = hasThumb ? `style="background-image: url('${media.snippetPath.replace(/\\/g, '/')}')"` : "";

            // 2. Logic: If thumb exists, we HIDE the video (d-none) and use data-src.
            //    This allows the background image to show.
            //    If no thumb, we show the video immediately.
            const srcAttr = hasThumb ? `data-src="${media.url}"` : `src="${media.url}"`;
            const videoClass = hasThumb ? "custom-video d-none" : "custom-video";

            html += `
            <div class="custom-video-wrapper ${thumbClass}" ${thumbStyle} id="video-container-${media.mediaId}">
                <video ${srcAttr} class="${videoClass}" preload="metadata"></video>
                
                <div class="video-overlay-play">
                    <i class="fas fa-play"></i>
                </div>

                <div class="video-controls">
                    <button class="v-btn v-play-toggle"><i class="fas fa-play"></i></button>
                    
                    <div class="v-progress-container">
                        <div class="v-progress-fill"></div>
                    </div>
                    
                    <button class="v-btn v-fullscreen-toggle"><i class="fas fa-expand"></i></button>
                </div>
            </div>`;
        }
        else if (media.mediaType === 1) {
            // AUDIO
            const trackTitle = "Track";
            const trackUrl = media.url;
            html += `
            <div class="track-card">
                <button class="btn-track-play" 
                        onclick="if(window.AudioPlayer) window.AudioPlayer.playTrack('${trackUrl}', { title: '${trackTitle}' })">
                    <i class="fas fa-play"></i>
                </button>
                <div class="track-info">
                    <div class="track-title">${trackTitle}</div>
                    <div class="track-artist">Audio</div>
                </div>
                <div class="track-wave"><span></span><span></span><span></span><span></span><span></span></div>
            </div>`;
        }

        html += `</div>`;
    });
    return html + `</div>`;
}

// ============================================
// 5. CREATE POST LOGIC
// ============================================

let activeFileInput = null;
let activeMediaType = null;

window.handleFileSelect = function (input, type) {
    document.querySelectorAll('input[type="file"]').forEach(el => {
        if (el !== input) el.value = '';
    });

    const preview = document.getElementById('mediaPreview');
    const titleGroup = document.getElementById('postTitleGroup');
    const titleInput = document.getElementById('postTitle');

    if (input.files && input.files[0]) {
        activeFileInput = input;
        activeMediaType = type;
        const file = input.files[0];

        preview.classList.remove('d-none');
        let icon = 'fa-paperclip';
        let color = 'text-white';

        if (type === 'audio') {
            icon = 'fa-music';
            color = 'text-warning';
            titleGroup.style.display = 'block';
            titleInput.placeholder = "Track Title (Required)";
            titleInput.focus();
        }
        else if (type === 'video') {
            icon = 'fa-video';
            color = 'text-primary';
            titleGroup.style.display = 'block';
            titleInput.placeholder = "Video Title (Optional)";
        }
        else {
            if (type === 'image') { icon = 'fa-image'; color = 'text-success'; }
            titleGroup.style.display = 'none';
        }

        preview.innerHTML = `
            <div class="d-flex align-items-center bg-dark p-2 rounded border border-secondary">
                <i class="fas ${icon} ${color} me-3 fs-4"></i>
                <div class="flex-grow-1 text-truncate">
                    <span class="text-white small">${file.name}</span>
                </div>
                <button type="button" onclick="clearAttachment()" class="btn btn-sm text-muted hover-danger">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;
    } else {
        clearAttachment();
    }
};

window.clearAttachment = function () {
    if (activeFileInput) activeFileInput.value = '';
    activeFileInput = null;
    activeMediaType = null;

    document.getElementById('mediaPreview').classList.add('d-none');
    document.getElementById('mediaPreview').innerHTML = '';
    document.getElementById('postTitleGroup').style.display = 'none';
    document.getElementById('postTitle').value = '';
};

// SUBMIT HANDLER - UPDATED FOR SPLIT ROUTES & CLIENT-SIDE VIDEO PROCESSING
document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'createPostForm') {
        e.preventDefault();

        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const textArea = document.getElementById('postContent');
        const titleInput = document.getElementById('postTitle');
        const cType = form.querySelector('input[name="ContextType"]')?.value;
        const cId = form.querySelector('input[name="ContextId"]')?.value;

        if (!cType || !cId) { alert("Error: Page Context is missing."); return; }

        const hasText = textArea.value.trim().length > 0;
        const hasFile = activeFileInput && activeFileInput.files.length > 0;

        if (!hasText && !hasFile) {
            alert("Please enter text or select a file.");
            return;
        }

        if (activeMediaType === 'audio' && !titleInput.value.trim()) {
            alert("Please enter a Title for your track.");
            titleInput.focus();
            return;
        }

        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;

        try {
            let attachments = [];

            if (hasFile) {
                const uploadData = new FormData();
                const file = activeFileInput.files[0];
                uploadData.append("file", file);

                let uploadEndpoint = "/api/upload/image"; // Default

                // 1. ROUTING LOGIC
                if (activeMediaType === 'video') {
                    submitBtn.innerText = "Processing Video...";
                    uploadEndpoint = "/api/upload/video";

                    // Client-Side processing
                    try {
                        const meta = await window.processVideoUpload(file);

                        // Append Metadata
                        if (meta.thumbnailBlob) {
                            uploadData.append("thumbnail", meta.thumbnailBlob, "thumbnail.jpg");
                        }
                        uploadData.append("duration", meta.duration);
                        uploadData.append("width", meta.width);
                        uploadData.append("height", meta.height);
                    } catch (videoErr) {
                        console.warn("Video Client Processing Failed", videoErr);
                        // We proceed with the upload, but without metadata (server handles fallback or defaults)
                    }

                    submitBtn.innerText = "Uploading Video...";
                }
                else if (activeMediaType === 'audio') {
                    submitBtn.innerText = "Uploading Audio...";
                    uploadEndpoint = "/api/upload/audio";
                }
                else {
                    submitBtn.innerText = "Uploading Image...";
                    uploadEndpoint = "/api/upload/image";
                }

                // 2. PERFORM UPLOAD
                const uploadRes = await fetch(uploadEndpoint, {
                    method: 'POST',
                    headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                    body: uploadData
                });

                if (uploadRes.ok) {
                    const mediaResult = await uploadRes.json();
                    attachments.push({
                        MediaId: mediaResult.id,
                        MediaType: mediaResult.type,
                        Url: mediaResult.url
                    });
                } else {
                    const errText = await uploadRes.text();
                    throw new Error("Upload failed: " + errText);
                }
            }

            // 3. CREATE POST
            submitBtn.innerText = "Posting...";
            const payload = {
                ContextType: cType,
                ContextId: cId,
                Type: "standard",
                Title: titleInput.value.trim(),
                Text: textArea.value,
                MediaAttachments: attachments
            };

            const postRes = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': window.AuthState?.sessionId || ''
                },
                body: JSON.stringify(payload)
            });

            if (postRes.ok) {
                textArea.value = '';
                clearAttachment();
            } else {
                const errText = await postRes.text();
                alert("Failed to post: " + errText);
            }

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    }
});

// ============================================
// 6. EVENT LISTENERS (Menu, Like, Comment)
// ============================================

document.addEventListener('click', async (e) => {
    // A. HAMBURGER MENU
    const optBtn = e.target.closest('.btn-post-options');
    if (optBtn) {
        e.stopPropagation();
        const menu = optBtn.nextElementSibling;
        document.querySelectorAll('.post-options-menu').forEach(el => {
            if (el !== menu) el.classList.remove('show');
        });
        if (menu) menu.classList.toggle('show');
        return;
    }
    if (!e.target.closest('.post-options-menu')) {
        document.querySelectorAll('.post-options-menu').forEach(el => el.classList.remove('show'));
    }

    // B. LIKE BUTTON
    const likeBtn = e.target.closest('.btn-like');
    if (likeBtn) {
        const postId = likeBtn.dataset.id;
        try {
            const res = await fetch(`/api/posts/${postId}/like`, { method: "POST", headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
            if (res.ok) {
                const data = await res.json();
                const icon = likeBtn.querySelector('i');
                if (data.liked) {
                    icon.classList.remove('far'); icon.classList.add('fas', 'text-danger');
                } else {
                    icon.classList.remove('fas', 'text-danger'); icon.classList.add('far');
                }
            }
        } catch (err) { console.error(err); }
    }

    // C. COMMENT TOGGLE
    const commentBtn = e.target.closest('.btn-comment-toggle');
    if (commentBtn) {
        const postId = commentBtn.dataset.id;
        const section = document.getElementById(`comments-${postId}`);
        if (section) {
            section.classList.toggle('d-none');
            if (!section.classList.contains('d-none')) {
                loadComments(postId);
            }
        }
    }
});

// ============================================
// 7. COMMENT SYSTEM
// ============================================

async function loadComments(postId) {
    const container = document.getElementById(`comments-list-${postId}`);
    container.innerHTML = '<div class="text-muted small ps-2">Loading comments...</div>';
    try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        if (res.ok) {
            const comments = await res.json();
            container.innerHTML = '';
            if (comments.length === 0) {
                container.innerHTML = '<div class="text-muted small ps-2">No comments yet.</div>';
                return;
            }
            comments.forEach(c => container.appendChild(createCommentElement(c)));
        }
    } catch (err) { container.innerHTML = '<div class="text-danger small">Error loading comments.</div>'; }
}

function createCommentElement(c) {
    const wrapper = document.createElement('div');
    wrapper.className = "comment-item";
    wrapper.id = `comment-${c.commentId}`;
    const picUrl = c.authorPic && c.authorPic !== "null" ? c.authorPic : "/img/profile_default.jpg";

    let html = `
        <div class="d-flex align-items-start">
            <img src="${picUrl}" class="comment-avatar" onerror="this.src='/img/profile_default.jpg'">
            <div class="flex-grow-1">
                <div class="comment-content-box">
                    <span class="comment-author">${c.authorName || 'User'}</span>
                    <span class="comment-text">${c.content}</span>
                </div>
                <div class="comment-meta-line">
                    <span class="comment-time">${c.createdAgo}</span>
                    <button class="btn-reply-toggle" onclick="toggleReplyBox('${c.commentId}')">Reply</button>
                </div>
                <div id="reply-box-${c.commentId}" class="reply-input-wrapper d-none">
                     <div class="comment-input-area">
                        <input type="text" id="reply-input-${c.commentId}" placeholder="Reply to ${c.authorName}..." autocomplete="off">
                        <button class="btn-comment-post" onclick="submitReply('${c.postId}', '${c.commentId}')">Reply</button>
                    </div>
                </div>
            </div>
        </div>`;

    const repliesContainer = document.createElement('div');
    repliesContainer.className = "replies-container";
    if (c.replies && c.replies.length > 0) {
        c.replies.forEach(reply => {
            repliesContainer.appendChild(createCommentElement(reply));
        });
    }
    wrapper.innerHTML = html;
    wrapper.appendChild(repliesContainer);
    return wrapper;
}

window.toggleReplyBox = function (id) {
    const box = document.getElementById(`reply-box-${id}`);
    if (box) {
        box.classList.toggle('d-none');
        if (!box.classList.contains('d-none')) {
            const input = document.getElementById(`reply-input-${id}`);
            if (input) input.focus();
        }
    }
};

window.submitReply = async function (postId, parentId) {
    const inputId = parentId ? `reply-input-${parentId}` : `comment-input-${postId}`;
    const input = document.getElementById(inputId);
    const content = input.value;
    if (!content) return;

    try {
        const res = await fetch('/api/posts/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
            body: JSON.stringify({ PostId: postId, ParentId: parentId, Content: content })
        });
        if (res.ok) {
            input.value = '';
            if (parentId) {
                const box = document.getElementById(`reply-box-${parentId}`);
                if (box) box.classList.add('d-none');
            }
            loadComments(postId);
        }
    } catch (err) { console.error(err); }
};

// ============================================
// 8. INITIAL FEED LOADER (Standard Cards)
// ============================================

window.loadFeedHistory = async function (contextType, contextId) {
    const container = document.getElementById('feed-stream-container');
    if (!container) return;

    try {
        const res = await fetch(`/api/posts?contextType=${contextType}&contextId=${contextId}&page=1`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            const posts = await res.json();
            container.innerHTML = '';
            if (posts.length === 0) {
                container.innerHTML = '<div class="text-center text-muted p-5"><h3>No signals found here yet.</h3><p>Be the first to broadcast.</p></div>';
                return;
            }
            posts.forEach(post => {
                appendHistoricalPost(post, container);
            });
        } else {
            container.innerHTML = '<div class="text-danger text-center p-3">Failed to load feed.</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="text-danger text-center p-3">Connection error.</div>';
    }
};

function appendHistoricalPost(post, container) {
    const authorPic = post.authorPic && post.authorPic !== "null" ? post.authorPic : "/img/profile_default.jpg";
    const isOwner = window.AuthState && String(window.AuthState.userId) === String(post.authorId);

    const div = document.createElement('div');
    div.innerHTML = `
        <div class="post-card" id="post-${post.id}">
            <div class="post-header">
                <div class="d-flex align-items-center">
                    <a href="/creator/${post.authorId}" class="post-avatar-link">
                        <img src="${authorPic}" class="post-avatar-img" alt="${post.authorName}" onerror="this.src='/img/profile_default.jpg'">
                    </a>
                    <div class="post-info-col">
                        <div class="d-flex align-items-center gap-2">
                            <a href="/creator/${post.authorId}" class="post-author-name">${post.authorName || 'User'}</a>
                        </div>
                        <div class="post-meta-line"><span>${post.createdAgo || 'Just now'}</span></div>
                    </div>
                </div>
                <div class="ms-auto position-relative">
                    <button class="btn btn-link text-muted p-0 btn-post-options" type="button"><i class="fas fa-ellipsis-h"></i></button>
                    <ul class="post-options-menu">
                        <li><a href="#"><i class="fas fa-flag me-2"></i> Report Post</a></li>
                        <li><a href="#"><i class="fas fa-link me-2"></i> Copy Link</a></li>
                        ${isOwner ? `
                        <li>
                            <a href="#" class="dropdown-item" onclick="window.FeedService.openEditModal('${post.id}'); return false;">
                                <i class="fas fa-edit me-2"></i> Edit
                            </a>
                        </li>
                        <li>
                            <a href="#" class="dropdown-item text-danger" onclick="window.FeedService.deletePost('${post.id}'); return false;">
                                <i class="fas fa-trash me-2"></i> Delete
                            </a>
                        </li>` : ''}
                    </ul>
                </div>
            </div>

            <div class="post-body">
                ${post.title ? `<h5 class="post-title">${post.title}</h5>` : ''}
                ${post.text ? `<div class="post-text text-break">${post.text}</div>` : ''}
                ${renderAttachments(post.attachments)}
            </div>

            <div class="post-footer">
                <button class="btn-post-action btn-like" data-id="${post.id}">
                    <i class="${post.isLiked ? 'fas text-danger' : 'far'} fa-heart"></i> Like ${post.likesCount > 0 ? `(${post.likesCount})` : ''}
                </button>
                <button class="btn-post-action btn-comment-toggle" data-id="${post.id}">
                    <i class="far fa-comment"></i> Comment ${post.commentsCount > 0 ? `(${post.commentsCount})` : ''}
                </button>
                <button class="btn-post-action"><i class="far fa-share-square"></i> Share</button>
            </div>

            <div id="comments-${post.id}" class="d-none border-top border-secondary p-3">
                <div id="comments-list-${post.id}" class="mb-3"></div>
                <div class="d-flex align-items-center gap-2">
                    <img src="/img/profile_default.jpg" class="input-avatar" alt="Me">
                    <div class="comment-input-area">
                        <input type="text" id="comment-input-${post.id}" placeholder="Write a comment..." autocomplete="off">
                        <button class="btn-comment-post" onclick="submitReply('${post.id}', null)">Post</button>
                    </div>
                </div>
            </div>
        </div>`;

    container.appendChild(div.firstElementChild);
}

// ============================================
// 9. AUDIO DISCOVERY LOADER (Playlist View)
// ============================================

window.loadAudioPlaylist = async () => {
    const container = document.getElementById('audio-feed-list');
    if (!container) return;

    try {
        const res = await fetch('/api/posts?contextType=discover&contextId=0', {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (!res.ok) throw new Error("Failed to load audio");
        const posts = await res.json();

        if (!posts || posts.length === 0) {
            container.innerHTML = `<div class="text-center py-5 text-muted">No audio tracks found recently.</div>`;
            return;
        }

        let html = '';
        posts.forEach((post) => {
            const audio = post.attachments && post.attachments.find(a => a.mediaType === 1);
            if (!audio) return;

            const trackSrc = audio.url;
            const imageSrc = post.authorPic && post.authorPic !== "null" ? post.authorPic : '/img/profile_default.jpg';
            const title = post.title || 'Untitled Track';
            const titleEscaped = title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const artist = post.authorName || 'Unknown Artist';
            const profileLink = `/creator/${post.authorId}`;
            const timeAgo = post.createdAgo || 'Just now';

            html += `
<div class="audio-row">
    <div class="audio-meter"><span></span><span></span><span></span><span></span></div>

    <button class="btn-track-play" 
            onclick="window.playTrackInFeed('${trackSrc}', '${titleEscaped}', this)">
        <i class="fas fa-play"></i>
    </button>

    <div class="audio-track-info">
        <div class="text-white fw-bold text-truncate" title="${title}">${title}</div>
        <a href="${profileLink}" class="text-muted small">${artist}</a>
    </div>

    <div class="audio-time-stamp text-muted small d-none d-md-block">
        <i class="far fa-clock me-1"></i> ${timeAgo}
    </div>

    <div class="audio-right-artwork">
        <a href="${profileLink}">
            <img src="${imageSrc}" alt="${artist}">
        </a>
    </div>
</div>`;
        });

        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="text-center py-5 text-danger">Error loading playlist.</div>`;
    }
};

window.playTrackInFeed = function (url, title, element) {
    if (window.AudioPlayer) {
        window.AudioPlayer.playTrack(url, { title: title });
    }
    const allRows = document.querySelectorAll('.audio-row');
    allRows.forEach(row => row.classList.remove('playing'));

    const currentRow = element.closest('.audio-row');
    if (currentRow) {
        currentRow.classList.add('playing');
    }
};

// ============================================
// 10. SHUFFLE ANIMATION & TRIGGER
// ============================================

window.triggerShuffleAnimation = async function () {
    const disc = document.getElementById('shuffle-disc');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (disc) disc.classList.add('fa-spin');
    const minTimer = new Promise(resolve => setTimeout(resolve, 1000));
    const dataLoad = window.loadAudioPlaylist ? window.loadAudioPlaylist() : Promise.resolve();

    try {
        await Promise.all([dataLoad, minTimer]);
    } catch (e) {
        console.error("Shuffle failed", e);
    }
    if (disc) disc.classList.remove('fa-spin');
};

window.triggerSocialShuffle = async function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const globe = document.getElementById('social-globe-icon');
    if (globe) globe.classList.add('spin-y-axis');
    const minTimer = new Promise(resolve => setTimeout(resolve, 800));
    const dataLoad = window.loadFeedHistory ? window.loadFeedHistory('global', '0') : Promise.resolve();

    try {
        await Promise.all([dataLoad, minTimer]);
    } catch (e) {
        console.error("Social shuffle failed", e);
    }
    if (globe) globe.classList.remove('spin-y-axis');
};

// ============================================
// 11. VIDEO HELPERS (Added)
// ============================================

// Helper: Extract Thumbnail & Metadata from Video File Client-Side
window.processVideoUpload = function (file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.playsInline = true;

        // 1. Wait for metadata
        video.onloadedmetadata = () => {
            // Seek to 1s to capture a frame (avoid black screen at 0s)
            let seekTime = 1.0;
            if (video.duration < 2) seekTime = 0.0;
            video.currentTime = seekTime;
        };

        // 2. Wait for seek to complete
        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert to Blob (JPEG)
                canvas.toBlob((blob) => {
                    const metadata = {
                        thumbnailBlob: blob,
                        duration: Math.round(video.duration),
                        width: video.videoWidth,
                        height: video.videoHeight
                    };

                    URL.revokeObjectURL(video.src);
                    resolve(metadata);
                }, 'image/jpeg', 0.85);
            } catch (err) {
                URL.revokeObjectURL(video.src);
                reject(err);
            }
        };

        video.onerror = () => {
            URL.revokeObjectURL(video.src);
            reject("Could not load video for processing.");
        };
    });
};