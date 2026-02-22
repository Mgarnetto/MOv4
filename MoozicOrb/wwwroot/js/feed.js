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
    // Handle potential duplicates (modal + feed)
    const cards = document.querySelectorAll(`#post-${msg.postId}`);
    cards.forEach(card => {
        const titleEl = card.querySelector('.post-title, .product-card__name'); // Updated to catch merch title
        const textEl = card.querySelector('.post-text, .product-card__description'); // Updated to catch merch text

        if (titleEl && msg.data.title) titleEl.innerText = msg.data.title;

        if (textEl && msg.data.text) {
            // For merch cards, we need to preserve the quantity text if we update description
            if (card.classList.contains('product-card')) {
                const qtySpan = textEl.querySelector('span');
                textEl.innerHTML = `${msg.data.text} <br>${qtySpan ? qtySpan.outerHTML : ''}`;
            } else {
                textEl.innerHTML = msg.data.text;
            }
        }

        card.style.transition = "background-color 0.5s";
        card.style.backgroundColor = "#2a2a2a";
        setTimeout(() => card.style.backgroundColor = "", 500);
    });
});

feedConnection.on("RemovePost", function (msg) {
    const cards = document.querySelectorAll(`#post-${msg.postId}`);
    cards.forEach(card => {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 300);
    });
});

// --- NEW: COMMENT SIGNALR LISTENERS ---

feedConnection.on("OnCommentUpdated", function (msg) {
    // Update ALL instances (Modal + Feed)
    const comments = document.querySelectorAll(`#comment-${msg.commentId}`);
    comments.forEach(commentEl => {
        const textEl = commentEl.querySelector('.comment-text');
        if (textEl) textEl.innerText = msg.text;

        // Ensure edit mode is closed
        const displayBox = commentEl.querySelector('.comment-display-box');
        const editBox = commentEl.querySelector('.comment-edit-box');
        if (displayBox && editBox) {
            displayBox.classList.remove('d-none');
            editBox.classList.add('d-none');
        }

        // Sync the textarea value for next time
        const ta = commentEl.querySelector('textarea');
        if (ta) ta.value = msg.text;

        // Flash effect
        commentEl.style.transition = "background-color 0.5s";
        commentEl.style.backgroundColor = "#222";
        setTimeout(() => commentEl.style.backgroundColor = "", 500);
    });
});

feedConnection.on("OnCommentDeleted", function (msg) {
    const comments = document.querySelectorAll(`#comment-${msg.commentId}`);
    comments.forEach(commentEl => {
        commentEl.style.transition = "opacity 0.3s";
        commentEl.style.opacity = '0';
        setTimeout(() => commentEl.remove(), 300);
    });
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
        // SignalR will handle the removal from UI
    } catch (err) { console.error(err); }
};

// --- UPDATED COMMENT SERVICE METHODS (With Manual UI Sync) ---

window.FeedService.deleteComment = async (postId, commentId, btnElement) => {
    if (!confirm("Delete this comment?")) return;

    // Close menu immediately
    if (btnElement) {
        const menu = btnElement.closest('.msg-context-menu');
        if (menu) menu.classList.remove('active');
    }

    try {
        const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            // MANUAL UPDATE: Remove all instances immediately
            const allInstances = document.querySelectorAll(`#comment-${commentId}`);
            allInstances.forEach(el => el.remove());
        } else {
            alert("Failed to delete comment.");
        }
    } catch (err) { console.error(err); }
};

window.FeedService.editComment = (commentId, btnElement) => {
    // Only open edit mode for the specific row clicked
    const row = btnElement.closest('.comment-item');
    if (!row) return;

    // Close menu
    row.querySelector('.msg-context-menu')?.classList.remove('active');

    // Toggle UI
    row.querySelector('.comment-display-box').classList.add('d-none');
    const editBox = row.querySelector('.comment-edit-box');
    editBox.classList.remove('d-none');

    const textarea = editBox.querySelector('textarea');
    textarea.focus();
    // Move cursor to end
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);
};

window.FeedService.cancelEditComment = (commentId, btnElement) => {
    const row = btnElement.closest('.comment-item');
    if (!row) return;

    row.querySelector('.comment-display-box').classList.remove('d-none');
    row.querySelector('.comment-edit-box').classList.add('d-none');

    // Reset textarea to original text
    const currentText = row.querySelector('.comment-text').innerText;
    row.querySelector('textarea').value = currentText;
};

window.FeedService.saveComment = async (postId, commentId, btnElement) => {
    const row = btnElement.closest('.comment-item');
    if (!row) return;

    const textarea = row.querySelector('textarea');
    const newText = textarea.value.trim();
    if (!newText) return;

    try {
        const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
            method: 'PUT',
            headers: {
                "Content-Type": "application/json",
                "X-Session-Id": window.AuthState?.sessionId || ""
            },
            body: JSON.stringify({ text: newText })
        });

        if (res.ok) {
            // MANUAL UPDATE: Sync ALL instances (Modal + Feed)
            const allInstances = document.querySelectorAll(`#comment-${commentId}`);
            allInstances.forEach(el => {
                const textEl = el.querySelector('.comment-text');
                if (textEl) textEl.innerText = newText;

                // Update hidden textarea too
                const ta = el.querySelector('textarea');
                if (ta) ta.value = newText;

                const displayBox = el.querySelector('.comment-display-box');
                const editBox = el.querySelector('.comment-edit-box');
                if (displayBox && editBox) {
                    displayBox.classList.remove('d-none');
                    editBox.classList.add('d-none');
                }
            });
        } else {
            alert("Failed to edit comment.");
        }
    } catch (err) { console.error(err); }
};

// --- SINGLE POST MODAL ---
window.FeedService.openPostModal = async (postId, autoComment = false) => {
    const modalEl = document.getElementById('singlePostModal');
    const container = document.getElementById('singlePostContainer');

    if (!modalEl || !container) return;

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
        container.innerHTML = '<div class="text-center p-4 text-danger">Failed to load post.</div>';
    }
};

// --- EDIT MODAL LOGIC (POSTS) ---

window.editSelectedFiles = []; // Track new files being added
window.currentEditPostType = 'standard'; // Track what we are editing to enforce rules
window.currentEditExistingImagesCount = 0; // Track how many DB images it already has
window.pendingMediaDeletions = []; // Track items to delete on save

// HELPER: Controls visibility of the file input based on strict constraints
window.checkEditImageLimit = function () {
    const input = document.getElementById('editImageInput');
    if (!input) return;

    const label = input.previousElementSibling;
    const total = window.currentEditExistingImagesCount + window.editSelectedFiles.length;

    if (window.currentEditPostType !== 'merch') {
        input.removeAttribute('multiple'); // Standard posts: 1 at a time
        if (total >= 1) {
            input.style.display = 'none'; // Completely hide if they hit the 1 limit
            if (label) label.style.display = 'none';
        } else {
            input.style.display = 'block';
            if (label) label.style.display = 'block';
        }
    } else {
        input.setAttribute('multiple', 'multiple'); // Merch: Multi-select allowed
        if (total >= 5) {
            input.style.display = 'none';
            if (label) label.style.display = 'none';
        } else {
            input.style.display = 'block';
            if (label) label.style.display = 'block';
        }
    }
};

window.FeedService.openEditModal = async (id) => {
    try {
        // 1. Hide Single Post Modal if it is open so they don't overlap awkwardly
        const singleModal = document.getElementById('singlePostModal');
        if (singleModal && singleModal.classList.contains('active')) {
            singleModal.classList.remove('active');
        }

        // 2. Close any lingering 3-dot dropdown menus
        document.querySelectorAll('.post-options-menu.show').forEach(el => el.classList.remove('show'));

        // Reset the "Add New" inputs and tracking variables
        window.editSelectedFiles = [];
        window.currentEditPostType = 'standard';
        window.currentEditExistingImagesCount = 0;
        window.pendingMediaDeletions = []; // Reset queue

        const preview = document.getElementById('editImagePreview');
        if (preview) preview.innerHTML = '';
        const fileInput = document.getElementById('editImageInput');
        if (fileInput) fileInput.value = '';

        // 3. Fetch the post data
        const res = await fetch(`/api/posts/${id}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        if (!res.ok) throw new Error("Failed to load post data.");

        const post = await res.json();

        // 4. Populate Text/Title/Type
        document.getElementById('editPostId').value = post.id;
        document.getElementById('editPostType').value = post.type || "standard";
        window.currentEditPostType = post.type || "standard"; // Save state for constraints

        document.getElementById('editPostTitle').value = post.title || "";
        document.getElementById('editPostText').value = post.text || "";

        // TOGGLE MERCH FIELDS
        const merchFields = document.getElementById('editMerchFields');
        if (merchFields) {
            if (post.type === 'merch') {
                merchFields.classList.remove('d-none');
                document.getElementById('editPostPrice').value = post.price !== null ? post.price : "";
                document.getElementById('editPostQuantity').value = post.quantity !== null ? post.quantity : "";
            } else {
                merchFields.classList.add('d-none');
            }
        }

        // 5. Populate the Media Grid with fixed Delete Badges (UPDATED FOR ALL MEDIA)
        const mediaContainer = document.getElementById('editMediaList');
        if (mediaContainer) {
            mediaContainer.innerHTML = ''; // Clear old media

            if (post.attachments && post.attachments.length > 0) {
                // Track total existing media attachments
                window.currentEditExistingImagesCount = post.attachments.length;

                post.attachments.forEach(m => {
                    const div = document.createElement('div');
                    div.style.position = 'relative';
                    div.style.display = 'inline-block';
                    div.style.margin = '10px 15px 10px 0';

                    let mediaThumbnail = '';

                    if (m.mediaType === 3) {
                        // IMAGE: Standard render
                        mediaThumbnail = `<img src="${m.url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #444;">`;
                    }
                    else if (m.mediaType === 2) {
                        // VIDEO: Use snippet path as thumbnail, layer a video icon over it
                        const thumbSrc = (m.snippetPath && m.snippetPath !== "null") ? m.snippetPath.replace(/\\/g, '/') : '/img/default_cover.jpg';
                        mediaThumbnail = `
                            <div style="width: 80px; height: 80px; border-radius: 8px; border: 1px solid #444; position: relative; overflow: hidden; background: #000;">
                                <img src="${thumbSrc}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.5;">
                                <i class="fas fa-video" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);"></i>
                            </div>`;
                    }
                    else if (m.mediaType === 1) {
                        // AUDIO: Render a sleek box with a music icon
                        mediaThumbnail = `
                            <div style="width: 80px; height: 80px; border-radius: 8px; border: 1px solid #444; background: #1a1a1a; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-music text-warning" style="font-size: 24px;"></i>
                            </div>`;
                    }

                    div.innerHTML = `
                        ${mediaThumbnail}
                        <button type="button" onclick="window.deleteMedia('${post.id}', '${m.mediaId}', this)" 
                                style="position: absolute; top: -10px; right: -10px; background-color: #ff4d4d; color: white; border: 2px solid #1a1a1a; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; z-index: 10; padding: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">
                            &times;
                        </button>
                    `;
                    mediaContainer.appendChild(div);
                });
            } else {
                mediaContainer.innerHTML = '<span class="text-muted small">No media attached.</span>';
            }
        }

        // 6. Check constraints to see if we should show/hide the Add File input
        window.checkEditImageLimit();

        // 7. Show the Edit Modal
        const modal = document.getElementById('editPostModal');
        if (modal) modal.classList.add('active');

    } catch (err) {
        console.error(err);
        alert("Error loading post for editing.");
    }
};

// HANDLES NEW FILES (With Strict Constraints)
window.previewEditImage = function (input) {
    if (input.files) {
        for (let i = 0; i < input.files.length; i++) {
            const total = window.currentEditExistingImagesCount + window.editSelectedFiles.length;

            if (window.currentEditPostType !== 'merch' && total >= 1) {
                alert("Standard posts can only have 1 media file limit.");
                break;
            }
            if (window.currentEditPostType === 'merch' && total >= 5) {
                alert("Store items can have up to 5 images max.");
                break;
            }

            window.editSelectedFiles.push(input.files[i]);
        }
    }
    input.value = ''; // Reset so they can add more if allowed
    window.renderEditImagePreviews();
    window.checkEditImageLimit();
};

window.renderEditImagePreviews = function () {
    const previewContainer = document.getElementById('editImagePreview');
    if (!previewContainer) return;
    previewContainer.innerHTML = '';

    window.editSelectedFiles.forEach((file, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.margin = '10px 15px 10px 0';

        let previewHtml = '';

        if (file.type.startsWith('video/')) {
            // Render a dark box with a video icon for new video files
            previewHtml = `
                <div style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px dashed #00AEEF; background: #000; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-video text-white" style="font-size: 24px;"></i>
                </div>`;
        } else if (file.type.startsWith('audio/')) {
            // Render a dark box with a music icon for new audio files
            previewHtml = `
                <div style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px dashed #00AEEF; background: #1a1a1a; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-music text-warning" style="font-size: 24px;"></i>
                </div>`;
        } else {
            // Standard image preview
            previewHtml = `<img src="${URL.createObjectURL(file)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px dashed #00AEEF;">`;
        }

        wrapper.innerHTML = `
            ${previewHtml}
            <button type="button" onclick="window.removeEditImage(${index})" 
                    style="position: absolute; top: -10px; right: -10px; background-color: #ff4d4d; color: white; border: 2px solid #1a1a1a; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; z-index: 10; padding: 0;">
                &times;
            </button>
        `;
        previewContainer.appendChild(wrapper);
    });
};
window.removeEditImage = function (index) {
    window.editSelectedFiles.splice(index, 1);
    window.renderEditImagePreviews();
    window.checkEditImageLimit();
};

window.FeedService.submitEdit = async () => {
    const btn = document.getElementById('btnSubmitEdit');
    const originalText = btn.innerText;
    btn.disabled = true;

    try {
        const id = document.getElementById('editPostId').value;
        const type = document.getElementById('editPostType').value;

        let parsedPrice = null;
        let parsedQty = null;

        // Collect Merch Data if applicable
        if (type === 'merch') {
            const rawPrice = document.getElementById('editPostPrice').value;
            const rawQty = document.getElementById('editPostQuantity').value;
            parsedPrice = rawPrice ? parseFloat(rawPrice) : null;
            parsedQty = rawQty ? parseInt(rawQty) : null;
        }

        // --- PROCESS DELETIONS FIRST ---
        if (window.pendingMediaDeletions && window.pendingMediaDeletions.length > 0) {
            for (let i = 0; i < window.pendingMediaDeletions.length; i++) {
                btn.innerText = `Removing old media...`;
                await fetch(`/api/posts/${id}/media/${window.pendingMediaDeletions[i]}`, {
                    method: 'DELETE',
                    headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
                });
            }
        }

        let newAttachments = [];

        // --- UPLOAD NEW MEDIA SEQUENTIALLY (WITH AUDIO/VIDEO SUPPORT) ---
        if (window.editSelectedFiles.length > 0) {
            for (let i = 0; i < window.editSelectedFiles.length; i++) {
                const file = window.editSelectedFiles[i];
                const uploadData = new FormData();
                uploadData.append("file", file);

                let uploadEndpoint = "/api/upload/image";

                if (file.type.startsWith('video/')) {
                    btn.innerText = `Processing Video ${i + 1}...`;
                    uploadEndpoint = "/api/upload/video";
                    try {
                        const meta = await window.processVideoUpload(file);
                        if (meta.thumbnailBlob) {
                            uploadData.append("thumbnail", meta.thumbnailBlob, "thumbnail.jpg");
                        }
                        uploadData.append("duration", meta.duration);
                        uploadData.append("width", meta.width);
                        uploadData.append("height", meta.height);
                    } catch (videoErr) {
                        console.warn("Video Client Processing Failed", videoErr);
                    }
                    btn.innerText = `Uploading Video ${i + 1}...`;
                }
                else if (file.type.startsWith('audio/')) {
                    btn.innerText = `Uploading Audio ${i + 1}...`;
                    uploadEndpoint = "/api/upload/audio";
                }
                else {
                    btn.innerText = `Uploading Image ${i + 1}...`;
                    uploadEndpoint = "/api/upload/image";
                }

                const uploadRes = await fetch(uploadEndpoint, {
                    method: 'POST',
                    headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                    body: uploadData
                });

                if (!uploadRes.ok) throw new Error(`Upload failed for media ${i + 1}`);
                const mediaResult = await uploadRes.json();

                newAttachments.push({
                    MediaId: mediaResult.id,
                    MediaType: mediaResult.type,
                    Url: mediaResult.url
                });
            }
        }

        btn.innerText = "Saving Changes...";

        const body = {
            Title: document.getElementById('editPostTitle').value,
            Text: document.getElementById('editPostText').value,
            Price: parsedPrice,
            Quantity: isNaN(parsedQty) ? null : parsedQty,
            MediaAttachments: newAttachments // Send the array of newly uploaded media
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

            // 1. Get Context
            let currentType = 'global';
            let currentId = '0';

            const sigCtx = document.getElementById('page-signalr-context')?.value;
            if (sigCtx) {
                if (sigCtx.startsWith('user_')) {
                    currentType = 'user';
                    currentId = sigCtx.split('_')[1];
                }
            }

            // 2. CHECK WHICH PAGE WE ARE ON TO RELOAD CORRECTLY
            const storefrontContainer = document.getElementById('storefront-grid-container');

            if (storefrontContainer && window.loadStorefront) {
                // SPA SEAMLESS RELOAD: We are on the dedicated Storefront page
                window.loadStorefront(currentId);
            } else if (window.loadFeedHistory) {
                // SPA SEAMLESS RELOAD: We are on the Main Profile / Timeline page
                window.loadFeedHistory(currentType, currentId);
            }

        } else {
            alert("Update failed.");
        }
    } catch (err) {
        console.error(err);
        alert("Error saving changes.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    }
};

window.deleteMedia = function (postId, mediaId, btnElement) {
    // 1. Visually remove the image from the DOM
    const wrapper = btnElement.parentElement;
    if (wrapper) wrapper.remove();

    // 2. Add the mediaId to our deletion queue
    window.pendingMediaDeletions.push(mediaId);

    // 3. Free up the visual limit so they can upload a replacement immediately
    window.currentEditExistingImagesCount = Math.max(0, window.currentEditExistingImagesCount - 1);
    window.checkEditImageLimit();

    // 4. Show the "No media" message if empty
    const mediaContainer = document.getElementById('editMediaList');
    if (mediaContainer && mediaContainer.children.length === 0) {
        mediaContainer.innerHTML = '<span class="text-muted small">No media attached.</span>';
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

    // Close Context Menus if clicking elsewhere
    if (!e.target.closest('.msg-options-btn') && !e.target.closest('.msg-context-menu')) {
        document.querySelectorAll('.msg-context-menu.active').forEach(el => el.classList.remove('active'));
    }
});

function closeAllModals() {
    const modals = document.querySelectorAll('.modal.active, .commerce-modal-overlay.active');
    modals.forEach(m => {
        m.classList.remove('active');
        m.style.display = '';
        m.style.opacity = '';
    });
}

// 4. POST RENDERING (Match Server HTML)
function renderNewPost(post) {
    // NEW: Route merch posts to the carousel
    if (post.type === 'merch') {
        const storeContainer = document.getElementById('store-carousel-container');
        if (storeContainer) {
            const dummyContainer = document.createElement('div');
            renderMerchCard(post, dummyContainer);
            // Insert at beginning of carousel
            storeContainer.insertBefore(dummyContainer.firstElementChild, storeContainer.firstChild);
        }
        return;
    }

    const container = document.getElementById('feed-stream-container');
    if (!container) return;

    const emptyMsg = document.getElementById('empty-feed-msg');
    if (emptyMsg) emptyMsg.remove();

    const authorPic = post.authorPic && post.authorPic !== "null" ? post.authorPic : "/img/profile_default.jpg";
    const isOwner = window.AuthState && String(window.AuthState.userId) === String(post.authorId);

    // UPDATED: Use TimeAgo helper
    const timeDisplay = (window.timeAgo && post.createdAt)
        ? window.timeAgo(post.createdAt)
        : 'Just now';

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
                        <div class="post-meta-line"><span>${timeDisplay}</span></div>
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

    const postEl = div.firstElementChild;
    postEl.classList.add('feed-interactive');

    // [FIX] - Click Listener Logic for Menu Closing
    postEl.addEventListener('click', (e) => {
        // 1. Exclude clickable elements inside the card
        if (e.target.closest('a, button, input, textarea, .custom-video-wrapper, .post-options-menu, .track-card')) {
            return;
        }
        if (window.getSelection().toString().length > 0) return;

        // 2. [NEW] Check if ANY menu is currently open
        if (document.querySelector('.post-options-menu.show')) {
            return;
        }

        e.preventDefault();
        if (window.FeedService && window.FeedService.openPostModal) {
            window.FeedService.openPostModal(post.id);
        }
    });

    container.insertBefore(postEl, container.firstChild);
}

// -------------------------------------------------------------
// HELPER: RENDER ATTACHMENTS
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
            const hasThumb = media.snippetPath && media.snippetPath !== "null";
            const thumbClass = hasThumb ? "thumb-mode" : "";
            const thumbStyle = hasThumb ? `style="background-image: url('${media.snippetPath.replace(/\\/g, '/')}')"` : "";
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
    // Force input to only allow 1 file by removing 'multiple' attribute if it exists
    input.removeAttribute('multiple');

    document.querySelectorAll('input[type="file"]').forEach(el => {
        if (el !== input) el.value = '';
    });

    const preview = document.getElementById('mediaPreview');
    const titleGroup = document.getElementById('postTitleGroup');
    const titleInput = document.getElementById('postTitle');

    if (input.files && input.files[0]) {
        // Only take the first file, even if the OS allowed selecting more
        const file = input.files[0];
        activeFileInput = input;
        activeMediaType = type;

        preview.classList.remove('d-none');
        let icon = 'fa-paperclip';
        let color = 'text-white';

        if (type === 'audio') {
            icon = 'fa-music'; color = 'text-warning';
            titleGroup.style.display = 'block';
            titleInput.placeholder = "Track Title (Required)";
            titleInput.focus();
        } else if (type === 'video') {
            icon = 'fa-video'; color = 'text-primary';
            titleGroup.style.display = 'block';
            titleInput.placeholder = "Video Title (Optional)";
        } else {
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

// SUBMIT HANDLER
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

                let uploadEndpoint = "/api/upload/image";

                if (activeMediaType === 'video') {
                    submitBtn.innerText = "Processing Video...";
                    uploadEndpoint = "/api/upload/video";
                    try {
                        const meta = await window.processVideoUpload(file);
                        if (meta.thumbnailBlob) {
                            uploadData.append("thumbnail", meta.thumbnailBlob, "thumbnail.jpg");
                        }
                        uploadData.append("duration", meta.duration);
                        uploadData.append("width", meta.width);
                        uploadData.append("height", meta.height);
                    } catch (videoErr) {
                        console.warn("Video Client Processing Failed", videoErr);
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
                // UPDATED: Handle duplicate buttons (modal + feed)
                const buttons = document.querySelectorAll(`.btn-like[data-id="${postId}"]`);
                buttons.forEach(btn => {
                    const icon = btn.querySelector('i');
                    if (data.liked) {
                        icon.classList.remove('far'); icon.classList.add('fas', 'text-danger');
                    } else {
                        icon.classList.remove('fas', 'text-danger'); icon.classList.add('far');
                    }
                });
            }
        } catch (err) { console.error(err); }
    }

    // C. COMMENT TOGGLE (UPDATED FOR MODAL CONTEXT)
    const commentBtn = e.target.closest('.btn-comment-toggle');
    if (commentBtn) {
        const postId = commentBtn.dataset.id;

        // 1. Find the closest Card to ensure we toggle the correct section
        const card = commentBtn.closest('.post-card');
        if (!card) return;

        // 2. Find the comment section WITHIN this card
        const section = card.querySelector(`#comments-${postId}`);

        if (section) {
            section.classList.toggle('d-none');
            if (!section.classList.contains('d-none')) {
                // 3. Find the container WITHIN this card to load into
                const listContainer = card.querySelector(`#comments-list-${postId}`);
                loadComments(postId, listContainer);
            }
        }
    }
});

// ============================================
// 7. COMMENT SYSTEM (UPDATED)
// ============================================

async function loadComments(postId, targetContainer = null) {
    // UPDATED: Use provided container, or fallback to default query (may find background one)
    const container = targetContainer || document.getElementById(`comments-list-${postId}`);
    if (!container) return;

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

    // UPDATED: Check Ownership
    const isOwner = window.AuthState && String(window.AuthState.userId) === String(c.userId);

    // UPDATED: Use TimeAgo
    const timeDisplay = (window.timeAgo && c.createdAt)
        ? window.timeAgo(c.createdAt)
        : (c.createdAgo || 'Just now');

    // RESTRICTION: Only show the "Reply" button if this is a top-level comment (parentId is null)
    const isTopLevel = !c.parentId;

    let html = `
        <div class="d-flex align-items-start position-relative">
            <img src="${picUrl}" class="comment-avatar" onerror="this.src='/img/profile_default.jpg'">
            <div class="flex-grow-1">
                <div class="comment-display-box">
                    <span class="comment-author">${c.authorName || 'User'}</span>
                    <span class="comment-text">${c.content}</span>
                </div>

                <div class="comment-edit-box d-none mt-1 mb-2">
                    <textarea class="edit-mode-textarea">${c.content}</textarea>
                    <div class="d-flex justify-content-end gap-2 mt-1">
                         <button class="btn btn-sm btn-secondary" onclick="window.FeedService.cancelEditComment('${c.commentId}', this)">Cancel</button>
                         <button class="btn btn-sm btn-primary" onclick="window.FeedService.saveComment('${c.postId}', '${c.commentId}', this)">Save</button>
                    </div>
                </div>

                <div class="comment-meta-line">
                    <span class="comment-time">${timeDisplay}</span>
                    ${isTopLevel ? `<button class="btn-reply-toggle" onclick="toggleReplyBox('${c.commentId}')">Reply</button>` : ''}
                </div>
                
                <div id="reply-box-${c.commentId}" class="reply-input-wrapper d-none">
                     <div class="comment-input-area">
                        <input type="text" id="reply-input-${c.commentId}" placeholder="Reply to ${c.authorName}..." autocomplete="off">
                        <button class="btn-comment-post" onclick="submitReply('${c.postId}', '${c.commentId}')">Reply</button>
                    </div>
                </div>
            </div>

            ${isOwner ? `
            <button class="msg-options-btn" onclick="this.nextElementSibling.classList.toggle('active')">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="msg-context-menu">
                <button onclick="window.FeedService.editComment('${c.commentId}', this)">Edit</button>
                <button class="text-danger" onclick="window.FeedService.deleteComment('${c.postId}', '${c.commentId}', this)">Delete</button>
            </div>
            ` : ''}
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

// UPDATED: Toggle box based on visibility context
window.toggleReplyBox = function (id) {
    const boxes = document.querySelectorAll(`#reply-box-${id}`);
    let box = null;

    // 1. Prioritize visible one (e.g., in modal)
    box = [...boxes].find(b => b.offsetParent !== null);
    // 2. Fallback to any
    if (!box && boxes.length > 0) box = boxes[0];

    if (box) {
        box.classList.toggle('d-none');
        if (!box.classList.contains('d-none')) {
            const input = box.querySelector('input');
            if (input) input.focus();
        }
    }
};

// UPDATED: Find active input (modal vs feed)
window.submitReply = async function (postId, parentId) {
    const inputId = parentId ? `reply-input-${parentId}` : `comment-input-${postId}`;
    const inputs = document.querySelectorAll(`#${inputId}`);
    let input = null;

    // 1. Find the input that has user text
    input = [...inputs].find(el => el.value && el.value.trim().length > 0);
    // 2. Or the visible one
    if (!input) input = [...inputs].find(el => el.offsetParent !== null);

    if (!input) return;

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

            // Hide reply box if it was a reply
            if (parentId) {
                // Find parent wrapper relative to input
                const box = input.closest('.reply-input-wrapper');
                if (box) box.classList.add('d-none');
            }

            // Reload comments in the correct container
            const card = input.closest('.post-card');
            const listContainer = card ? card.querySelector(`#comments-list-${postId}`) : null;
            loadComments(postId, listContainer);
        }
    } catch (err) { console.error(err); }
};

// ============================================
// 8. INITIAL FEED LOADER (Standard Cards)
// ============================================

window.loadFeedHistory = async function (contextType, contextId) {
    const container = document.getElementById('feed-stream-container');
    const storeContainer = document.getElementById('store-carousel-container');

    // If neither container exists on this page, abort cleanly
    if (!container && !storeContainer) return;

    try {
        const res = await fetch(`/api/posts?contextType=${contextType}&contextId=${contextId}&page=1`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            const posts = await res.json();

            // Clear existing elements
            if (container) container.innerHTML = '';
            if (storeContainer) storeContainer.innerHTML = '';

            if (posts.length === 0) {
                if (container) {
                    container.innerHTML = '<div class="text-center text-muted p-5"><h3>No signals found here yet.</h3><p>Be the first to broadcast.</p></div>';
                }
                return;
            }
            posts.forEach(post => {
                appendHistoricalPost(post, container);
            });
        } else {
            if (container) container.innerHTML = '<div class="text-danger text-center p-3">Failed to load feed.</div>';
        }
    } catch (err) {
        console.error(err);
        if (container) container.innerHTML = '<div class="text-danger text-center p-3">Connection error.</div>';
    }
};

function appendHistoricalPost(post, container) {
    // NEW: Route merch posts to the carousel instead of main feed
    if (post.type === 'merch') {
        const storeContainer = document.getElementById('store-carousel-container');
        if (storeContainer) renderMerchCard(post, storeContainer);
        return;
    }

    // Safety check: If it's a standard post but no feed container exists, skip rendering
    if (!container) return;

    const authorPic = post.authorPic && post.authorPic !== "null" ? post.authorPic : "/img/profile_default.jpg";
    const isOwner = window.AuthState && String(window.AuthState.userId) === String(post.authorId);

    // UPDATED: Use TimeAgo
    const timeDisplay = (window.timeAgo && post.createdAt)
        ? window.timeAgo(post.createdAt)
        : (post.createdAgo || 'Just now');

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
                        <div class="post-meta-line"><span>${timeDisplay}</span></div>
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

    const postEl = div.firstElementChild;
    postEl.classList.add('feed-interactive');

    // [FIX] - Click Listener Logic for Menu Closing
    postEl.addEventListener('click', (e) => {
        // 1. Exclude clickable elements inside the card
        if (e.target.closest('a, button, input, textarea, .custom-video-wrapper, .post-options-menu, .track-card')) {
            return;
        }
        if (window.getSelection().toString().length > 0) return;

        // 2. [NEW] Check if ANY menu is currently open
        if (document.querySelector('.post-options-menu.show')) {
            return;
        }

        e.preventDefault();
        if (window.FeedService && window.FeedService.openPostModal) {
            window.FeedService.openPostModal(post.id);
        }
    });

    container.appendChild(postEl);
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

            // UPDATED: Use TimeAgo
            const timeAgo = (window.timeAgo && post.createdAt)
                ? window.timeAgo(post.createdAt)
                : (post.createdAgo || 'Just now');

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
// 11. VIDEO HELPERS
// ============================================

window.processVideoUpload = function (file) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
            let seekTime = 1.0;
            if (video.duration < 2) seekTime = 0.0;
            video.currentTime = seekTime;
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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

// ============================================
// 12. COMMERCE MODAL (Multi-Image Support)
// ============================================

window.commerceSelectedFiles = []; // Global array to hold multiple files

window.openCommerceModal = function (contextType, contextId, postType) {
    document.getElementById('commerceContextType').value = contextType;
    document.getElementById('commerceContextId').value = contextId;
    document.getElementById('commercePostType').value = postType;

    document.getElementById('createCommerceForm').reset();
    window.clearCommerceImages(); // Clears the array and UI

    const modalEl = document.getElementById('commerceModal');
    if (modalEl) modalEl.classList.add('active');
};

window.closeCommerceModal = function () {
    const modalEl = document.getElementById('commerceModal');
    if (modalEl) modalEl.classList.remove('active');
};

// Close modal if user clicks the dark background overlay
document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'commerceModal') {
        window.closeCommerceModal();
    }
});

// Handles file selection and pushes to our custom array
window.previewCommerceImage = function (input) {
    if (input.files) {
        for (let i = 0; i < input.files.length; i++) {
            // Optional: Limit to 5 images so they don't crash the UI
            if (window.commerceSelectedFiles.length >= 5) {
                alert("You can only upload up to 5 images per listing.");
                break;
            }
            window.commerceSelectedFiles.push(input.files[i]);
        }
    }

    // Clear the input value so the same file can be picked again if removed
    input.value = '';

    window.renderCommerceImagePreviews();
};

// Renders the grid of mini-thumbnails
window.renderCommerceImagePreviews = function () {
    const previewContainer = document.getElementById('commerceImagePreview');

    if (window.commerceSelectedFiles.length === 0) {
        previewContainer.innerHTML = '';
        previewContainer.classList.add('d-none');
        return;
    }

    previewContainer.classList.remove('d-none');
    previewContainer.innerHTML = '';

    const gridDiv = document.createElement('div');
    gridDiv.style.display = 'flex';
    gridDiv.style.flexWrap = 'wrap';
    gridDiv.style.gap = '10px';
    gridDiv.style.marginTop = '10px';

    window.commerceSelectedFiles.forEach((file, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'commerce-preview-box';
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';

        wrapper.innerHTML = `
            <img src="${URL.createObjectURL(file)}" class="commerce-preview-img" style="height: 80px; width: 80px; border-radius: 5px; border: 1px solid #555; object-fit: cover;">
            <button type="button" class="commerce-preview-remove" onclick="window.removeCommerceImage(${index})" style="position: absolute; top: -8px; right: -8px; background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; z-index: 2;">
                <i class="fas fa-times"></i>
            </button>
        `;
        gridDiv.appendChild(wrapper);
    });

    previewContainer.appendChild(gridDiv);
};

// Removes a specific image from the array based on its index
window.removeCommerceImage = function (index) {
    window.commerceSelectedFiles.splice(index, 1);
    window.renderCommerceImagePreviews();
};

// Completely resets the form's images
window.clearCommerceImages = function () {
    window.commerceSelectedFiles = [];
    window.renderCommerceImagePreviews();
};

// Handle Commerce Submission & Batch Uploading
document.addEventListener('submit', async function (e) {
    if (e.target && e.target.id === 'createCommerceForm') {
        e.preventDefault();

        const form = e.target;
        const submitBtn = document.getElementById('commerceSubmitBtn');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;

        try {
            if (window.commerceSelectedFiles.length === 0) {
                alert("At least one image is required to list an item.");
                submitBtn.disabled = false;
                return;
            }

            let attachments = [];

            // Loop through our array and upload them one by one
            for (let i = 0; i < window.commerceSelectedFiles.length; i++) {
                submitBtn.innerText = `Uploading Image ${i + 1} of ${window.commerceSelectedFiles.length}...`;

                const uploadData = new FormData();
                uploadData.append("file", window.commerceSelectedFiles[i]);

                const uploadRes = await fetch("/api/upload/image", {
                    method: 'POST',
                    headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                    body: uploadData
                });

                if (!uploadRes.ok) {
                    const errText = await uploadRes.text();
                    throw new Error(`Image ${i + 1} upload failed: ` + errText);
                }

                const mediaResult = await uploadRes.json();

                attachments.push({
                    MediaId: mediaResult.id,
                    MediaType: mediaResult.type,
                    Url: mediaResult.url
                });
            }

            submitBtn.innerText = "Creating Listing...";

            const parsedQty = parseInt(document.getElementById('commerceQuantity').value);

            const payload = {
                ContextType: document.getElementById('commerceContextType').value,
                ContextId: document.getElementById('commerceContextId').value,
                Type: document.getElementById('commercePostType').value,
                Title: document.getElementById('commerceTitle').value.trim(),
                Text: document.getElementById('commerceDescription').value.trim(),
                Price: parseFloat(document.getElementById('commercePrice').value),
                Quantity: isNaN(parsedQty) ? null : parsedQty,
                MediaAttachments: attachments // <--- Now passes the entire array of uploaded images!
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
                window.closeCommerceModal();
                form.reset();
                window.clearCommerceImages();

                // Reload the feed if the user is currently looking at it
                if (window.loadFeedHistory) {
                    window.loadFeedHistory(payload.ContextType, payload.ContextId);
                }
            } else {
                const errText = await postRes.text();
                alert("Failed to create listing: " + errText);
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
// 13. MERCH CARD RENDERER (Overlay Design)
// ============================================
function renderMerchCard(post, containerToAppend = null) {
    const container = containerToAppend || document.getElementById('store-carousel-container');
    if (!container) return;

    const imageUrl = post.attachments && post.attachments.length > 0 ? post.attachments[0].url : '/img/default_cover.jpg';
    const priceDisplay = post.price != null ? `$${post.price.toFixed(2)}` : 'Free';

    // Quantity display logic
    let qtyText = '';
    let isSoldOut = false;
    if (post.quantity !== null && post.quantity !== undefined) {
        if (post.quantity > 0) {
            qtyText = `${post.quantity} in stock`;
        } else {
            qtyText = `<span style="color: #ff4d4d;">Sold Out</span>`;
            isSoldOut = true;
        }
    }

    // Notice the updated structure: .product-card__overlay acts as the transparent container
    const cardHtml = `
      <div class="product-card" id="post-${post.id}">
        <div class="product-card__image">
          <img src="${imageUrl}" alt="${post.title || 'Product Image'}">
        </div>
        <div class="product-card__overlay">
          <div class="product-card__brand">${post.authorName}</div>
          <div class="product-card__name" title="${post.title || 'Untitled Product'}">${post.title || 'Untitled Product'}</div>
          
          <div class="product-card__price">
              ${priceDisplay}
              <span class="product-card__qty">${qtyText}</span>
          </div>
          
          <div class="product-card__actions">
            <button class="product-card__add-to-cart" ${isSoldOut ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                ${isSoldOut ? 'Sold Out' : 'Add to Cart'}
            </button>
            <button class="product-card__view-details" onclick="window.FeedService.openPostModal('${post.id}'); return false;">Details</button>
          </div>
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', cardHtml);
}

// ============================================
// 14. STORE CAROUSEL NAVIGATION
// ============================================
window.scrollStoreCarousel = function (direction) {
    const track = document.getElementById('store-carousel-container');
    if (!track) return;

    // Calculates the scroll amount: width of one card + the gap (approx 295px)
    // Multiplied by direction (1 for right, -1 for left)
    const scrollAmount = 295 * direction;

    track.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
    });
};

// ============================================
// 15. DEDICATED STOREFRONT PAGE & INVENTORY MODE
// ============================================

window.isInventoryMode = false;

window.toggleInventoryMode = function () {
    window.isInventoryMode = !window.isInventoryMode;
    const btn = document.getElementById('btnToggleInventory');

    if (btn) {
        if (window.isInventoryMode) {
            // Swap to solid yellow warning colors
            btn.style.backgroundColor = '#ffc107';
            btn.style.color = '#000';
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Done Managing</span>';
        } else {
            // Swap back to transparent outline colors
            btn.style.backgroundColor = 'transparent';
            btn.style.color = '#ffc107';
            btn.innerHTML = '<i class="fas fa-boxes"></i> <span>Manage Inventory</span>';
        }
    }

    // Toggle the visibility of all dark edit overlays on the grid cards
    document.querySelectorAll('.storefront-edit-overlay').forEach(el => {
        if (window.isInventoryMode) {
            el.classList.remove('d-none');
        } else {
            el.classList.add('d-none');
        }
    });
};

window.loadStorefront = async function (userId) {
    const container = document.getElementById('storefront-grid-container');
    if (!container) return;

    try {
        // NOTICE THE NEW postType=merch FILTER WE JUST ADDED TO THE BACKEND!
        const res = await fetch(`/api/posts?contextType=user&contextId=${userId}&page=1&postType=merch`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            const posts = await res.json();
            container.innerHTML = '';

            if (posts.length === 0) {
                container.innerHTML = '<div class="text-center w-100 text-muted p-5" style="grid-column: 1 / -1;"><h3>No products available.</h3><p>Check back later!</p></div>';
                return;
            }

            posts.forEach(post => {
                renderStorefrontCard(post, container);
            });
        } else {
            container.innerHTML = '<div class="text-danger text-center w-100 p-3">Failed to load storefront.</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="text-danger text-center w-100 p-3">Connection error.</div>';
    }
};

function renderStorefrontCard(post, container) {
    const imageUrl = post.attachments && post.attachments.length > 0 ? post.attachments[0].url : '/img/default_cover.jpg';
    const priceDisplay = post.price != null ? `$${post.price.toFixed(2)}` : 'Free';

    let qtyText = '';
    let isSoldOut = false;
    if (post.quantity !== null && post.quantity !== undefined) {
        if (post.quantity > 0) {
            qtyText = `${post.quantity} in stock`;
        } else {
            qtyText = `<span style="color: #ff4d4d;">Sold Out</span>`;
            isSoldOut = true;
        }
    }

    // Reuse your beautiful product card CSS, but stretch it to fill the CSS Grid column
    const div = document.createElement('div');
    div.className = "storefront-card-wrapper position-relative";
    // FIX: Force strict positioning so the absolute overlay is locked INSIDE this box
    div.style.position = "relative";
    div.style.display = "block";
    div.style.width = "100%";
    div.style.height = "350px";

    div.innerHTML = `
      <div class="product-card" style="width: 100%; height: 100%; margin: 0;">
        <div class="product-card__image">
          <img src="${imageUrl}" alt="${post.title}">
        </div>
        <div class="product-card__overlay">
          <div class="product-card__name">${post.title || 'Untitled Product'}</div>
          <div class="product-card__price">
              ${priceDisplay}
              <span class="product-card__qty">${qtyText}</span>
          </div>
          <div class="product-card__actions">
            <button class="product-card__add-to-cart" ${isSoldOut ? 'disabled style="opacity:0.5;"' : ''}>
                ${isSoldOut ? 'Sold Out' : 'Buy Now'}
            </button>
            <button class="product-card__view-details" onclick="window.FeedService.openPostModal('${post.id}')">Details</button>
          </div>
        </div>
      </div>
      
      <div class="storefront-edit-overlay ${window.isInventoryMode ? '' : 'd-none'}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10; border-radius: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 15px; border: 1px solid #ffc107;">
         <button class="btn btn-warning fw-bold" style="width: 75%;" onclick="window.FeedService.openEditModal('${post.id}')">
            <i class="fas fa-edit me-2"></i> Edit Listing
         </button>
         <button class="btn btn-danger fw-bold" style="width: 75%;" onclick="window.FeedService.deletePost('${post.id}')">
            <i class="fas fa-trash me-2"></i> Delete
         </button>
      </div>
    `;

    container.appendChild(div);
}