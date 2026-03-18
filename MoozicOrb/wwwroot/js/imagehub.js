/* ============================================
   IMAGE HUB: JAVASCRIPT ENGINE
   Phase 3 Parity Build: Masonry Cards, CMS Modals, Tabbed Inspector
   ============================================ */

window.currentVaultImages = [];
window.currentLightboxIndex = 0;

// GLOBAL LISTENER: Close 3-dot context menus when clicking outside
document.addEventListener('click', function (e) {
    if (!e.target.closest('.vid-top-right-actions')) {
        document.querySelectorAll('.msg-context-menu.active').forEach(el => el.classList.remove('active'));
    }
});

// ============================================
// 1. MASTER LOADER & FILTER
// ============================================
window.loadImageHub = async function (userId, unassignedOnly = true) {
    const container = document.getElementById('photo-gallery-container');
    if (!container) return;

    try {
        const res = await fetch(`/api/imagehub/vault/${userId}?unassigned=${unassignedOnly}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            window.currentVaultImages = await res.json();
            renderMasonryGrid(window.currentVaultImages, userId);
        } else {
            container.innerHTML = '<div class="text-danger text-center w-100 p-3">Failed to load vault.</div>';
        }
    } catch (err) {
        console.error("Error loading Image Hub data:", err);
        container.innerHTML = '<div class="text-danger text-center w-100 p-3">Connection error.</div>';
    }
};

window.toggleVaultFilter = function () {
    const toggle = document.getElementById('vaultUnassignedToggle');
    const isUnassignedOnly = toggle ? toggle.checked : true;
    const userId = document.getElementById('gallery-user-id').value;
    window.loadImageHub(userId, isUnassignedOnly);
};

// ============================================
// 2. MASONRY GRID RENDERER (Advanced Parity Cards)
// ============================================
function renderMasonryGrid(posts, profileUserId) {
    const container = document.getElementById('photo-gallery-container');
    if (!container) return;

    if (!posts || posts.length === 0) {
        container.innerHTML = '<div style="text-align: center; width: 100%; padding: 50px 0; color: #888; grid-column: 1 / -1;"><i class="fas fa-image fa-3x mb-3"></i><p>Your vault is empty.</p></div>';
        return;
    }

    container.innerHTML = '';

    posts.forEach((post, index) => {
        window.injectSingleMasonryItem(post, container, index, profileUserId);
    });
}

window.injectSingleMasonryItem = function (post, container, index = 0, profileUserId = null) {
    if (!profileUserId && window.AuthState) profileUserId = window.AuthState.userId;

    const pId = post.id !== undefined ? post.id : post.Id;
    const pVis = post.visibility !== undefined ? post.visibility : post.Visibility;
    const attachments = post.attachments || post.Attachments || [];
    const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);
    const imageUrl = imgAttach ? (imgAttach.url || imgAttach.Url) : '/img/default_cover.jpg';

    const titleEnc = encodeURIComponent(post.title || post.Title || '');
    const price = post.price !== undefined ? post.price : (post.Price || null);
    const isOwner = window.AuthState && String(window.AuthState.userId) === String(profileUserId);

    let overlaysHtml = '';
    if (price > 0) {
        overlaysHtml += `<div class="img-badge-price">$${parseFloat(price).toFixed(2)}</div>`;
    }
    if (isOwner && pVis === 2) {
        overlaysHtml += `<div class="img-badge-lock" title="Private"><i class="fas fa-lock"></i></div>`;
    }

    let actionsHtml = '';
    if (isOwner) {
        actionsHtml = `
            <div class="vid-top-right-actions">
                <button class="msg-options-btn" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('active');"><i class="fas fa-ellipsis-v"></i></button>
                <div class="msg-context-menu" style="right:0; top:35px; width:150px;">
                    <button onclick="event.stopPropagation(); window.openImageInspector('${pId}', '${titleEnc}', ${price}, ${pVis}, 3)"><i class="fas fa-edit text-info"></i> Edit Details</button>
                    <button class="text-danger" onclick="event.stopPropagation(); window.FeedService.deletePost('${pId}')"><i class="fas fa-trash"></i> Delete Image</button>
                </div>
            </div>
        `;
    }

    let html = `
        <div class="masonry-item" style="animation: fadeIn 0.5s ease;">
            <div class="masonry-img-wrapper" onclick="window.openImageLightbox(${index})">
                <img src="${imageUrl}" loading="lazy" alt="Vault Image">
                ${overlaysHtml}
            </div>
            ${actionsHtml}
        </div>
    `;

    if (index === 0 && container.children.length > 0) {
        container.insertAdjacentHTML('afterbegin', html);
    } else {
        container.insertAdjacentHTML('beforeend', html);
    }
};

// ============================================
// 3. UPLOAD ENGINE & ACCORDION DROPZONE
// ============================================
window.toggleImageDropZone = function () {
    const wrapper = document.getElementById('imageDropZoneWrapper');
    if (!wrapper) return;
    if (wrapper.style.maxHeight === '0px' || wrapper.style.maxHeight === '') {
        wrapper.style.maxHeight = '400px';
        wrapper.style.marginBottom = '20px';
    } else {
        wrapper.style.maxHeight = '0px';
        wrapper.style.marginBottom = '0px';
    }
};

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
    input.value = '';

    if (files.length === 0) return alert("Please select valid image files.");

    const dropZone = document.getElementById('imageDropZoneContent');
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
            if (window.processImageUpload) file = await window.processImageUpload(file, 1920);

            if (progressBar) progressBar.innerHTML = `<i class="fas fa-cloud-upload-alt text-success fs-4 mb-2"></i><br>Uploading image ${i + 1} of ${files.length}...`;

            const uploadData = new FormData();
            uploadData.append("file", file);

            const uploadRes = await fetch("/api/upload/image", {
                method: 'POST',
                headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                body: uploadData
            });

            if (!uploadRes.ok) throw new Error("File upload failed");
            const mediaResult = await uploadRes.json();

            const payload = {
                ContextType: 1,
                ContextId: parseInt(userId),
                Type: 7,
                Visibility: 2, // Private default
                Title: file.name.split('.')[0],
                MediaAttachments: [{
                    MediaId: mediaResult.id,
                    MediaType: 3,
                    Url: mediaResult.url,
                    SnippetPath: mediaResult.snippetPath
                }]
            };

            await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
                body: JSON.stringify(payload)
            });

        } catch (e) { console.error(`Failed to upload ${file.name}`, e); }
    }

    if (progressBar) progressBar.classList.add('d-none');
    if (dropZone) dropZone.classList.remove('d-none');

    const toggle = document.getElementById('vaultUnassignedToggle');
    window.loadImageHub(userId, toggle ? toggle.checked : true);
};

// ============================================
// 4. APP-NATIVE LIGHTBOX ENGINE
// ============================================
const _internalOpenLightbox = function (index) {
    if (!window.currentVaultImages || window.currentVaultImages.length === 0) return;

    if (index < 0) index = window.currentVaultImages.length - 1;
    if (index >= window.currentVaultImages.length) index = 0;

    window.currentLightboxIndex = index;
    const post = window.currentVaultImages[index];
    const postId = post.id !== undefined ? post.id : post.Id;

    const attachments = post.attachments || post.Attachments || [];
    const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);
    const imageUrl = imgAttach ? (imgAttach.url || imgAttach.Url) : '';

    document.getElementById('lightboxMainImage').src = imageUrl;
    document.getElementById('lightboxCurrentPostId').value = postId;

    const pAuthorName = post.authorName || post.AuthorName || 'User';
    const pAuthorPic = post.authorPic || post.AuthorPic || '/img/profile_default.jpg';
    document.getElementById('lightboxAuthorName').innerText = pAuthorName;
    document.getElementById('lightboxAuthorPic').src = pAuthorPic === 'null' ? '/img/profile_default.jpg' : pAuthorPic;

    const pCreatedAt = post.createdAt || post.CreatedAt;
    document.getElementById('lightboxTimeAgo').innerText = (window.timeAgo && pCreatedAt) ? window.timeAgo(pCreatedAt) : 'Just now';

    const likes = post.likesCount !== undefined ? post.likesCount : (post.LikesCount || 0);
    const comments = post.commentsCount !== undefined ? post.commentsCount : (post.CommentsCount || 0);
    const isLiked = post.isLiked !== undefined ? post.isLiked : (post.IsLiked || false);

    document.getElementById('lightboxLikeCount').innerText = likes;
    document.getElementById('lightboxCommentCount').innerText = comments;
    const likeBtnIcon = document.querySelector('#lightboxLikeBtn i');
    likeBtnIcon.className = isLiked ? 'fas fa-heart text-danger' : 'far fa-heart';

    window.cancelLightboxReply();
    document.getElementById('lightboxCommentInput').value = '';

    const modal = document.getElementById('imageLightboxModal');
    modal.classList.remove('d-none');
    document.body.classList.add('no-scroll');

    window.loadLightboxLiveStats(postId);
    window.loadLightboxComments(postId);
};

window.openImageLightbox = function (index) {
    if (window.isDockManagerActive) {
        const post = window.currentVaultImages[index];
        const postId = post.id !== undefined ? post.id : post.Id;

        if (window.dockSelectedImages.length >= 5) return alert("Maximum 5 images allowed.");
        if (window.dockSelectedImages.find(x => x.postId === postId)) return alert("Image already in dock.");

        const attachments = post.attachments || post.Attachments || [];
        const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);
        const url = imgAttach ? (imgAttach.url || imgAttach.Url) : '';

        window.dockSelectedImages.push({ postId, url });
        window.renderDockSlots();
        return;
    }
    _internalOpenLightbox(index);
};

window.closeImageLightbox = function () {
    const modal = document.getElementById('imageLightboxModal');
    modal.classList.add('d-none');
    modal.classList.remove('show-panel');
    document.body.classList.remove('no-scroll');
    document.getElementById('lightboxMainImage').src = '';
};

window.navigateLightbox = function (direction) {
    window.openImageLightbox(window.currentLightboxIndex + direction);
};

// ============================================
// 5. LIGHTBOX SOCIAL INTERACTIONS
// ============================================
window.loadLightboxLiveStats = async function (postId) {
    try {
        const res = await fetch(`/api/posts/${postId}`, { headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } });
        if (res.ok) {
            const livePost = await res.json();
            const likes = livePost.likesCount !== undefined ? livePost.likesCount : (livePost.LikesCount || 0);
            const isLiked = livePost.isLiked !== undefined ? livePost.isLiked : (livePost.IsLiked || false);

            document.getElementById('lightboxLikeCount').innerText = likes;
            document.querySelector('#lightboxLikeBtn i').className = isLiked ? 'fas fa-heart text-danger' : 'far fa-heart';

            window.currentVaultImages[window.currentLightboxIndex].likesCount = likes;
            window.currentVaultImages[window.currentLightboxIndex].isLiked = isLiked;
        }
    } catch (e) { }
};

window.toggleLightboxLike = async function () {
    const btn = document.getElementById('lightboxLikeBtn');
    const postId = document.getElementById('lightboxCurrentPostId').value;
    if (!postId || btn.disabled) return;

    btn.disabled = true;
    try {
        const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } });
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
    } catch (e) { } finally { btn.disabled = false; }
};

window.loadLightboxComments = async function (postId) {
    const wrapper = document.getElementById('lightboxCommentsFeed');
    if (!wrapper) return;
    wrapper.innerHTML = '<div class="text-center text-muted mt-4"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, { headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } });
        if (res.ok) {
            const comments = await res.json();
            document.getElementById('lightboxCommentCount').innerText = comments.length;

            if (comments.length === 0) {
                wrapper.innerHTML = '<div class="text-muted text-center mt-4 small">Be the first to comment.</div>';
                return;
            }

            const renderComment = (c, isReply = false) => {
                const pic = (c.authorPic && c.authorPic !== 'null') ? c.authorPic.startsWith('/') ? c.authorPic : '/' + c.authorPic : '/img/profile_default.jpg';
                let html = `
                    <div style="display: flex; gap: 12px; margin-bottom: ${isReply ? '12' : '20'}px;">
                        <img src="${pic}" style="width: ${isReply ? '28' : '35'}px; height: ${isReply ? '28' : '35'}px; border-radius: 50%; object-fit: cover; border: 1px solid #333; flex-shrink: 0;">
                        <div style="flex-grow: 1;">
                            <div style="font-weight: bold; font-size: ${isReply ? '0.8' : '0.85'}rem; color: #fff;">${c.authorName} <span style="color: #666; font-size: 0.75rem; font-weight: normal; margin-left: 8px;">${c.createdAgo}</span></div>
                            <div style="color: #ccc; font-size: ${isReply ? '0.85' : '0.95'}rem; margin-top: 4px; line-height: 1.4; word-break: break-word;">${c.content}</div>
                            ${!isReply ? `<div style="margin-top: 6px;"><button onclick="window.prepareLightboxReply(${c.commentId}, '${encodeURIComponent(c.authorName)}')" style="background: transparent; border: none; color: #aaa; font-size: 0.75rem; font-weight: bold; cursor: pointer; padding: 0;">Reply</button></div>` : ''}
                        </div>
                    </div>
                `;
                if (c.replies && c.replies.length > 0) {
                    html += `<div style="margin-left: 47px; margin-bottom: 15px;">${c.replies.map(r => renderComment(r, true)).join('')}</div>`;
                }
                return html;
            };
            wrapper.innerHTML = comments.map(c => renderComment(c, false)).join('');
        }
    } catch (e) { wrapper.innerHTML = '<div class="text-danger small mt-4 text-center">Failed to load comments.</div>'; }
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

    const btn = input.nextElementSibling;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-dark"></i>';
    btn.disabled = true;

    try {
        const res = await fetch('/api/posts/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
            body: JSON.stringify({ PostId: parseInt(postId), Content: content, ParentId: parentInput.value ? parseInt(parentInput.value) : null })
        });

        if (res.ok) {
            input.value = '';
            window.cancelLightboxReply();
            window.loadLightboxComments(postId);
        }
    } catch (e) { } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

document.addEventListener('keydown', function (e) {
    const modal = document.getElementById('imageLightboxModal');
    if (modal && !modal.classList.contains('d-none')) {
        if (document.activeElement.id === 'lightboxCommentInput') return;
        if (e.key === 'ArrowRight') window.navigateLightbox(1);
        if (e.key === 'ArrowLeft') window.navigateLightbox(-1);
        if (e.key === 'Escape') window.closeImageLightbox();
    }
});

// ============================================
// 6. TABBED IMAGE INSPECTOR SIDEBAR (Parity CMS)
// ============================================
window.switchImgInspectorTab = function (tabName, btnElement) {
    document.querySelectorAll('#image-inspector-sidebar .tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = '#6c757d'; // Text muted
    });
    document.querySelectorAll('#image-inspector-sidebar .inspector-tab-body').forEach(body => {
        body.classList.add('d-none');
    });

    btnElement.classList.add('active');
    btnElement.style.color = '#0dcaf0'; // Text info active
    document.getElementById(`img-tab-body-${tabName}`).classList.remove('d-none');
};

window.openImageInspector = function (id, title, price, visibility, targetType) {
    // Hide context menus that triggered this
    document.querySelectorAll('.msg-context-menu.active').forEach(el => el.classList.remove('active'));

    const sidebar = document.getElementById('image-inspector-sidebar');
    if (!sidebar) return;

    document.getElementById('img-edit-target-id').value = id;
    document.getElementById('img-edit-target-type').value = targetType;
    document.getElementById('img-edit-title').value = decodeURIComponent(title === 'null' ? '' : title);
    document.getElementById('img-edit-price').value = price > 0 ? parseFloat(price).toFixed(2) : '';
    document.getElementById('img-edit-visibility').value = visibility !== undefined ? visibility : 0;

    // Handle Gallery vs Image tabs
    const galleryTabBtn = document.getElementById('img-tab-btn-gallery');
    if (targetType === 4 || targetType === 0) {
        document.getElementById('img-inspector-title').innerText = "Edit Gallery";
        galleryTabBtn.classList.remove('d-none');
    } else {
        document.getElementById('img-inspector-title').innerText = "Edit Image Details";
        galleryTabBtn.classList.add('d-none');
    }

    // Default to details tab
    window.switchImgInspectorTab('details', document.querySelector('#image-inspector-sidebar .tab-btn'));
    sidebar.classList.remove('closed');
};

window.closeImageInspector = function () {
    document.getElementById('image-inspector-sidebar').classList.add('closed');
};

window.saveImageInspector = async function () {
    const btn = document.getElementById('img-edit-save-btn');
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const id = document.getElementById('img-edit-target-id').value;
    const type = document.getElementById('img-edit-target-type').value;

    const payload = {
        Title: document.getElementById('img-edit-title').value || null,
        Price: parseFloat(document.getElementById('img-edit-price').value) || null,
        Visibility: parseInt(document.getElementById('img-edit-visibility').value)
    };

    const endpoint = (type == 4 || type == 0) ? `/api/imagehub/collection/${id}` : `/api/imagehub/image/${id}`;

    try {
        const res = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            btn.innerText = "Saved!";
            btn.classList.replace('btn-info', 'btn-success');

            setTimeout(() => {
                window.closeImageInspector();
                btn.innerText = originalText;
                btn.classList.replace('btn-success', 'btn-info');
                btn.disabled = false;

                const toggle = document.getElementById('vaultUnassignedToggle');
                window.loadImageHub(document.getElementById('gallery-user-id').value, toggle ? toggle.checked : true);
            }, 800);
        } else {
            throw new Error("Failed to save");
        }
    } catch (e) {
        btn.innerText = "Error Saving";
        btn.classList.replace('btn-info', 'btn-danger');
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.replace('btn-danger', 'btn-info');
            btn.disabled = false;
        }, 2000);
    }
};

// ============================================
// 7. THE COLLECTION BUILDER (Galleries - Type 4)
// ============================================
window.builderSelectedImages = [];

window.openImageCollectionBuilder = async function () {
    const userId = document.getElementById('gallery-user-id').value;
    window.builderSelectedImages = [];
    document.getElementById('icBuilderTitle').value = '';
    document.getElementById('icBuilderSelectedList').innerHTML = '';
    document.getElementById('imageCollectionBuilderModal').classList.remove('d-none');
    document.body.classList.add('no-scroll');

    const vaultList = document.getElementById('icBuilderVaultList');
    vaultList.innerHTML = '<div class="text-muted text-center w-100 mt-4"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch(`/api/imagehub/vault/${userId}?unassigned=true`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (res.ok) {
            const looseImages = await res.json();
            vaultList.innerHTML = '';

            if (looseImages.length === 0) {
                vaultList.innerHTML = '<div class="text-muted small">No unassigned images available. Upload more to the vault!</div>';
            } else {
                looseImages.forEach(img => {
                    const pId = img.id || img.Id;
                    const attach = (img.attachments || img.Attachments || []).find(a => (a.mediaType || a.MediaType) === 3);
                    const url = attach ? (attach.url || attach.Url) : '';

                    const el = document.createElement('div');
                    el.className = 'builder-vault-item';
                    el.style.cssText = 'width: 80px; height: 80px; cursor: pointer; border-radius: 6px; overflow: hidden; border: 2px solid transparent; transition: 0.2s;';
                    el.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;">`;

                    el.onclick = () => window.toggleBuilderSelection(pId, url, el);
                    vaultList.appendChild(el);
                });
            }
        }
    } catch (e) {
        vaultList.innerHTML = '<div class="text-danger small">Error loading images.</div>';
    }
};

// Dedicated close function to ensure scroll is restored cleanly
window.closeImageCollectionBuilder = function () {
    document.getElementById('imageCollectionBuilderModal').classList.add('d-none');
    document.body.classList.remove('no-scroll');
};

window.toggleBuilderSelection = function (postId, url, element) {
    const index = window.builderSelectedImages.findIndex(x => x.postId === postId);

    if (index === -1) {
        window.builderSelectedImages.push({ postId, url });
        element.style.borderColor = '#28a745';
        element.style.opacity = '0.5';
    } else {
        window.builderSelectedImages.splice(index, 1);
        element.style.borderColor = 'transparent';
        element.style.opacity = '1';
    }
    window.renderBuilderSelectedList();
};

window.renderBuilderSelectedList = function () {
    const container = document.getElementById('icBuilderSelectedList');
    container.innerHTML = '';

    window.builderSelectedImages.forEach((item) => {
        const el = document.createElement('div');
        el.style.cssText = 'width: 70px; height: 70px; position: relative; border-radius: 4px; overflow: hidden;';
        el.innerHTML = `
            <img src="${item.url}" style="width:100%; height:100%; object-fit:cover;">
            <div style="position:absolute; top:0; right:0; background:rgba(220,53,69,0.9); color:white; font-size:10px; padding:2px 5px; cursor:pointer;" onclick="window.removeBuilderSelection(${item.postId})"><i class="fas fa-times"></i></div>
        `;
        container.appendChild(el);
    });
};

window.removeBuilderSelection = function (postId) {
    window.builderSelectedImages = window.builderSelectedImages.filter(x => x.postId !== postId);
    window.renderBuilderSelectedList();

    const vaultList = document.getElementById('icBuilderVaultList');
    const items = vaultList.querySelectorAll('.builder-vault-item');
    items.forEach(el => {
        if (el.onclick.toString().includes(postId)) {
            el.style.borderColor = 'transparent';
            el.style.opacity = '1';
        }
    });
};

window.saveImageCollection = async function () {
    const title = document.getElementById('icBuilderTitle').value.trim();
    if (!title) return alert("Please provide a title for the Gallery.");
    if (window.builderSelectedImages.length === 0) return alert("Please select at least one image.");

    const btn = document.getElementById('icBuilderSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const payload = {
        Title: title,
        Type: 4,
        DisplayContext: 'gallery',
        TargetIds: window.builderSelectedImages.map(x => x.postId)
    };

    try {
        const res = await fetch('/api/collections/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            window.closeImageCollectionBuilder();
            const userId = document.getElementById('gallery-user-id').value;
            window.loadImageHub(userId, true);
        } else {
            alert("Failed to save gallery.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Publish Gallery';
    }
};

// ============================================
// 8. THE CAROUSEL DOCK MANAGER (Type 10)
// ============================================
window.isDockManagerActive = false;
window.dockSelectedImages = [];

window.toggleImageCarouselManager = function () {
    const dock = document.getElementById('imageCarouselManagerDock');
    window.isDockManagerActive = !window.isDockManagerActive;

    const btn = document.getElementById('btnToggleImageCarouselManager');

    if (window.isDockManagerActive) {
        dock.classList.remove('d-none');
        window.dockSelectedImages = [];
        window.renderDockSlots();
        if (btn) btn.classList.add('active', 'bg-warning', 'text-dark');
        alert("Dock Manager Active: Click images in your grid below to pin them to your profile carousel.");
    } else {
        dock.classList.add('d-none');
        if (btn) btn.classList.remove('active', 'bg-warning', 'text-dark');
    }
};

window.renderDockSlots = function () {
    const container = document.getElementById('imageCarouselDockSlotsContainer');
    container.innerHTML = '';

    window.dockSelectedImages.forEach((item) => {
        const el = document.createElement('div');
        el.style.cssText = 'width: 100px; height: 100px; position: relative; border-radius: 6px; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 8px rgba(0,0,0,0.5);';
        el.innerHTML = `
            <img src="${item.url}" style="width:100%; height:100%; object-fit:cover;">
            <div style="position:absolute; top:0; right:0; background:rgba(220,53,69,0.9); color:white; font-size:12px; padding:2px 6px; cursor:pointer;" onclick="window.removeDockItem(${item.postId})"><i class="fas fa-times"></i></div>
        `;
        container.appendChild(el);
    });

    if (window.dockSelectedImages.length === 0) {
        container.innerHTML = '<div class="text-muted w-100 text-center" style="line-height: 100px;">Click images below to add them to the dock.</div>';
    }
};

window.removeDockItem = function (postId) {
    window.dockSelectedImages = window.dockSelectedImages.filter(x => x.postId !== postId);
    window.renderDockSlots();
};

window.saveImageCarouselDock = async function () {
    if (window.dockSelectedImages.length === 0) return alert("Dock is empty.");

    const btn = document.getElementById('btnSaveCarouselDock');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const payload = {
        Title: "Featured Carousel",
        Type: 10,
        DisplayContext: 'gallery',
        TargetIds: window.dockSelectedImages.map(x => x.postId)
    };

    try {
        const res = await fetch('/api/collections/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Carousel saved to profile!");
            window.toggleImageCarouselManager();
        } else {
            alert("Failed to save carousel.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save to Profile';
    }
};