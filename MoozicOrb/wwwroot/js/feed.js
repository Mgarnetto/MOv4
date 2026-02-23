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
    const cards = document.querySelectorAll(`#post-${msg.postId}`);
    cards.forEach(card => {
        const titleEl = card.querySelector('.post-title, .product-card__name');
        const textEl = card.querySelector('.post-text, .product-card__description');

        if (titleEl && msg.data.title) titleEl.innerText = msg.data.title;

        if (textEl && msg.data.text) {
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

feedConnection.on("OnCommentUpdated", function (msg) {
    const comments = document.querySelectorAll(`#comment-${msg.commentId}`);
    comments.forEach(commentEl => {
        const textEl = commentEl.querySelector('.comment-text');
        if (textEl) textEl.innerText = msg.text;

        const displayBox = commentEl.querySelector('.comment-display-box');
        const editBox = commentEl.querySelector('.comment-edit-box');
        if (displayBox && editBox) {
            displayBox.classList.remove('d-none');
            editBox.classList.add('d-none');
        }

        const ta = commentEl.querySelector('textarea');
        if (ta) ta.value = msg.text;

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
        if (!res.ok) {
            alert("Failed to delete post.");
        } else {
            closeAllModals();
        }
    } catch (err) { console.error(err); }
};

window.FeedService.deleteComment = async (postId, commentId, btnElement) => {
    if (!confirm("Delete this comment?")) return;

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
            const allInstances = document.querySelectorAll(`#comment-${commentId}`);
            allInstances.forEach(el => el.remove());
        } else {
            alert("Failed to delete comment.");
        }
    } catch (err) { console.error(err); }
};

window.FeedService.editComment = (commentId, btnElement) => {
    const row = btnElement.closest('.comment-item');
    if (!row) return;

    row.querySelector('.msg-context-menu')?.classList.remove('active');
    row.querySelector('.comment-display-box').classList.add('d-none');

    const editBox = row.querySelector('.comment-edit-box');
    editBox.classList.remove('d-none');

    const textarea = editBox.querySelector('textarea');
    textarea.focus();
    const len = textarea.value.length;
    textarea.setSelectionRange(len, len);
};

window.FeedService.cancelEditComment = (commentId, btnElement) => {
    const row = btnElement.closest('.comment-item');
    if (!row) return;

    row.querySelector('.comment-display-box').classList.remove('d-none');
    row.querySelector('.comment-edit-box').classList.add('d-none');

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
            const allInstances = document.querySelectorAll(`#comment-${commentId}`);
            allInstances.forEach(el => {
                const textEl = el.querySelector('.comment-text');
                if (textEl) textEl.innerText = newText;

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

window.editSelectedFiles = [];
window.currentEditPostType = 'standard';
window.currentEditExistingImagesCount = 0;
window.pendingMediaDeletions = [];

window.checkEditImageLimit = function () {
    const input = document.getElementById('editImageInput');
    if (!input) return;

    const label = input.previousElementSibling;
    const total = window.currentEditExistingImagesCount + window.editSelectedFiles.length;

    if (window.currentEditPostType !== 'merch') {
        input.removeAttribute('multiple');
        if (total >= 1) {
            input.style.display = 'none';
            if (label) label.style.display = 'none';
        } else {
            input.style.display = 'block';
            if (label) label.style.display = 'block';
        }
    } else {
        input.setAttribute('multiple', 'multiple');
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
        const singleModal = document.getElementById('singlePostModal');
        if (singleModal && singleModal.classList.contains('active')) {
            singleModal.classList.remove('active');
        }

        document.querySelectorAll('.post-options-menu.show').forEach(el => el.classList.remove('show'));

        window.editSelectedFiles = [];
        window.currentEditPostType = 'standard';
        window.currentEditExistingImagesCount = 0;
        window.pendingMediaDeletions = [];

        const preview = document.getElementById('editImagePreview');
        if (preview) preview.innerHTML = '';
        const fileInput = document.getElementById('editImageInput');
        if (fileInput) fileInput.value = '';

        const res = await fetch(`/api/posts/${id}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        if (!res.ok) throw new Error("Failed to load post data.");

        const post = await res.json();

        document.getElementById('editPostId').value = post.id !== undefined ? post.id : post.Id;
        document.getElementById('editPostType').value = post.type || post.Type || "standard";
        window.currentEditPostType = post.type || post.Type || "standard";

        document.getElementById('editPostTitle').value = post.title || post.Title || "";
        document.getElementById('editPostText').value = post.text || post.Text || "";

        const merchFields = document.getElementById('editMerchFields');
        if (merchFields) {
            if (window.currentEditPostType === 'merch') {
                merchFields.classList.remove('d-none');
                document.getElementById('editPostPrice').value = post.price !== null && post.price !== undefined ? post.price : (post.Price !== null ? post.Price : "");
                document.getElementById('editPostQuantity').value = post.quantity !== null && post.quantity !== undefined ? post.quantity : (post.Quantity !== null ? post.Quantity : "");
            } else {
                merchFields.classList.add('d-none');
            }
        }

        const mediaContainer = document.getElementById('editMediaList');
        if (mediaContainer) {
            mediaContainer.innerHTML = '';

            const attachments = post.attachments || post.Attachments || [];

            if (attachments && attachments.length > 0) {
                window.currentEditExistingImagesCount = attachments.length;

                attachments.forEach(m => {
                    const div = document.createElement('div');
                    div.style.position = 'relative';
                    div.style.display = 'inline-block';
                    div.style.margin = '10px 15px 10px 0';

                    let mediaThumbnail = '';
                    let sPath = m.snippetPath || m.SnippetPath;
                    let mType = m.mediaType !== undefined ? m.mediaType : m.MediaType;
                    let mUrl = m.url || m.Url;
                    let mId = m.mediaId !== undefined ? m.mediaId : m.MediaId;
                    let pId = post.id !== undefined ? post.id : post.Id;

                    if (mType === 3) {
                        mediaThumbnail = `<img src="${mUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #444;">`;
                    }
                    else if (mType === 2) {
                        const thumbSrc = (sPath && sPath !== "null") ? sPath.replace(/\\/g, '/') : '/img/default_cover.jpg';
                        mediaThumbnail = `
                            <div style="width: 80px; height: 80px; border-radius: 8px; border: 1px solid #444; position: relative; overflow: hidden; background: #000;">
                                <img src="${thumbSrc}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.5;">
                                <i class="fas fa-video" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);"></i>
                            </div>`;
                    }
                    else if (mType === 1) {
                        mediaThumbnail = `
                            <div style="width: 80px; height: 80px; border-radius: 8px; border: 1px solid #444; background: #1a1a1a; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-music text-warning" style="font-size: 24px;"></i>
                            </div>`;
                    }

                    div.innerHTML = `
                        ${mediaThumbnail}
                        <button type="button" onclick="window.deleteMedia('${pId}', '${mId}', this)" 
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

        window.checkEditImageLimit();
        const modal = document.getElementById('editPostModal');
        if (modal) modal.classList.add('active');

    } catch (err) {
        console.error(err);
        alert("Error loading post for editing.");
    }
};

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
    input.value = '';
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
            previewHtml = `
                <div style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px dashed #00AEEF; background: #000; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-video text-white" style="font-size: 24px;"></i>
                </div>`;
        } else if (file.type.startsWith('audio/')) {
            previewHtml = `
                <div style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 2px dashed #00AEEF; background: #1a1a1a; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-music text-warning" style="font-size: 24px;"></i>
                </div>`;
        } else {
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

        if (type === 'merch') {
            const rawPrice = document.getElementById('editPostPrice').value;
            const rawQty = document.getElementById('editPostQuantity').value;
            parsedPrice = rawPrice ? parseFloat(rawPrice) : null;
            parsedQty = rawQty ? parseInt(rawQty) : null;
        }

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

        if (window.editSelectedFiles.length > 0) {
            for (let i = 0; i < window.editSelectedFiles.length; i++) {
                let file = window.editSelectedFiles[i];

                if (file.type.startsWith('image/') && window.processImageUpload) {
                    btn.innerText = `Compressing Image ${i + 1}...`;
                    try { file = await window.processImageUpload(file, 1200); }
                    catch (e) { console.warn("Compression failed", e); }
                }

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
                    Url: mediaResult.url,
                    SnippetPath: mediaResult.snippetPath || mediaResult.SnippetPath || null
                });
            }
        }

        btn.innerText = "Saving Changes...";

        const body = {
            Title: document.getElementById('editPostTitle').value,
            Text: document.getElementById('editPostText').value,
            Price: parsedPrice,
            Quantity: isNaN(parsedQty) ? null : parsedQty,
            MediaAttachments: newAttachments
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

            let currentType = 'global';
            let currentId = '0';

            const sigCtx = document.getElementById('page-signalr-context')?.value;
            if (sigCtx) {
                if (sigCtx.startsWith('user_')) {
                    currentType = 'user';
                    currentId = sigCtx.split('_')[1];
                }
            }

            const storefrontContainer = document.getElementById('storefront-grid-container');
            const photoContainer = document.getElementById('photo-gallery-container');
            const videoContainer = document.getElementById('video-hub-container');

            if (storefrontContainer && window.loadStorefront) {
                window.loadStorefront(currentId);
            } else if (photoContainer && window.loadPhotoGallery) {
                window.loadPhotoGallery(currentId);
            } else if (videoContainer && window.loadVideoHub) {
                window.loadVideoHub(currentId);
            } else if (window.loadFeedHistory) {
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
    const wrapper = btnElement.parentElement;
    if (wrapper) wrapper.remove();
    window.pendingMediaDeletions.push(mediaId);
    window.currentEditExistingImagesCount = Math.max(0, window.currentEditExistingImagesCount - 1);
    window.checkEditImageLimit();

    const mediaContainer = document.getElementById('editMediaList');
    if (mediaContainer && mediaContainer.children.length === 0) {
        mediaContainer.innerHTML = '<span class="text-muted small">No media attached.</span>';
    }
};

function closeAllModals() {
    const modals = document.querySelectorAll('.modal.active, .commerce-modal-overlay.active');

    modals.forEach(m => {
        m.querySelectorAll('video, audio').forEach(media => {
            if (!media.paused) media.pause();
        });

        m.classList.remove('active');
        m.style.display = '';
        m.style.opacity = '';
    });

    const spContainer = document.getElementById('singlePostContainer');
    if (spContainer) {
        setTimeout(() => {
            const spm = document.getElementById('singlePostModal');
            if (spm && !spm.classList.contains('active')) {
                spContainer.innerHTML = '';
            }
        }, 300);
    }
}

document.addEventListener('click', function (e) {
    if (e.target.matches('.btn-close') || e.target.matches('[data-bs-dismiss="modal"]') || e.target.closest('[data-bs-dismiss="modal"]')) {
        closeAllModals();
    }
    if (e.target.classList.contains('modal') && e.target.classList.contains('active')) {
        closeAllModals();
    }
    if (!e.target.closest('.msg-options-btn') && !e.target.closest('.msg-context-menu')) {
        document.querySelectorAll('.msg-context-menu.active').forEach(el => el.classList.remove('active'));
    }
});

// 4. POST RENDERING (Match Server HTML)
function renderNewPost(post) {
    const pType = post.type || post.Type;

    // 1. ROUTE MERCH POSTS (Defensively Blocked from Social Feed)
    if (pType === 'merch') {
        const storefrontGrid = document.getElementById('storefront-grid-container');
        if (storefrontGrid) {
            if (storefrontGrid.innerHTML.includes("No products available")) storefrontGrid.innerHTML = '';
            const dummyContainer = document.createElement('div');
            renderStorefrontCard(post, dummyContainer);
            storefrontGrid.insertBefore(dummyContainer.firstElementChild, storefrontGrid.firstChild);
        }
        return; // Exits here. Merch never enters the global feed.
    }

    const attachments = post.attachments || post.Attachments || [];

    // 2. ROUTE PHOTO GALLERY
    const photoGrid = document.getElementById('photo-gallery-container');
    if (photoGrid && attachments.some(a => (a.mediaType || a.MediaType) === 3)) {
        if (photoGrid.innerHTML.includes("No images found")) photoGrid.innerHTML = '';
        const dummyContainer = document.createElement('div');
        renderPhotoCard(post, dummyContainer);
        photoGrid.insertBefore(dummyContainer.firstElementChild, photoGrid.firstChild);
    }

    // 3. ROUTE VIDEO HUB
    const videoGrid = document.getElementById('video-hub-container');
    if (videoGrid && attachments.some(a => (a.mediaType || a.MediaType) === 2)) {
        if (videoGrid.innerHTML.includes("No videos found")) videoGrid.innerHTML = '';
        const dummyContainer = document.createElement('div');
        renderVideoCard(post, dummyContainer);
        videoGrid.insertBefore(dummyContainer.firstElementChild, videoGrid.firstChild);
    }

    // 4. ROUTE STANDARD FEED
    const container = document.getElementById('feed-stream-container');
    if (!container) return;

    const emptyMsg = document.getElementById('empty-feed-msg');
    if (emptyMsg) emptyMsg.remove();

    const pId = post.id !== undefined ? post.id : post.Id;
    const pAuthorId = post.authorId !== undefined ? post.authorId : post.AuthorId;
    const pAuthorName = post.authorName || post.AuthorName || 'User';
    const pAuthorPic = post.authorPic || post.AuthorPic || '/img/profile_default.jpg';
    const pTitle = post.title || post.Title || '';
    const pText = post.text || post.Text || '';
    const pLikesCount = post.likesCount !== undefined ? post.likesCount : (post.LikesCount || 0);
    const pCommentsCount = post.commentsCount !== undefined ? post.commentsCount : (post.CommentsCount || 0);
    const pIsLiked = post.isLiked !== undefined ? post.isLiked : (post.IsLiked || false);
    const pCreatedAt = post.createdAt || post.CreatedAt;

    const isOwner = window.AuthState && String(window.AuthState.userId) === String(pAuthorId);
    const timeDisplay = (window.timeAgo && pCreatedAt) ? window.timeAgo(pCreatedAt) : 'Just now';

    const div = document.createElement('div');

    div.innerHTML = `
        <div class="post-card" id="post-${pId}" style="animation: fadeIn 0.5s ease;">
            <div class="post-header">
                <div class="d-flex align-items-center">
                    <a href="/creator/${pAuthorId}" class="post-avatar-link">
                        <img src="${pAuthorPic === 'null' ? '/img/profile_default.jpg' : pAuthorPic}" class="post-avatar-img" alt="${pAuthorName}" onerror="this.src='/img/profile_default.jpg'">
                    </a>
                    <div class="post-info-col">
                        <div class="d-flex align-items-center gap-2">
                            <a href="/creator/${pAuthorId}" class="post-author-name">${pAuthorName}</a>
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
                            <a href="#" class="dropdown-item" onclick="window.FeedService.openEditModal('${pId}'); return false;">
                                <i class="fas fa-edit me-2"></i> Edit
                            </a>
                        </li>
                        <li>
                            <a href="#" class="dropdown-item text-danger" onclick="window.FeedService.deletePost('${pId}'); return false;">
                                <i class="fas fa-trash me-2"></i> Delete
                            </a>
                        </li>` : ''}
                    </ul>
                </div>
            </div>

            <div class="post-body">
                ${pTitle ? `<h5 class="post-title">${pTitle}</h5>` : ''}
                ${pText ? `<div class="post-text text-break">${pText}</div>` : ''}
                ${renderAttachments(attachments)}
            </div>

            <div class="post-footer">
                <button class="btn-post-action btn-like" data-id="${pId}">
                    <i class="${pIsLiked ? 'fas text-danger' : 'far'} fa-heart"></i> Like ${pLikesCount > 0 ? `(${pLikesCount})` : ''}
                </button>
                <button class="btn-post-action btn-comment-toggle" data-id="${pId}">
                    <i class="far fa-comment"></i> Comment ${pCommentsCount > 0 ? `(${pCommentsCount})` : ''}
                </button>
                <button class="btn-post-action"><i class="far fa-share-square"></i> Share</button>
            </div>

            <div id="comments-${pId}" class="d-none border-top border-secondary p-3">
                <div id="comments-list-${pId}" class="mb-3"></div>
                <div class="d-flex align-items-center gap-2">
                    <img src="/img/profile_default.jpg" class="input-avatar" alt="Me">
                    <div class="comment-input-area">
                        <input type="text" id="comment-input-${pId}" placeholder="Write a comment..." autocomplete="off">
                        <button class="btn-comment-post" onclick="submitReply('${pId}', null)">Post</button>
                    </div>
                </div>
            </div>
        </div>`;

    const postEl = div.firstElementChild;
    postEl.classList.add('feed-interactive');

    postEl.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, textarea, .custom-video-wrapper, .post-options-menu, .track-card')) {
            return;
        }
        if (window.getSelection().toString().length > 0) return;
        if (document.querySelector('.post-options-menu.show')) return;

        e.preventDefault();
        if (window.FeedService && window.FeedService.openPostModal) {
            window.FeedService.openPostModal(pId);
        }
    });

    container.insertBefore(postEl, container.firstChild);
}

function renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return '';
    let html = `<div class="row g-2 mt-3">`;

    attachments.forEach(media => {
        const mType = media.mediaType !== undefined ? media.mediaType : media.MediaType;
        const mUrl = media.url || media.Url;
        const mId = media.mediaId !== undefined ? media.mediaId : media.MediaId;
        const sPath = media.snippetPath || media.SnippetPath;

        const colClass = attachments.length === 1 ? "col-12" : "col-6";
        html += `<div class="${colClass}">`;

        if (mType === 3) {
            html += `
            <div class="post-media-container">
                <img src="${mUrl}" class="img-fluid full-media" loading="lazy">
            </div>`;
        }
        else if (mType === 2) {
            const hasThumb = sPath && sPath !== "null";
            const thumbClass = hasThumb ? "thumb-mode" : "";
            const thumbStyle = hasThumb ? `style="background-image: url('${sPath.replace(/\\/g, '/')}')"` : "";
            const srcAttr = hasThumb ? `data-src="${mUrl}"` : `src="${mUrl}"`;
            const videoClass = hasThumb ? "custom-video d-none" : "custom-video";

            html += `
            <div class="custom-video-wrapper ${thumbClass}" ${thumbStyle} id="video-container-${mId}">
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
        else if (mType === 1) {
            const trackTitle = "Track";
            const trackUrl = mUrl;
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
    input.removeAttribute('multiple');
    document.querySelectorAll('input[type="file"]').forEach(el => {
        if (el !== input) el.value = '';
    });

    const preview = document.getElementById('mediaPreview');
    const titleGroup = document.getElementById('postTitleGroup');
    const titleInput = document.getElementById('postTitle');

    if (input.files && input.files[0]) {
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
                let file = activeFileInput.files[0];

                if (activeMediaType === 'image' && window.processImageUpload) {
                    submitBtn.innerText = "Compressing Image...";
                    try { file = await window.processImageUpload(file, 1200); }
                    catch (e) { console.warn("Compression failed", e); }
                }

                const uploadData = new FormData();
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
                        Url: mediaResult.url,
                        SnippetPath: mediaResult.snippetPath || mediaResult.SnippetPath || null
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

    const likeBtn = e.target.closest('.btn-like');
    if (likeBtn) {
        const postId = likeBtn.dataset.id;
        try {
            const res = await fetch(`/api/posts/${postId}/like`, { method: "POST", headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
            if (res.ok) {
                const data = await res.json();
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

    const commentBtn = e.target.closest('.btn-comment-toggle');
    if (commentBtn) {
        const postId = commentBtn.dataset.id;
        const card = commentBtn.closest('.post-card');
        if (!card) return;

        const section = card.querySelector(`#comments-${postId}`);
        if (section) {
            section.classList.toggle('d-none');
            if (!section.classList.contains('d-none')) {
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

    const isOwner = window.AuthState && String(window.AuthState.userId) === String(c.userId);
    const timeDisplay = (window.timeAgo && c.createdAt)
        ? window.timeAgo(c.createdAt)
        : (c.createdAgo || 'Just now');
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

window.toggleReplyBox = function (id) {
    const boxes = document.querySelectorAll(`#reply-box-${id}`);
    let box = null;
    box = [...boxes].find(b => b.offsetParent !== null);
    if (!box && boxes.length > 0) box = boxes[0];

    if (box) {
        box.classList.toggle('d-none');
        if (!box.classList.contains('d-none')) {
            const input = box.querySelector('input');
            if (input) input.focus();
        }
    }
};

window.submitReply = async function (postId, parentId) {
    const inputId = parentId ? `reply-input-${parentId}` : `comment-input-${postId}`;
    const inputs = document.querySelectorAll(`#${inputId}`);
    let input = null;

    input = [...inputs].find(el => el.value && el.value.trim().length > 0);
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
            if (parentId) {
                const box = input.closest('.reply-input-wrapper');
                if (box) box.classList.add('d-none');
            }
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
    const pType = post.type || post.Type;

    // BUG FIX: Completely block merch items from the social feed container
    if (pType === 'merch') {
        return;
    }

    if (!container) return;

    const pId = post.id !== undefined ? post.id : post.Id;
    const pAuthorId = post.authorId !== undefined ? post.authorId : post.AuthorId;
    const pAuthorName = post.authorName || post.AuthorName || 'User';
    const pAuthorPic = post.authorPic || post.AuthorPic || '/img/profile_default.jpg';
    const pTitle = post.title || post.Title || '';
    const pText = post.text || post.Text || '';
    const pLikesCount = post.likesCount !== undefined ? post.likesCount : (post.LikesCount || 0);
    const pCommentsCount = post.commentsCount !== undefined ? post.commentsCount : (post.CommentsCount || 0);
    const pIsLiked = post.isLiked !== undefined ? post.isLiked : (post.IsLiked || false);
    const pCreatedAt = post.createdAt || post.CreatedAt;
    const attachments = post.attachments || post.Attachments || [];

    const isOwner = window.AuthState && String(window.AuthState.userId) === String(pAuthorId);
    const timeDisplay = (window.timeAgo && pCreatedAt) ? window.timeAgo(pCreatedAt) : 'Just now';

    const div = document.createElement('div');
    div.innerHTML = `
        <div class="post-card" id="post-${pId}">
            <div class="post-header">
                <div class="d-flex align-items-center">
                    <a href="/creator/${pAuthorId}" class="post-avatar-link">
                        <img src="${pAuthorPic === 'null' ? '/img/profile_default.jpg' : pAuthorPic}" class="post-avatar-img" alt="${pAuthorName}" onerror="this.src='/img/profile_default.jpg'">
                    </a>
                    <div class="post-info-col">
                        <div class="d-flex align-items-center gap-2">
                            <a href="/creator/${pAuthorId}" class="post-author-name">${pAuthorName}</a>
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
                            <a href="#" class="dropdown-item" onclick="window.FeedService.openEditModal('${pId}'); return false;">
                                <i class="fas fa-edit me-2"></i> Edit
                            </a>
                        </li>
                        <li>
                            <a href="#" class="dropdown-item text-danger" onclick="window.FeedService.deletePost('${pId}'); return false;">
                                <i class="fas fa-trash me-2"></i> Delete
                            </a>
                        </li>` : ''}
                    </ul>
                </div>
            </div>

            <div class="post-body">
                ${pTitle ? `<h5 class="post-title">${pTitle}</h5>` : ''}
                ${pText ? `<div class="post-text text-break">${pText}</div>` : ''}
                ${renderAttachments(attachments)}
            </div>

            <div class="post-footer">
                <button class="btn-post-action btn-like" data-id="${pId}">
                    <i class="${pIsLiked ? 'fas text-danger' : 'far'} fa-heart"></i> Like ${pLikesCount > 0 ? `(${pLikesCount})` : ''}
                </button>
                <button class="btn-post-action btn-comment-toggle" data-id="${pId}">
                    <i class="far fa-comment"></i> Comment ${pCommentsCount > 0 ? `(${pCommentsCount})` : ''}
                </button>
                <button class="btn-post-action"><i class="far fa-share-square"></i> Share</button>
            </div>

            <div id="comments-${pId}" class="d-none border-top border-secondary p-3">
                <div id="comments-list-${pId}" class="mb-3"></div>
                <div class="d-flex align-items-center gap-2">
                    <img src="/img/profile_default.jpg" class="input-avatar" alt="Me">
                    <div class="comment-input-area">
                        <input type="text" id="comment-input-${pId}" placeholder="Write a comment..." autocomplete="off">
                        <button class="btn-comment-post" onclick="submitReply('${pId}', null)">Post</button>
                    </div>
                </div>
            </div>
        </div>`;

    const postEl = div.firstElementChild;
    postEl.classList.add('feed-interactive');

    postEl.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, textarea, .custom-video-wrapper, .post-options-menu, .track-card')) {
            return;
        }
        if (window.getSelection().toString().length > 0) return;
        if (document.querySelector('.post-options-menu.show')) return;

        e.preventDefault();
        if (window.FeedService && window.FeedService.openPostModal) {
            window.FeedService.openPostModal(pId);
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
            const attachments = post.attachments || post.Attachments || [];
            const audio = attachments.find(a => (a.mediaType || a.MediaType) === 1);
            if (!audio) return;

            const trackSrc = audio.url || audio.Url;
            const pAuthorPic = post.authorPic || post.AuthorPic;
            const imageSrc = pAuthorPic && pAuthorPic !== "null" ? pAuthorPic : '/img/profile_default.jpg';
            const title = post.title || post.Title || 'Untitled Track';
            const titleEscaped = title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
            const artist = post.authorName || post.AuthorName || 'Unknown Artist';
            const pAuthorId = post.authorId !== undefined ? post.authorId : post.AuthorId;
            const profileLink = `/creator/${pAuthorId}`;
            const pCreatedAt = post.createdAt || post.CreatedAt;

            const timeAgo = (window.timeAgo && pCreatedAt)
                ? window.timeAgo(pCreatedAt)
                : 'Just now';

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

window.commerceSelectedFiles = [];

window.openCommerceModal = function (contextType, contextId, postType) {
    document.getElementById('commerceContextType').value = contextType;
    document.getElementById('commerceContextId').value = contextId;
    document.getElementById('commercePostType').value = postType;

    document.getElementById('createCommerceForm').reset();
    window.clearCommerceImages();

    const modalEl = document.getElementById('commerceModal');
    if (modalEl) modalEl.classList.add('active');
};

window.closeCommerceModal = function () {
    const modalEl = document.getElementById('commerceModal');
    if (modalEl) modalEl.classList.remove('active');
};

document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'commerceModal') {
        window.closeCommerceModal();
    }
});

window.previewCommerceImage = function (input) {
    if (input.files) {
        for (let i = 0; i < input.files.length; i++) {
            if (window.commerceSelectedFiles.length >= 5) {
                alert("You can only upload up to 5 images per listing.");
                break;
            }
            window.commerceSelectedFiles.push(input.files[i]);
        }
    }
    input.value = '';
    window.renderCommerceImagePreviews();
};

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

window.removeCommerceImage = function (index) {
    window.commerceSelectedFiles.splice(index, 1);
    window.renderCommerceImagePreviews();
};

window.clearCommerceImages = function () {
    window.commerceSelectedFiles = [];
    window.renderCommerceImagePreviews();
};

// Handle Commerce Submission
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

            for (let i = 0; i < window.commerceSelectedFiles.length; i++) {
                let file = window.commerceSelectedFiles[i];

                if (file.type.startsWith('image/') && window.processImageUpload) {
                    submitBtn.innerText = `Compressing Image ${i + 1} of ${window.commerceSelectedFiles.length}...`;
                    try { file = await window.processImageUpload(file, 1200); }
                    catch (err) { console.warn("Compression failed", err); }
                }

                submitBtn.innerText = `Uploading Image ${i + 1} of ${window.commerceSelectedFiles.length}...`;

                const uploadData = new FormData();
                uploadData.append("file", file);

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
                    Url: mediaResult.url,
                    SnippetPath: mediaResult.snippetPath || mediaResult.SnippetPath || null
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
                window.closeCommerceModal();
                form.reset();
                window.clearCommerceImages();
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

    const pId = post.id !== undefined ? post.id : post.Id;
    const pTitle = post.title || post.Title || 'Untitled Product';
    const pAuthor = post.authorName || post.AuthorName || 'Unknown';
    const pPrice = post.price !== undefined ? post.price : post.Price;
    const pQty = post.quantity !== undefined ? post.quantity : post.Quantity;
    const pAttach = post.attachments || post.Attachments || [];

    const imageUrl = pAttach.length > 0 ? (pAttach[0].url || pAttach[0].Url) : '/img/default_cover.jpg';
    const priceDisplay = pPrice != null ? `$${parseFloat(pPrice).toFixed(2)}` : 'Free';

    let qtyText = '';
    let isSoldOut = false;
    if (pQty !== null && pQty !== undefined) {
        if (pQty > 0) {
            qtyText = `${pQty} in stock`;
        } else {
            qtyText = `<span style="color: #ff4d4d;">Sold Out</span>`;
            isSoldOut = true;
        }
    }

    const cardHtml = `
      <div class="product-card" id="post-${pId}">
        <div class="product-card__image">
          <img src="${imageUrl}" alt="${pTitle}">
        </div>
        <div class="product-card__overlay">
          <div class="product-card__brand">${pAuthor}</div>
          <div class="product-card__name" title="${pTitle}">${pTitle}</div>
          
          <div class="product-card__price">
              ${priceDisplay}
              <span class="product-card__qty">${qtyText}</span>
          </div>
          
          <div class="product-card__actions">
            <button class="product-card__add-to-cart" ${isSoldOut ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
                ${isSoldOut ? 'Sold Out' : 'Add to Cart'}
            </button>
            <button class="product-card__view-details" onclick="window.FeedService.openPostModal('${pId}'); return false;">Details</button>
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
            btn.style.backgroundColor = '#ffc107';
            btn.style.color = '#000';
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Done Managing</span>';
        } else {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = '#ffc107';
            btn.innerHTML = '<i class="fas fa-boxes"></i> <span>Manage Inventory</span>';
        }
    }

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
    const pId = post.id !== undefined ? post.id : post.Id;
    const pTitle = post.title || post.Title || 'Untitled Product';
    const pPrice = post.price !== undefined ? post.price : post.Price;
    const pQty = post.quantity !== undefined ? post.quantity : post.Quantity;
    const pAttach = post.attachments || post.Attachments || [];

    const imageUrl = pAttach.length > 0 ? (pAttach[0].url || pAttach[0].Url) : '/img/default_cover.jpg';
    const priceDisplay = pPrice != null ? `$${parseFloat(pPrice).toFixed(2)}` : 'Free';

    let qtyText = '';
    let isSoldOut = false;
    if (pQty !== null && pQty !== undefined) {
        if (pQty > 0) {
            qtyText = `${pQty} in stock`;
        } else {
            qtyText = `<span style="color: #ff4d4d;">Sold Out</span>`;
            isSoldOut = true;
        }
    }

    const div = document.createElement('div');
    div.className = "storefront-card-wrapper position-relative";
    div.style.position = "relative";
    div.style.display = "block";
    div.style.width = "100%";
    div.style.height = "350px";

    div.innerHTML = `
      <div class="product-card" style="width: 100%; height: 100%; margin: 0;">
        <div class="product-card__image">
          <img src="${imageUrl}" alt="${pTitle}">
        </div>
        <div class="product-card__overlay">
          <div class="product-card__name">${pTitle}</div>
          <div class="product-card__price">
              ${priceDisplay}
              <span class="product-card__qty">${qtyText}</span>
          </div>
          <div class="product-card__actions">
            <button class="product-card__add-to-cart" ${isSoldOut ? 'disabled style="opacity:0.5;"' : ''}>
                ${isSoldOut ? 'Sold Out' : 'Buy Now'}
            </button>
            <button class="product-card__view-details" onclick="window.FeedService.openPostModal('${pId}')">Details</button>
          </div>
        </div>
      </div>
      
      <div class="storefront-edit-overlay ${window.isInventoryMode ? '' : 'd-none'}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10; border-radius: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 15px; border: 1px solid #ffc107;">
         <button class="btn btn-warning fw-bold" style="width: 75%;" onclick="window.FeedService.openEditModal('${pId}')">
            <i class="fas fa-edit me-2"></i> Edit Listing
         </button>
         <button class="btn btn-danger fw-bold" style="width: 75%;" onclick="window.FeedService.deletePost('${pId}')">
            <i class="fas fa-trash me-2"></i> Delete
         </button>
      </div>

      <div class="store-carousel-select-overlay ${window.isStoreCarouselManagerActive ? '' : 'd-none'}" onclick="window.addToStoreCarouselDock('${pId}', '${imageUrl}')">
          <i class="fas fa-plus-circle add-icon"></i>
      </div>
    `;

    container.appendChild(div);
}

// ============================================
// 16. DEDICATED PHOTO GALLERY
// ============================================

window.isGalleryInventoryMode = false;

window.toggleGalleryInventoryMode = function () {
    window.isGalleryInventoryMode = !window.isGalleryInventoryMode;
    const btn = document.getElementById('btnToggleGalleryInventory');

    if (btn) {
        if (window.isGalleryInventoryMode) {
            btn.style.backgroundColor = '#ffc107';
            btn.style.color = '#000';
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Done Managing</span>';
        } else {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = '#ffc107';
            btn.innerHTML = '<i class="fas fa-tasks"></i> <span>Manage Images</span>';
        }
    }

    document.querySelectorAll('.gallery-edit-overlay').forEach(el => {
        if (window.isGalleryInventoryMode) el.classList.remove('d-none');
        else el.classList.add('d-none');
    });
};

window.loadPhotoGallery = async function (userId) {
    const container = document.getElementById('photo-gallery-container');
    if (!container) return;

    try {
        const res = await fetch(`/api/posts?contextType=user&contextId=${userId}&page=1&mediaType=3`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            const posts = await res.json();
            container.innerHTML = '';

            if (posts.length === 0) {
                container.innerHTML = '<div class="text-center w-100 text-muted p-5" style="grid-column: 1 / -1;"><h3>No images found.</h3><p>Upload some standard posts with images!</p></div>';
                return;
            }

            posts.forEach(post => {
                renderPhotoCard(post, container);
            });
        } else {
            container.innerHTML = '<div class="text-danger text-center w-100 p-3">Failed to load gallery.</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="text-danger text-center w-100 p-3">Connection error.</div>';
    }
};

function renderPhotoCard(post, container) {
    const attachments = post.attachments || post.Attachments || [];
    const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);
    if (!imgAttach) return;

    const imageUrl = imgAttach.url || imgAttach.Url;
    const pId = post.id !== undefined ? post.id : post.Id;

    const div = document.createElement('div');
    div.style.position = "relative";
    div.style.display = "block";
    div.style.width = "100%";
    div.style.aspectRatio = "1 / 1";
    div.style.borderRadius = "8px";
    div.style.overflow = "hidden";
    div.style.backgroundColor = "#111";

    div.innerHTML = `
      <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer; transition: transform 0.3s;" 
           onmouseover="this.style.transform='scale(1.05)';" 
           onmouseout="this.style.transform='scale(1)';"
           onclick="window.FeedService.openPostModal('${pId}')" alt="Photo">
      
      <div class="gallery-edit-overlay ${window.isGalleryInventoryMode ? '' : 'd-none'}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; border: 1px solid #ffc107;">
         <button class="btn btn-sm btn-warning fw-bold" style="width: 80%;" onclick="window.FeedService.openEditModal('${pId}')">
            <i class="fas fa-edit me-1"></i> Edit
         </button>
         <button class="btn btn-sm btn-danger fw-bold" style="width: 80%;" onclick="window.FeedService.deletePost('${pId}')">
            <i class="fas fa-trash me-1"></i> Delete
         </button>
      </div>
    `;

    container.appendChild(div);
}

// ============================================
// 17. DEDICATED VIDEO HUB
// ============================================

window.isVideoInventoryMode = false;

window.toggleVideoInventoryMode = function () {
    window.isVideoInventoryMode = !window.isVideoInventoryMode;
    const btn = document.getElementById('btnToggleVideoInventory');

    if (btn) {
        if (window.isVideoInventoryMode) {
            btn.style.backgroundColor = '#ffc107';
            btn.style.color = '#000';
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Done Managing</span>';
        } else {
            btn.style.backgroundColor = 'transparent';
            btn.style.color = '#ffc107';
            btn.innerHTML = '<i class="fas fa-tasks"></i> <span>Manage Videos</span>';
        }
    }

    document.querySelectorAll('.video-edit-overlay').forEach(el => {
        if (window.isVideoInventoryMode) el.classList.remove('d-none');
        else el.classList.add('d-none');
    });
};

window.loadVideoHub = async function (userId) {
    const container = document.getElementById('video-hub-container');
    if (!container) return;

    try {
        const res = await fetch(`/api/posts?contextType=user&contextId=${userId}&page=1&mediaType=2`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            const posts = await res.json();
            container.innerHTML = '';

            if (posts.length === 0) {
                container.innerHTML = '<div class="text-center w-100 text-muted p-5" style="grid-column: 1 / -1;"><h3>No videos found.</h3><p>Upload some videos!</p></div>';
                return;
            }

            posts.forEach(post => {
                renderVideoCard(post, container);
            });
        } else {
            container.innerHTML = '<div class="text-danger text-center w-100 p-3">Failed to load videos.</div>';
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="text-danger text-center w-100 p-3">Connection error.</div>';
    }
};

function renderVideoCard(post, container) {
    const attachments = post.attachments || post.Attachments || [];
    const vidAttach = attachments.find(a => (a.mediaType || a.MediaType) === 2);
    if (!vidAttach) return;

    let sPath = vidAttach.snippetPath || vidAttach.SnippetPath;
    const thumbSrc = (sPath && sPath !== "null") ? sPath.replace(/\\/g, '/') : '/img/default_cover.jpg';
    const title = post.title || post.Title || 'Untitled Video';
    const pId = post.id !== undefined ? post.id : post.Id;
    const createdAgo = post.createdAgo || post.CreatedAgo || 'Recently';

    const div = document.createElement('div');
    div.style.position = "relative";
    div.style.display = "block";
    div.style.width = "100%";
    div.style.borderRadius = "8px";
    div.style.overflow = "hidden";
    div.style.backgroundColor = "#111";
    div.style.border = "1px solid #333";

    div.innerHTML = `
      <div style="width: 100%; aspect-ratio: 16/9; position: relative; cursor: pointer;" onclick="window.FeedService.openPostModal('${pId}')">
          <img src="${thumbSrc}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8; transition: opacity 0.3s;" onmouseover="this.style.opacity='1';" onmouseout="this.style.opacity='0.8';">
          <i class="fas fa-play-circle" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 3rem; text-shadow: 0 2px 5px rgba(0,0,0,0.8); pointer-events: none;"></i>
      </div>
      <div style="padding: 12px;">
          <div style="color: white; font-weight: bold; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
          <div style="color: #888; font-size: 0.85rem; margin-top: 5px;"><i class="far fa-clock me-1"></i> ${createdAgo}</div>
      </div>
      
      <div class="video-edit-overlay ${window.isVideoInventoryMode ? '' : 'd-none'}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 15px; border: 1px solid #ffc107;">
         <button class="btn btn-warning fw-bold" style="width: 75%;" onclick="window.FeedService.openEditModal('${pId}')">
            <i class="fas fa-edit me-2"></i> Edit
         </button>
         <button class="btn btn-danger fw-bold" style="width: 75%;" onclick="window.FeedService.deletePost('${pId}')">
            <i class="fas fa-trash me-2"></i> Delete
         </button>
      </div>
    `;

    container.appendChild(div);
}

// ============================================
// STOREFRONT CAROUSEL MANAGER (DOCK)
// ============================================

window.isStoreCarouselManagerActive = false;
window.storeCarouselDockItems = [];

window.toggleStoreCarouselManager = async function () {
    window.isStoreCarouselManagerActive = !window.isStoreCarouselManagerActive;

    if (window.isStoreCarouselManagerActive && window.isInventoryMode) {
        window.toggleInventoryMode();
    }

    const btn = document.getElementById('btnToggleStoreCarouselManager');
    const dock = document.getElementById('storeCarouselManagerDock');

    if (window.isStoreCarouselManagerActive) {
        // TURN ON - Set to loading state
        if (btn) {
            btn.classList.add('is-active');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Loading...</span>';
            btn.disabled = true;
        }
        if (dock) dock.classList.remove('d-none');

        // Show empty slots while loading
        window.renderStoreCarouselDockSlots();

        try {
            const userId = window.AuthState?.userId;
            if (userId) {
                const existRes = await fetch(`/api/collections/user/${userId}/context/store`, {
                    headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
                });

                if (existRes.ok) {
                    const collections = await existRes.json();
                    if (collections && collections.length > 0) {
                        const collectionId = collections[0].id || collections[0].Id;

                        const detailRes = await fetch(`/api/collections/${collectionId}`, {
                            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
                        });

                        if (detailRes.ok) {
                            const details = await detailRes.json();
                            const rawItems = details.items || details.Items || [];

                            const postPromises = rawItems.slice(0, 10).map(item => {
                                const tId = item.targetId || item.TargetId;
                                return fetch(`/api/posts/${tId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } })
                                    .then(r => r.ok ? r.json() : null)
                                    .catch(() => null);
                            });

                            const resolvedPosts = await Promise.all(postPromises);

                            window.storeCarouselDockItems = [];
                            resolvedPosts.forEach(post => {
                                if (post) {
                                    const pId = post.id || post.Id;
                                    const pAttach = post.attachments || post.Attachments || [];
                                    const imageUrl = pAttach.length > 0 ? (pAttach[0].url || pAttach[0].Url) : '/img/default_cover.jpg';

                                    window.storeCarouselDockItems.push({ id: String(pId), imgUrl: imageUrl });
                                }
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load existing carousel for dock", e);
        }

        // Finish Loading
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Close Manager</span>';
            btn.disabled = false;
        }

        window.renderStoreCarouselDockSlots();

    } else {
        // TURN OFF
        if (btn) {
            btn.classList.remove('is-active');
            btn.innerHTML = '<i class="fas fa-star"></i> <span>Manage Carousel</span>';
        }
        if (dock) dock.classList.add('d-none');
    }

    document.querySelectorAll('.store-carousel-select-overlay').forEach(el => {
        if (window.isStoreCarouselManagerActive) el.classList.remove('d-none');
        else el.classList.add('d-none');
    });
};
window.renderStoreCarouselDockSlots = function () {
    const container = document.getElementById('storeCarouselDockSlotsContainer');
    if (!container) return;
    container.innerHTML = '';

    const maxSlots = 10; // User request: Cap at 10 items

    for (let i = 0; i < maxSlots; i++) {
        if (window.storeCarouselDockItems[i]) {
            const item = window.storeCarouselDockItems[i];
            container.innerHTML += `
                <div class="store-carousel-dock-slot filled" onclick="window.removeFromStoreCarouselDock('${item.id}')" title="Click to remove">
                    <img src="${item.imgUrl}">
                    <div class="store-carousel-dock-slot-remove"><i class="fas fa-times-circle"></i></div>
                </div>
            `;
        } else {
            container.innerHTML += `
                <div class="store-carousel-dock-slot empty" title="Click a product above to fill this slot">
                    <i class="fas fa-plus text-muted"></i>
                </div>
            `;
        }
    }
};

window.addToStoreCarouselDock = function (postId, imgUrl) {
    if (!window.isStoreCarouselManagerActive) return;

    // Strict string comparison to prevent toggle errors
    if (window.storeCarouselDockItems.find(x => String(x.id) === String(postId))) {
        window.removeFromStoreCarouselDock(postId);
        return;
    }

    if (window.storeCarouselDockItems.length >= 10) {
        alert("Carousel limit reached.");
        return;
    }

    window.storeCarouselDockItems.push({ id: String(postId), imgUrl: imgUrl });
    window.renderStoreCarouselDockSlots();
};

window.removeFromStoreCarouselDock = function (postId) {
    // Strict string comparison
    window.storeCarouselDockItems = window.storeCarouselDockItems.filter(x => String(x.id) !== String(postId));
    window.renderStoreCarouselDockSlots();
};

window.saveStoreCarouselDock = async function () {
    const btn = document.querySelector('.store-carousel-dock-header button');
    if (btn) {
        btn.innerText = "Saving...";
        btn.disabled = true;
    }

    try {
        const userId = window.AuthState?.userId;

        // 1. Map the dock items into the CollectionItemRequest format the C# API expects
        const itemsPayload = window.storeCarouselDockItems.map(item => ({
            TargetId: parseInt(item.id),
            TargetType: 4
        }));

        const payload = {
            Title: "Featured Storefront",
            Description: "My featured items",
            Type: 5,
            DisplayContext: "store",
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

        if (!res.ok) throw new Error("Failed to save collection");

        if (btn) {
            btn.innerText = "Saved!";
            setTimeout(() => {
                btn.innerText = "Save to Profile";
                btn.disabled = false;

                // FORCE THE UI TO RELOAD IMMEDIATELY AFTER SAVING
                if (window.loadStoreCarousel) {
                    window.loadStoreCarousel(userId);
                }
            }, 2000);
        }

    } catch (err) {
        console.error(err);
        alert("Error saving carousel.");
        if (btn) {
            btn.innerText = "Save to Profile";
            btn.disabled = false;
        }
    }
};
// ============================================
// 18. DEFENSIVE CAROUSEL LOADER
// ============================================

window.loadStoreCarousel = async function (userId) {
    const storeContainer = document.getElementById('store-carousel-container');
    if (!storeContainer) return;

    // BUG FIX: Completely abort if we are on the global feed (user 0)
    if (!userId || String(userId) === '0') {
        storeContainer.innerHTML = '';
        return;
    }

    try {
        storeContainer.innerHTML = '<div class="text-center w-100 p-3 text-muted"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

        const res = await fetch(`/api/collections/user/${userId}/context/store`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (!res.ok) {
            storeContainer.innerHTML = '';
            return;
        }

        const collections = await res.json();

        // ==========================================
        // FALLBACK LOGIC: No custom collection found
        // ==========================================
        if (!collections || collections.length === 0) {
            const fallbackRes = await fetch(`/api/posts?contextType=user&contextId=${userId}&page=1&postType=merch`, {
                headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
            });

            storeContainer.innerHTML = '';

            if (fallbackRes.ok) {
                const fallbackPosts = await fallbackRes.json();
                if (!fallbackPosts || fallbackPosts.length === 0) {
                    storeContainer.innerHTML = '<div class="text-muted p-3">No products available.</div>';
                    return;
                }

                // Render up to 5 default items exactly as requested
                const defaultPosts = fallbackPosts.slice(0, 5);
                defaultPosts.forEach(post => {
                    renderMerchCard(post, storeContainer);
                });
            }
            return;
        }

        // ==========================================
        // CURATED LOGIC: Defensive mapping
        // ==========================================
        const latestCollectionId = collections[0].id !== undefined ? collections[0].id : collections[0].Id;

        const detailRes = await fetch(`/api/collections/${latestCollectionId}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        storeContainer.innerHTML = '';

        if (!detailRes.ok) return;

        const collectionDetails = await detailRes.json();

        // Defensively check for array casing
        const rawItems = collectionDetails.items || collectionDetails.Items || [];

        if (rawItems.length === 0) {
            storeContainer.innerHTML = '<div class="text-muted p-3">Carousel is empty.</div>';
            return;
        }

        const customItems = rawItems.slice(0, 10);
        const postPromises = customItems.map(item => {
            const tType = item.targetType !== undefined ? item.targetType : item.TargetType;
            const tId = item.targetId !== undefined ? item.targetId : item.TargetId;

            // Only fetch if it's a valid post mapped from the DB
            if (tType === 4 || tType === 0) {
                return fetch(`/api/posts/${tId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } })
                    .then(r => r.ok ? r.json() : null)
                    .catch(e => null);
            }
            return Promise.resolve(null);
        });

        const resolvedPosts = await Promise.all(postPromises);

        let renderedCount = 0;
        resolvedPosts.forEach(postData => {
            if (postData && (postData.id !== undefined || postData.Id !== undefined)) {
                renderMerchCard(postData, storeContainer);
                renderedCount++;
            }
        });

        if (renderedCount === 0) {
            storeContainer.innerHTML = '<div class="text-muted p-3">Saved items have been deleted.</div>';
        }

    } catch (err) {
        console.error("Failed to load store carousel", err);
        storeContainer.innerHTML = '<div class="text-muted p-3">Error loading carousel.</div>';
    }
};

