/* ============================================
   IMAGE HUB: JAVASCRIPT ENGINE
   Handles Masonry Grid, Client-Side Compression, Batch Uploads, & Lightbox Theater
   ============================================ */

window.currentVaultImages = [];
window.currentLightboxIndex = 0;

// ============================================
// 1. MASTER LOADER
// ============================================
window.loadImageHub = async function (userId) {
    const container = document.getElementById('photo-gallery-container');
    if (!container) return;

    try {
        // Fetch Type 7 (Images) for this user. 
        // Note: Make sure your API supports filtering by postType=7
        const res = await fetch(`/api/posts?contextType=1&contextId=${userId}&page=1&postType=7`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            window.currentVaultImages = await res.json();
            renderMasonryGrid(window.currentVaultImages);
        } else {
            container.innerHTML = '<div class="text-danger text-center w-100 p-3">Failed to load vault.</div>';
        }
    } catch (err) {
        console.error("Error loading Image Hub data:", err);
        container.innerHTML = '<div class="text-danger text-center w-100 p-3">Connection error.</div>';
    }
};

// ============================================
// 2. MASONRY GRID RENDERER
// ============================================
function renderMasonryGrid(posts) {
    const container = document.getElementById('photo-gallery-container');
    if (!container) return;

    if (!posts || posts.length === 0) {
        container.innerHTML = '<div style="text-align: center; width: 100%; padding: 50px 0; color: #888; grid-column: 1 / -1;"><i class="fas fa-image fa-3x mb-3"></i><p>Your vault is empty.</p></div>';
        return;
    }

    container.innerHTML = '';

    posts.forEach((post, index) => {
        const pId = post.id !== undefined ? post.id : post.Id;
        const attachments = post.attachments || post.Attachments || [];
        const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);

        // Fallback to default if somehow missing
        const imageUrl = imgAttach ? (imgAttach.url || imgAttach.Url) : '/img/default_cover.jpg';

        let html = `
            <div class="masonry-item" onclick="window.openImageLightbox(${index})">
                <img src="${imageUrl}" loading="lazy" alt="Vault Image">
                
                <div class="gallery-edit-overlay d-none" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; border: 1px solid #ffc107;">
                    <button class="btn btn-sm btn-warning fw-bold" style="width: 80%;" onclick="event.stopPropagation(); window.FeedService.openEditModal('${pId}')">
                        <i class="fas fa-edit me-1"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger fw-bold" style="width: 80%;" onclick="event.stopPropagation(); window.FeedService.deletePost('${pId}')">
                        <i class="fas fa-trash me-1"></i> Delete
                    </button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });

    // Re-apply inventory mode classes if it's currently active
    if (window.isGalleryInventoryMode) {
        document.querySelectorAll('.gallery-edit-overlay').forEach(el => el.classList.remove('d-none'));
    }
}

// ============================================
// 3. BATCH DRAG & DROP UPLOAD
// ============================================
window.handleImageDrop = function (e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = '#00AEEF';
    e.currentTarget.style.background = '#111';

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const input = document.getElementById('imageBatchInput');
        input.files = e.dataTransfer.files;
        window.handleBatchImageUpload(input);
    }
};

window.handleBatchImageUpload = async function (input) {
    if (!input.files || input.files.length === 0) return;
    const userId = document.getElementById('gallery-user-id')?.value;
    if (!userId) return;

    const files = Array.from(input.files).filter(f => f.type.startsWith('image/'));
    input.value = ''; // Reset input

    if (files.length === 0) {
        alert("Please select valid image files.");
        return;
    }

    const dropZone = document.getElementById('imageDropZoneContent');
    const originalDropHtml = dropZone ? dropZone.innerHTML : '';
    const progressBar = document.getElementById('imageBatchProgress');

    if (dropZone) dropZone.classList.add('d-none');
    if (progressBar) {
        progressBar.classList.remove('d-none');
        progressBar.innerHTML = `<i class="fas fa-spinner fa-spin text-info fs-4 mb-2"></i><br>Preparing ${files.length} images...`;
    }

    for (let i = 0; i < files.length; i++) {
        let file = files[i];

        if (progressBar) progressBar.innerHTML = `<i class="fas fa-compress-arrows-alt text-info fs-4 mb-2"></i><br>Compressing image ${i + 1} of ${files.length}...`;

        try {
            // 1. Use the global compressor in settings.js
            if (window.processImageUpload) {
                file = await window.processImageUpload(file, 1920); // 1920px max for hi-res Lightbox viewing
            }

            if (progressBar) progressBar.innerHTML = `<i class="fas fa-cloud-upload-alt text-success fs-4 mb-2"></i><br>Uploading image ${i + 1} of ${files.length}...`;

            // 2. Upload to Cloudflare/S3 via your existing API
            const uploadData = new FormData();
            uploadData.append("file", file);

            const uploadRes = await fetch("/api/upload/image", {
                method: 'POST',
                headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                body: uploadData
            });

            if (!uploadRes.ok) throw new Error("File upload failed");
            const mediaResult = await uploadRes.json();

            // 3. Create the Shadow Post (Type 7, Visibility 3)
            const payload = {
                ContextType: 1,
                ContextId: parseInt(userId),
                Type: 7, // 7 = Image
                Visibility: 3, // 3 = Hub Only (won't spam the main feed)
                Title: file.name.split('.')[0],
                MediaAttachments: [{
                    MediaId: mediaResult.id,
                    MediaType: 3, // 3 = Image Media
                    Url: mediaResult.url,
                    SnippetPath: mediaResult.snippetPath
                }]
            };

            await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
                body: JSON.stringify(payload)
            });

        } catch (e) {
            console.error(`Failed to upload ${file.name}`, e);
        }
    }

    // Cleanup and Reload
    if (progressBar) progressBar.classList.add('d-none');
    if (dropZone) dropZone.classList.remove('d-none');
    window.loadImageHub(userId);
};

// ============================================
// 4. APP-NATIVE LIGHTBOX ENGINE
// ============================================
window.openImageLightbox = function (index) {
    if (!window.currentVaultImages || window.currentVaultImages.length === 0) return;

    // Safety clamp the index
    if (index < 0) index = window.currentVaultImages.length - 1;
    if (index >= window.currentVaultImages.length) index = 0;

    window.currentLightboxIndex = index;
    const post = window.currentVaultImages[index];
    const postId = post.id !== undefined ? post.id : post.Id;

    // Extract Image URL
    const attachments = post.attachments || post.Attachments || [];
    const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);
    const imageUrl = imgAttach ? (imgAttach.url || imgAttach.Url) : '';

    // Populate UI Elements
    document.getElementById('lightboxMainImage').src = imageUrl;
    document.getElementById('lightboxCurrentPostId').value = postId;

    const pAuthorName = post.authorName || post.AuthorName || 'User';
    const pAuthorPic = post.authorPic || post.AuthorPic || '/img/profile_default.jpg';
    document.getElementById('lightboxAuthorName').innerText = pAuthorName;
    document.getElementById('lightboxAuthorPic').src = pAuthorPic === 'null' ? '/img/profile_default.jpg' : pAuthorPic;

    const pCreatedAt = post.createdAt || post.CreatedAt;
    document.getElementById('lightboxTimeAgo').innerText = (window.timeAgo && pCreatedAt) ? window.timeAgo(pCreatedAt) : 'Just now';

    // Set initial likes (will refresh with live data shortly)
    const likes = post.likesCount !== undefined ? post.likesCount : (post.LikesCount || 0);
    const comments = post.commentsCount !== undefined ? post.commentsCount : (post.CommentsCount || 0);
    const isLiked = post.isLiked !== undefined ? post.isLiked : (post.IsLiked || false);

    document.getElementById('lightboxLikeCount').innerText = likes;
    document.getElementById('lightboxCommentCount').innerText = comments;
    const likeBtnIcon = document.querySelector('#lightboxLikeBtn i');
    likeBtnIcon.className = isLiked ? 'fas fa-heart text-danger' : 'far fa-heart';

    // Reset Comment UI
    window.cancelLightboxReply();
    document.getElementById('lightboxCommentInput').value = '';

    // Show Modal
    const modal = document.getElementById('imageLightboxModal');
    modal.classList.remove('d-none');
    document.body.classList.add('no-scroll');

    // Fetch live comments and stats in the background
    window.loadLightboxLiveStats(postId);
    window.loadLightboxComments(postId);
};

window.closeImageLightbox = function () {
    const modal = document.getElementById('imageLightboxModal');
    modal.classList.add('d-none');
    modal.classList.remove('show-panel'); // Always close the panel
    document.body.classList.remove('no-scroll');
    document.getElementById('lightboxMainImage').src = ''; // Clear memory
};

window.navigateLightbox = function (direction) {
    // direction is +1 (Next) or -1 (Prev)
    window.openImageLightbox(window.currentLightboxIndex + direction);
};

// ============================================
// 5. LIGHTBOX SOCIAL INTERACTIONS
// ============================================
window.loadLightboxLiveStats = async function (postId) {
    try {
        const res = await fetch(`/api/posts/${postId}`, {
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });
        if (res.ok) {
            const livePost = await res.json();
            const likes = livePost.likesCount !== undefined ? livePost.likesCount : (livePost.LikesCount || 0);
            const isLiked = livePost.isLiked !== undefined ? livePost.isLiked : (livePost.IsLiked || false);

            document.getElementById('lightboxLikeCount').innerText = likes;
            document.querySelector('#lightboxLikeBtn i').className = isLiked ? 'fas fa-heart text-danger' : 'far fa-heart';

            // Sync global array so navigation stays accurate
            window.currentVaultImages[window.currentLightboxIndex].likesCount = likes;
            window.currentVaultImages[window.currentLightboxIndex].isLiked = isLiked;
        }
    } catch (e) { console.warn("Failed to fetch live stats", e); }
};

window.toggleLightboxLike = async function () {
    const btn = document.getElementById('lightboxLikeBtn');
    const postId = document.getElementById('lightboxCurrentPostId').value;
    if (!postId || btn.disabled) return;

    btn.disabled = true;
    try {
        const res = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });

        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById('lightboxLikeCount');
            let currentCount = parseInt(countSpan.innerText) || 0;
            const icon = btn.querySelector('i');
            const wasLiked = icon.classList.contains('fas');

            if (data.liked) {
                icon.className = 'fas fa-heart text-danger';
                if (!wasLiked) countSpan.innerText = currentCount + 1;
            } else {
                icon.className = 'far fa-heart';
                if (wasLiked) countSpan.innerText = Math.max(0, currentCount - 1);
            }
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; }
};

window.loadLightboxComments = async function (postId) {
    const wrapper = document.getElementById('lightboxCommentsFeed');
    if (!wrapper) return;

    wrapper.innerHTML = '<div class="text-center text-muted mt-4"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });

        if (res.ok) {
            const comments = await res.json();
            document.getElementById('lightboxCommentCount').innerText = comments.length;

            if (comments.length === 0) {
                wrapper.innerHTML = '<div class="text-muted text-center mt-4 small">Be the first to comment.</div>';
                return;
            }

            const resolvePic = (pic) => {
                if (!pic || pic === 'null') return '/img/profile_default.jpg';
                if (pic.startsWith('http') || pic.startsWith('/')) return pic;
                return '/' + pic;
            };

            const renderComment = (c, isReply = false) => {
                const pic = resolvePic(c.authorPic);
                let html = `
                    <div style="display: flex; gap: 12px; margin-bottom: ${isReply ? '12' : '20'}px;">
                        <img src="${pic}" style="width: ${isReply ? '28' : '35'}px; height: ${isReply ? '28' : '35'}px; border-radius: 50%; object-fit: cover; border: 1px solid #333; flex-shrink: 0;">
                        <div style="flex-grow: 1;">
                            <div style="font-weight: bold; font-size: ${isReply ? '0.8' : '0.85'}rem; color: #fff;">
                                ${c.authorName} 
                                <span style="color: #666; font-size: 0.75rem; font-weight: normal; margin-left: 8px;">${c.createdAgo}</span>
                            </div>
                            <div style="color: #ccc; font-size: ${isReply ? '0.85' : '0.95'}rem; margin-top: 4px; line-height: 1.4; word-break: break-word;">${c.content}</div>
                            ${!isReply ? `
                            <div style="margin-top: 6px;">
                                <button onclick="window.prepareLightboxReply(${c.commentId}, '${encodeURIComponent(c.authorName)}')" style="background: transparent; border: none; color: #aaa; font-size: 0.75rem; font-weight: bold; cursor: pointer; padding: 0;">Reply</button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;

                if (c.replies && c.replies.length > 0) {
                    html += `
                        <div style="margin-left: 47px; margin-bottom: 15px;">
                            ${c.replies.map(r => renderComment(r, true)).join('')}
                        </div>
                    `;
                }
                return html;
            };

            wrapper.innerHTML = comments.map(c => renderComment(c, false)).join('');
        }
    } catch (e) {
        wrapper.innerHTML = '<div class="text-danger small mt-4 text-center">Failed to load comments.</div>';
    }
};

window.prepareLightboxReply = function (commentId, authorNameEnc) {
    document.getElementById('lightboxReplyParentId').value = commentId;
    document.getElementById('lightboxReplyName').innerText = decodeURIComponent(authorNameEnc);
    document.getElementById('lightboxReplyBadge').classList.remove('d-none');
    document.getElementById('lightboxCommentInput').focus();
};

window.cancelLightboxReply = function () {
    document.getElementById('lightboxReplyParentId').value = '';
    document.getElementById('lightboxReplyBadge').classList.add('d-none');
};

window.submitLightboxComment = async function () {
    const postId = document.getElementById('lightboxCurrentPostId').value;
    const input = document.getElementById('lightboxCommentInput');
    const parentInput = document.getElementById('lightboxReplyParentId');

    const content = input.value.trim();
    if (!content || !postId) return;

    const parentId = parentInput.value ? parseInt(parentInput.value) : null;
    const btn = input.nextElementSibling;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-dark"></i>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/posts/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
            body: JSON.stringify({ PostId: parseInt(postId), Content: content, ParentId: parentId })
        });

        if (res.ok) {
            input.value = '';
            window.cancelLightboxReply();
            window.loadLightboxComments(postId); // Refresh the list
        }
    } catch (e) { console.error(e); }
    finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

// Keyboard navigation support for Lightbox
document.addEventListener('keydown', function (e) {
    const modal = document.getElementById('imageLightboxModal');
    if (modal && !modal.classList.contains('d-none')) {
        // Prevent navigation if they are typing a comment
        if (document.activeElement.id === 'lightboxCommentInput') return;

        if (e.key === 'ArrowRight') window.navigateLightbox(1);
        if (e.key === 'ArrowLeft') window.navigateLightbox(-1);
        if (e.key === 'Escape') window.closeImageLightbox();
    }
});