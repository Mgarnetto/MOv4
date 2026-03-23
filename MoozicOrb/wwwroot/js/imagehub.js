/* ============================================
   IMAGE HUB: JAVASCRIPT ENGINE
   Phase 3 Parity Build: Masonry Cards, CMS Modals, Tabbed Inspector, & Carousel
   ============================================ */

window.currentVaultImages = [];
window.currentImageCollections = []; // FIX: Global cache to resolve collection covers perfectly
window.currentLightboxIndex = 0;

// HELPER: Safely resolves relative image paths to the root domain to prevent 404s
const resolveMediaUrl = (url) => {
    if (!url || url === 'null') return '/img/default_cover.jpg';

    // FIX: Normalize Windows-style backslashes from local DB paths to web forward slashes
    url = url.replace(/\\/g, '/');

    if (url.startsWith('http') || url.startsWith('/')) return url;
    return '/' + url;
};

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
    const header = document.getElementById('vault-grid-header');
    if (!container) return;

    // Restore standard UI elements if coming back from a specific gallery view
    if (header) {
        header.innerHTML = "Image Vault";
        header.style.display = 'block';
        header.style.borderBottom = '1px solid #333';
    }
    document.getElementById('image-carousel-container').style.display = 'block';
    document.getElementById('image-collections-container').style.display = 'block';
    const actionBar = document.querySelector('.hub-action-bar');
    if (actionBar) actionBar.style.display = 'flex';
    const filterBtn = document.getElementById('vaultFilterBtn');
    if (filterBtn) filterBtn.style.display = 'flex';

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

        const colRes = await fetch(`/api/imagehub/collections/${userId}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (colRes.ok) {
            const collections = await colRes.json();
            window.currentImageCollections = collections; // FIX: Cache collections globally for dock lookups
            renderImageCollections(collections, userId);
        }

        window.loadImageCarousel(userId);

    } catch (err) {
        console.error("Error loading Image Hub data:", err);
        container.innerHTML = '<div class="text-danger text-center w-100 p-3">Connection error.</div>';
    }
};

window.toggleVaultFilter = function () {
    const btn = document.getElementById('vaultFilterBtn');
    if (!btn) return;

    const isCurrentlyUnassigned = btn.classList.contains('active');
    const newUnassignedState = !isCurrentlyUnassigned;

    if (newUnassignedState) {
        btn.classList.add('active');
        document.getElementById('vaultFilterText').innerText = "Standalone Photos";
        btn.querySelector('i').className = "fas fa-clone";
    } else {
        btn.classList.remove('active');
        document.getElementById('vaultFilterText').innerText = "All Photos";
        btn.querySelector('i').className = "fas fa-images";
    }

    const userId = document.getElementById('gallery-user-id').value;
    window.loadImageHub(userId, newUnassignedState);
};

// ============================================
// 1.5 IMAGE CAROUSEL RENDERER
// ============================================
window.loadImageCarousel = async function (userId) {
    const container = document.getElementById('image-carousel-container');
    if (!container) return;

    try {
        const headers = { "X-Session-Id": window.AuthState?.sessionId || "" };
        const existRes = await fetch(`/api/collections/user/${userId}/context/ProfileCarousel`, { headers });
        let customItems = [];

        if (existRes.ok) {
            const collections = await existRes.json();
            const profileCarousels = collections.filter(c => c.type === 10 || c.Type === 10);

            if (profileCarousels.length > 0) {
                const collectionId = profileCarousels[0].id || profileCarousels[0].Id;
                const detailRes = await fetch(`/api/collections/${collectionId}`, { headers });
                if (detailRes.ok) {
                    const details = await detailRes.json();
                    customItems = details.items || details.Items || [];
                }
            }
        }

        if (customItems.length > 0) {
            renderImageCarouselUI(customItems, false);
        } else {
            const fallbackRes = await fetch(`/api/imagehub/vault/${userId}?unassigned=false`, { headers });
            if (fallbackRes.ok) {
                const recentData = await fallbackRes.json();
                if (recentData.length > 0) {
                    const top10 = recentData.slice(0, 10);
                    renderImageCarouselUI(top10, true);
                } else {
                    container.innerHTML = '';
                }
            }
        }
    } catch (err) {
        console.error("Error loading image carousel:", err);
        container.innerHTML = '';
    }
};

function renderImageCarouselUI(items, isFallback) {
    const container = document.getElementById('image-carousel-container');
    if (!container) return;

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px;">
            <h4 style="color:white; margin: 0; font-weight: 700; border-bottom: 1px solid #333; padding-bottom: 10px; width: 100%; display: flex; justify-content: space-between; align-items: center;">
                <span>${isFallback ? 'Recent Photos' : 'Featured Photos'}</span>
                <div style="display: flex; gap: 10px;">
                    <button onclick="document.getElementById('image-carousel-track').scrollBy({left: -250, behavior: 'smooth'})" style="background: #1a1a1a; border: 1px solid #333; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fas fa-chevron-left"></i></button>
                    <button onclick="document.getElementById('image-carousel-track').scrollBy({left: 250, behavior: 'smooth'})" style="background: #1a1a1a; border: 1px solid #333; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fas fa-chevron-right"></i></button>
                </div>
            </h4>
        </div>
        <div id="image-carousel-track" style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 15px; scrollbar-width: none; scroll-behavior: smooth;">
    `;

    items.forEach((item) => {
        const title = item.title || item.Title || "Untitled";
        let rawUrl = item.artUrl || item.ArtUrl || item.url || item.Url;

        if (!rawUrl && item.attachments) {
            const att = item.attachments.find(a => a.mediaType === 3);
            rawUrl = att ? att.url : '/img/default_cover.jpg';
        } else if (!rawUrl && item.Attachments) {
            const att = item.Attachments.find(a => a.MediaType === 3);
            rawUrl = att ? att.Url : '/img/default_cover.jpg';
        }

        const imgUrl = resolveMediaUrl(rawUrl);
        const postId = item.postId || item.PostId || item.id || item.Id || item.targetId || item.TargetId;
        const tType = item.targetType !== undefined ? item.targetType : (item.TargetType !== undefined ? item.TargetType : 3);

        let finalImgUrl = imgUrl;

        // Smart Routing Logic
        let clickAction = `window.openLightboxByPostId(${postId})`;
        let iconHtml = `<i class="fas fa-expand-arrows-alt" style="color: white; font-size: 3rem; text-shadow: 0 2px 5px rgba(0,0,0,0.8);"></i>`;

        // If it's a Collection (0) or Image Gallery (4)
        if (tType === 0 || tType === 4 || tType === '0' || tType === '4') {
            const safeTitleClick = encodeURIComponent(title).replace(/'/g, "%27");
            clickAction = `window.viewImageCollection('${postId}', '${safeTitleClick}')`;
            iconHtml = `<i class="fas fa-images" style="color: white; font-size: 3rem; text-shadow: 0 2px 5px rgba(0,0,0,0.8);"></i>`;

            // FIX: Bulletproof Collection Cover Lookup
            if (window.currentImageCollections) {
                const foundCol = window.currentImageCollections.find(c => String(c.id || c.Id) === String(postId));
                if (foundCol && (foundCol.coverImageUrl || foundCol.CoverImageUrl)) {
                    finalImgUrl = resolveMediaUrl(foundCol.coverImageUrl || foundCol.CoverImageUrl);
                }
            }
        }

        html += `
            <div style="flex: 0 0 250px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; overflow: hidden; position: relative; cursor: pointer; transition: transform 0.2s;" 
                 onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'"
                 onclick="${clickAction}">
                
                <div style="position: relative; width: 100%; aspect-ratio: 1/1;">
                    <img src="${finalImgUrl}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                        ${iconHtml}
                    </div>
                </div>
                <div style="padding: 10px; text-align: center; color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem;">
                    ${title}
                </div>
            </div>
        `;
    });

    html += `</div>
    <style>#image-carousel-track::-webkit-scrollbar { display: none; }</style>`;

    container.innerHTML = html;
}

window.openLightboxByPostId = async function (postId) {
    if (!window.currentVaultImages) return;
    const index = window.currentVaultImages.findIndex(p => (p.id == postId || p.Id == postId));

    if (index !== -1) {
        window.openImageLightbox(index);
    } else {
        try {
            const res = await fetch(`/api/posts/${postId}`, { headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } });
            if (res.ok) {
                const singlePost = await res.json();
                window.currentVaultImages.unshift(singlePost);
                window.openImageLightbox(0);
            }
        } catch (e) {
            console.error("Could not load full image for lightbox.", e);
        }
    }
};

// ============================================
// 2. MASONRY GRID RENDERER & COLLECTIONS
// ============================================
function renderMasonryGrid(posts, profileUserId) {
    const container = document.getElementById('photo-gallery-container');
    if (!container) return;

    if (!posts || posts.length === 0) {
        container.innerHTML = '<div style="text-align: center; width: 100%; padding: 50px 0; color: #888; grid-column: 1 / -1;"><i class="fas fa-image fa-3x mb-3"></i><p>No images found.</p></div>';
        return;
    }

    container.innerHTML = '';

    posts.forEach((post, index) => {
        window.injectSingleMasonryItem(post, container, index, profileUserId);
    });
}

function renderImageCollections(collections, profileUserId) {
    const container = document.getElementById('image-collections-container');
    if (!container) return;

    const visibleCollections = collections.filter(c => c.displayContext === 'gallery' || c.DisplayContext === 'gallery');

    if (visibleCollections.length === 0) {
        container.innerHTML = '';
        return;
    }

    const isOwner = window.AuthState && String(window.AuthState.userId) === String(profileUserId);

    let html = `
        <h4 style="color:white; border-bottom:1px solid #333; padding-bottom:10px;">Photo Galleries</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-top: 15px;">
    `;

    visibleCollections.forEach(col => {
        const title = col.title || col.Title || "Untitled Gallery";
        const desc = col.description || col.Description || "";
        const art = resolveMediaUrl(col.coverImageUrl || col.CoverImageUrl);
        const colId = col.id || col.Id;
        const price = col.price || col.Price || 0;
        const vis = col.visibility || col.Visibility || 0;

        // FIX: Bulletproof apostrophe escaping
        const safeTitle = encodeURIComponent(title).replace(/'/g, "%27");
        const safeDesc = encodeURIComponent(desc).replace(/'/g, "%27");

        html += `
            <div class="vid-card">
                <div class="vid-thumb-wrapper" onclick="window.viewImageCollection('${colId}', '${safeTitle}')">
                    <img src="${art}" class="vid-thumb-img" style="opacity: 0.7;">
                    <div class="vid-play-overlay"><i class="fas fa-images" style="color: white; font-size: 3rem;"></i></div>
                    
                    ${isOwner ? `
                    <div class="vid-top-right-actions">
                        <div class="vid-action-circle" onclick="event.stopPropagation(); window.addToImageCarouselDock('${colId}', '${safeTitle}', '${art}', 0)" title="Feature Gallery"><i class="fas fa-star" style="font-size:0.8rem;"></i></div>
                        
                        <div class="vid-action-circle position-relative" onclick="event.stopPropagation(); this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <i class="fas fa-ellipsis-v"></i>
                        </div>
                        <div class="msg-context-menu" style="position: absolute; right: 0; top: 100%; width: 170px; z-index: 1050; background: #222; border: 1px solid #444; border-radius: 6px; display: none;">
                            <button onclick="event.stopPropagation(); window.openImageInspector('${colId}', 0, '${safeTitle}', '${safeDesc}', ${price}, ${vis}, 4)" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-edit"></i> Edit Gallery</button>
                            <button class="text-danger" onclick="event.stopPropagation(); window.twoStepDeleteCollection(this, '${colId}')" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                    ` : ''}

                    <div style="position: absolute; bottom: 10px; left: 10px; right: 10px; color: white; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.9); z-index: 5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 1.1rem;">
                        ${title}
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

window.injectSingleMasonryItem = function (post, container, index = 0, profileUserId = null) {
    if (!profileUserId && window.AuthState) profileUserId = window.AuthState.userId;

    const pId = post.id !== undefined ? post.id : post.Id;
    const pVis = post.visibility !== undefined ? post.visibility : post.Visibility;
    const postType = post.type !== undefined ? post.type : (post.Type || 0);

    const attachments = post.attachments || post.Attachments || [];
    const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);
    const imageUrl = resolveMediaUrl(imgAttach ? (imgAttach.url || imgAttach.Url) : null);
    const mId = imgAttach ? (imgAttach.mediaId || imgAttach.MediaId) : 0;

    const isOrphan = !pId || pId === 0 || pId === '0';

    // FIX: Bulletproof apostrophe escaping
    const titleEnc = encodeURIComponent(post.title || post.Title || '').replace(/'/g, "%27");
    const descEnc = encodeURIComponent(post.text || post.Text || '').replace(/'/g, "%27");
    const price = post.price !== undefined ? post.price : (post.Price || null);
    const isOwner = window.AuthState && String(window.AuthState.userId) === String(profileUserId);

    const likes = post.likesCount !== undefined ? post.likesCount : (post.LikesCount || 0);
    const comments = post.commentsCount !== undefined ? post.commentsCount : (post.CommentsCount || 0);
    const isLiked = post.isLiked !== undefined ? post.isLiked : (post.IsLiked || false);

    // Extract the title for display
    const displayTitle = post.title || post.Title || '';

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
                <div class="vid-action-circle" onclick="event.stopPropagation(); window.addToImageCarouselDock('${mId}', '${titleEnc}', '${imageUrl}', 3)" title="Feature Image"><i class="fas fa-star" style="font-size:0.8rem;"></i></div>
                
                <div class="vid-action-circle position-relative" onclick="event.stopPropagation(); this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                    <i class="fas fa-ellipsis-v"></i>
                </div>
                <div class="msg-context-menu" style="position: absolute; right: 0; top: 100%; width: 160px; z-index: 1050; background: #222; border: 1px solid #444; border-radius: 6px; display: none;">
                    ${!isOrphan ? (
                postType === 1
                    ? `<button onclick="event.stopPropagation(); window.openStandardEditorFromHub('${pId}')" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-edit text-warning"></i> Edit Post</button>`
                    : `<button onclick="event.stopPropagation(); window.openImageInspector('${mId}', '${pId}', '${titleEnc}', '${descEnc}', ${price}, ${pVis}, 3)" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-edit text-info"></i> Edit Details</button>`
            ) : ''}
                    <button class="text-danger track-delete-btn" onclick="event.stopPropagation(); window.deleteVaultImage(${pId}, ${mId})" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #ff0055; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-trash"></i> Delete Image</button>
                </div>
            </div>
        `;
    }

    let gridInteractionsHtml = '';
    if (!isOrphan) {
        gridInteractionsHtml = `
            <div class="vid-actions-overlay">
                <button class="vid-btn-translucent" onclick="event.stopPropagation(); window.toggleGridLike(this, '${pId}')">
                    <i class="${isLiked ? 'fas text-danger' : 'far'} fa-heart like-icon"></i> <span class="like-count-span">${likes}</span>
                </button>
                <button class="vid-btn-translucent" onclick="event.stopPropagation(); window.openImageLightbox(${index})">
                    <i class="fas fa-comment"></i> <span class="comment-count-span">${comments}</span>
                </button>
            </div>
        `;
    }

    let html = `
        <div class="masonry-item" id="masonry-card-${pId}" style="animation: fadeIn 0.5s ease;">
            <div class="masonry-img-wrapper" onclick="window.openImageLightbox(${index})">
                <img src="${imageUrl}" loading="lazy" alt="Vault Image">
                <div class="vid-play-overlay"></div>
                ${overlaysHtml}
                ${gridInteractionsHtml}

                ${displayTitle ? `
                <div style="position: absolute; bottom: 45px; left: 10px; right: 10px; color: white; font-weight: bold; font-size: 0.95rem; text-shadow: 0 2px 4px rgba(0,0,0,0.9); z-index: 5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">
                    ${displayTitle}
                </div>` : ''}
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

window.toggleGridLike = async function (btn, postId) {
    if (!postId || postId === '0') return;
    btn.disabled = true;
    try {
        const res = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });
        if (res.ok) {
            const data = await res.json();
            const icon = btn.querySelector('i');
            const span = btn.querySelector('span');
            let count = parseInt(span.innerText) || 0;

            if (data.liked) {
                icon.className = 'fas fa-heart text-danger like-icon';
                span.innerText = count + 1;
            } else {
                icon.className = 'far fa-heart like-icon';
                span.innerText = Math.max(0, count - 1);
            }
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; }
};

// ============================================
// 2.5 GALLERY VIEWER (FIXED LAYOUT)
// ============================================
window.viewImageCollection = async function (collectionId, title) {
    const header = document.getElementById('vault-grid-header');

    document.getElementById('image-carousel-container').style.display = 'none';
    document.getElementById('image-collections-container').style.display = 'none';
    const actionBar = document.querySelector('.hub-action-bar');
    if (actionBar) actionBar.style.display = 'none';
    const filterBtn = document.getElementById('vaultFilterBtn');
    if (filterBtn) filterBtn.style.display = 'none';

    const container = document.getElementById('photo-gallery-container');
    if (!container) return;

    // Overwrite the Header dynamically so it stays outside the grid
    if (header) {
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <button onclick="const uid = document.getElementById('gallery-user-id').value; window.loadImageHub(uid, true);" style="background: #222; color: white; border: 1px solid #444; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#222'">
                    <i class="fas fa-arrow-left me-2"></i> Back
                </button>
                <span style="color: #0dcaf0; font-weight: 800; font-size: 1.2rem;">${decodeURIComponent(title)}</span>
            </div>`;
        header.style.borderBottom = 'none';
    }

    container.innerHTML = '<div class="text-center p-4 text-muted" style="grid-column: 1 / -1;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';

    const galleryTop = document.querySelector('.gallery-container').getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top: galleryTop, behavior: 'smooth' });

    try {
        const res = await fetch(`/api/collections/${collectionId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        if (res.ok) {
            const data = await res.json();
            const items = data.items || data.Items || [];

            if (items.length === 0) {
                container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #888; padding: 2rem; background: #111; border-radius: 8px; border: 1px dashed #333; width: 100%;">No images in this gallery.</div>`;
            } else {
                container.innerHTML = '';

                const mappedItems = items.map(item => {
                    let pId = item.postId || item.PostId;
                    if (!pId) pId = 0;

                    return {
                        id: pId,
                        title: item.title || item.Title,
                        text: "",
                        authorName: item.artistName || item.ArtistName,
                        authorPic: item.authorPic || item.AuthorPic,
                        visibility: 0,
                        price: item.price || item.Price || 0,
                        likesCount: 0,
                        commentsCount: 0,
                        isLiked: false,
                        attachments: [{
                            mediaType: 3,
                            url: item.artUrl || item.ArtUrl || item.url || item.Url,
                            mediaId: item.targetId || item.TargetId
                        }]
                    };
                });

                window.currentVaultImages = mappedItems;
                mappedItems.forEach((mappedPost, index) => {
                    window.injectSingleMasonryItem(mappedPost, container, index, document.getElementById('gallery-user-id').value);

                    if (mappedPost.id > 0) {
                        fetch(`/api/posts/${mappedPost.id}`, { headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } })
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                if (data) {
                                    mappedPost.likesCount = data.likesCount || data.LikesCount || 0;
                                    mappedPost.commentsCount = data.commentsCount || data.CommentsCount || 0;
                                    mappedPost.isLiked = data.isLiked || data.IsLiked || false;

                                    const card = document.getElementById(`masonry-card-${mappedPost.id}`);
                                    if (card) {
                                        const likeSpan = card.querySelector('.like-count-span');
                                        const likeIcon = card.querySelector('.like-icon');
                                        const commentSpan = card.querySelector('.comment-count-span');
                                        if (likeSpan) likeSpan.innerText = mappedPost.likesCount;
                                        if (likeIcon) likeIcon.className = mappedPost.isLiked ? 'fas fa-heart text-danger like-icon' : 'far fa-heart like-icon';
                                        if (commentSpan) commentSpan.innerText = mappedPost.commentsCount;
                                    }
                                }
                            }).catch(() => { });
                    }
                });
            }
        }
    } catch (e) {
        container.innerHTML = '<div class="text-danger p-3" style="grid-column: 1 / -1; width: 100%;">Failed to load gallery images.</div>';
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
        wrapper.style.opacity = '1';
        wrapper.style.marginBottom = '30px';
    } else {
        wrapper.style.maxHeight = '0px';
        wrapper.style.opacity = '0';
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

        try {
            if (window.processImageUpload) file = await window.processImageUpload(file, 1920);

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
                Visibility: 2,
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

    const btn = document.getElementById('vaultFilterBtn');
    window.loadImageHub(userId, btn ? btn.classList.contains('active') : true);
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
    const imageUrl = resolveMediaUrl(imgAttach ? (imgAttach.url || imgAttach.Url) : null);

    document.getElementById('lightboxMainImage').src = imageUrl;
    document.getElementById('lightboxCurrentPostId').value = postId;

    // NEW: Inject Title and Description into the Lightbox UI
    const displayTitle = post.title || post.Title || '';
    const displayDesc = post.text || post.Text || '';
    const titleEl = document.getElementById('lightboxMainTitle');
    const descEl = document.getElementById('lightboxMainDesc');

    if (titleEl) {
        titleEl.innerText = displayTitle;
        titleEl.style.display = displayTitle ? 'block' : 'none';
    }
    if (descEl) {
        descEl.innerText = displayDesc;
        descEl.style.display = displayDesc ? 'block' : 'none';
    }

    const likes = post.likesCount !== undefined ? post.likesCount : (post.LikesCount || 0);
    const comments = post.commentsCount !== undefined ? post.commentsCount : (post.CommentsCount || 0);
    const isLiked = post.isLiked !== undefined ? post.isLiked : (post.IsLiked || false);

    document.getElementById('lightboxMainLikeCount').innerText = likes;
    document.getElementById('lightboxMainCommentCount').innerText = comments;
    const likeBtnIcon = document.querySelector('#lightboxMainLikeBtn i');
    if (likeBtnIcon) {
        likeBtnIcon.className = isLiked ? 'fas fa-heart text-danger' : 'far fa-heart';
    }

    window.cancelLightboxReply();
    document.getElementById('lightboxCommentInput').value = '';

    const modal = document.getElementById('imageLightboxModal');
    modal.classList.remove('d-none');
    document.body.classList.add('no-scroll');

    window.loadLightboxLiveStats(postId);
    window.loadLightboxComments(postId);
};

window.openImageLightbox = function (index) {
    if (window.isImageCarouselManagerActive) {
        const post = window.currentVaultImages[index];

        const attachments = post.attachments || post.Attachments || [];
        const imgAttach = attachments.find(a => (a.mediaType || a.MediaType) === 3);
        const mId = imgAttach ? (imgAttach.mediaId || imgAttach.MediaId) : 0;
        const url = resolveMediaUrl(imgAttach ? (imgAttach.url || imgAttach.Url) : null);
        const titleEnc = encodeURIComponent(post.title || post.Title || '').replace(/'/g, "%27");

        if (window.imageCarouselDockItems.length >= 10) return alert("Maximum allowed limit reached.");
        if (window.imageCarouselDockItems.find(x => String(x.id) === String(mId))) return alert("Image already in dock.");

        window.addToImageCarouselDock(mId, titleEnc, url, 3);
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
    if (!postId || postId === 0 || postId === '0') return;
    try {
        const res = await fetch(`/api/posts/${postId}`, { headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } });
        if (res.ok) {
            const livePost = await res.json();
            const likes = livePost.likesCount !== undefined ? livePost.likesCount : (livePost.LikesCount || 0);
            const isLiked = livePost.isLiked !== undefined ? livePost.isLiked : (livePost.IsLiked || false);

            document.getElementById('lightboxMainLikeCount').innerText = likes;

            const likeBtnIcon = document.querySelector('#lightboxMainLikeBtn i');
            if (likeBtnIcon) {
                likeBtnIcon.className = isLiked ? 'fas fa-heart text-danger' : 'far fa-heart';
            }

            window.currentVaultImages[window.currentLightboxIndex].likesCount = likes;
            window.currentVaultImages[window.currentLightboxIndex].isLiked = isLiked;
        }
    } catch (e) { }
};

window.toggleLightboxLike = async function () {
    const btn = document.getElementById('lightboxMainLikeBtn');
    const postId = document.getElementById('lightboxCurrentPostId').value;
    if (!postId || btn.disabled || postId === '0') return;

    btn.disabled = true;
    try {
        const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST', headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } });
        if (res.ok) {
            const data = await res.json();
            const countSpan = document.getElementById('lightboxMainLikeCount');
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

            // Sync with Masonry Grid seamlessly
            const card = document.getElementById(`masonry-card-${postId}`);
            if (card) {
                const gridLikeSpan = card.querySelector('.like-count-span');
                const gridLikeIcon = card.querySelector('.like-icon');
                if (gridLikeSpan) gridLikeSpan.innerText = countSpan.innerText;
                if (gridLikeIcon) gridLikeIcon.className = icon.className + ' like-icon';
            }
        }
    } catch (e) { } finally { btn.disabled = false; }
};

window.loadLightboxComments = async function (postId) {
    const wrapper = document.getElementById('lightboxCommentsFeed');
    if (!wrapper) return;

    if (!postId || postId === 0 || postId === '0') {
        wrapper.innerHTML = '<div class="text-center text-muted mt-4 small">Comments disabled for standalone media.</div>';
        return;
    }

    wrapper.innerHTML = '<div class="text-center text-muted mt-4"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, { headers: { 'X-Session-Id': window.AuthState?.sessionId || '' } });
        if (res.ok) {
            const comments = await res.json();
            document.getElementById('lightboxMainCommentCount').innerText = comments.length;

            if (comments.length === 0) {
                wrapper.innerHTML = '<div class="text-muted text-center mt-4 small">Be the first to comment.</div>';
                return;
            }

            const renderComment = (c, isReply = false) => {
                const pic = resolveMediaUrl(c.authorPic);
                // FIX: Escape apostrophes in author name for reply button
                const safeAuthorName = encodeURIComponent(c.authorName).replace(/'/g, "%27");

                let html = `
                    <div style="display: flex; gap: 12px; margin-bottom: ${isReply ? '12' : '20'}px; ${!isReply ? 'border-bottom: 1px solid #222; padding-bottom: 15px;' : ''}">
                        <img src="${pic}" style="width: ${isReply ? '28' : '40'}px; height: ${isReply ? '28' : '40'}px; border-radius: 50%; object-fit: cover; border: 1px solid #333; flex-shrink: 0;">
                        <div style="flex-grow: 1;">
                            <div style="font-weight: bold; font-size: ${isReply ? '0.8' : '0.85'}rem; color: #fff;">
                                ${c.authorName} 
                                <span style="color: #666; font-size: 0.75rem; font-weight: normal; margin-left: 8px;">${c.createdAgo || ''}</span>
                            </div>
                            <div style="color: #ccc; font-size: ${isReply ? '0.85' : '0.95'}rem; margin-top: 4px; line-height: 1.4; word-break: break-word;">${c.content}</div>
                            ${!isReply ? `
                            <div style="margin-top: 6px;">
                                <button onclick="window.prepareLightboxReply(${c.commentId}, '${safeAuthorName}')" style="background: rgba(13, 202, 240, 0.1); border: 1px solid rgba(13, 202, 240, 0.3); color: #0dcaf0; font-size: 0.75rem; font-weight: bold; cursor: pointer; padding: 2px 10px; border-radius: 12px; transition: 0.2s;" onmouseover="this.style.background='rgba(13, 202, 240, 0.2)'" onmouseout="this.style.background='rgba(13, 202, 240, 0.1)'">Reply</button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                if (c.replies && c.replies.length > 0) {
                    html += `<div style="margin-left: 52px; border-left: 2px solid #333; padding-left: 15px; margin-bottom: 15px;">${c.replies.map(r => renderComment(r, true)).join('')}</div>`;
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

    if (!content || !postId || postId === '0') return;

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

            // Sync with Masonry Grid
            const card = document.getElementById(`masonry-card-${postId}`);
            if (card) {
                const gridCommentSpan = card.querySelector('.comment-count-span');
                if (gridCommentSpan) {
                    const currentVal = parseInt(gridCommentSpan.innerText) || 0;
                    gridCommentSpan.innerText = currentVal + 1;
                }
            }
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
// 6. TABBED IMAGE INSPECTOR SIDEBAR & GALLERY MANAGER
// ============================================
window.switchImgInspectorTab = function (tabName) {
    document.querySelectorAll('#image-inspector-sidebar .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('#image-inspector-sidebar .tab-content').forEach(content => {
        content.classList.remove('active');
        content.classList.add('d-none');
    });

    const activeTabBtn = document.getElementById(`img-tab-btn-${tabName}`);
    if (activeTabBtn) activeTabBtn.classList.add('active');

    const activeContent = document.getElementById(`img-tab-content-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.classList.remove('d-none');
    }
};

window.openImageInspector = function (mediaId, postId, title, desc, price, visibility, targetType) {
    document.querySelectorAll('.msg-context-menu.active').forEach(el => el.classList.remove('active'));

    const sidebar = document.getElementById('image-inspector-sidebar');
    if (!sidebar) return;

    // Store MediaId in the existing input
    document.getElementById('img-edit-target-id').value = mediaId;
    document.getElementById('img-edit-target-type').value = targetType;

    // Inject and store PostId in a new hidden input
    let postInput = document.getElementById('img-edit-post-id');
    if (!postInput) {
        postInput = document.createElement('input');
        postInput.type = 'hidden';
        postInput.id = 'img-edit-post-id';
        sidebar.appendChild(postInput);
    }
    postInput.value = postId;

    document.getElementById('img-edit-title').value = decodeURIComponent(title === 'null' ? '' : title);
    document.getElementById('img-edit-desc').value = decodeURIComponent(desc === 'null' ? '' : desc);
    document.getElementById('img-edit-price').value = price > 0 ? parseFloat(price).toFixed(2) : '';
    document.getElementById('img-edit-visibility').value = visibility !== undefined ? visibility : 0;

    const galleryTabBtn = document.getElementById('img-tab-btn-gallery');

    if (targetType === 4 || targetType === 0 || targetType === '4' || targetType === '0') {
        document.getElementById('img-inspector-title').innerText = "Edit Gallery";
        if (galleryTabBtn) galleryTabBtn.classList.remove('d-none');
        window.loadInspectorGalleryList(mediaId); // mediaId acts as collectionId here
    } else {
        document.getElementById('img-inspector-title').innerText = "Edit Image Details";
        if (galleryTabBtn) galleryTabBtn.classList.add('d-none');
    }

    window.switchImgInspectorTab('details');
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

    const mediaId = document.getElementById('img-edit-target-id').value;
    const postId = document.getElementById('img-edit-post-id')?.value || 0;
    const type = document.getElementById('img-edit-target-type').value;

    const priceInput = document.getElementById('img-edit-price').value;
    const isCollection = (type == 4 || type == 0 || type == '4' || type == '0');

    // FIX: Properly formatting the Dual-ID Payload
    const payload = {
        MediaId: parseInt(mediaId) || 0,
        PostId: parseInt(postId) || 0,
        Title: document.getElementById('img-edit-title').value.trim() || "Untitled",
        Visibility: parseInt(document.getElementById('img-edit-visibility').value) || 0,
        Price: priceInput === "" ? null : parseFloat(priceInput),
        MediaAttachments: []
    };

    if (isCollection) {
        payload.Text = document.getElementById('img-edit-desc').value.trim() || " ";
    } else {
        payload.Text = document.getElementById('img-edit-desc').value.trim() || " ";
    }

    const endpoint = isCollection ? `/api/imagehub/collection/${mediaId}` : `/api/imagehub/image/${mediaId}`;

    try {
        const res = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            btn.innerText = "Saved!";
            btn.style.background = "#28a745";

            setTimeout(() => {
                window.closeImageInspector();
                btn.innerText = originalText;
                btn.style.background = "linear-gradient(135deg, #00d2ff, #007bff)";
                btn.disabled = false;

                const toggleBtn = document.getElementById('vaultFilterBtn');
                window.loadImageHub(document.getElementById('gallery-user-id').value, toggleBtn ? toggleBtn.classList.contains('active') : true);
            }, 800);
        } else {
            throw new Error("Failed to save");
        }
    } catch (e) {
        btn.innerText = "Error Saving";
        btn.style.background = "#dc3545";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "linear-gradient(135deg, #00d2ff, #007bff)";
            btn.disabled = false;
        }, 2000);
    }
};

window.inspectorGalleryImages = [];
window.inspectorVaultImages = [];

window.loadInspectorGalleryList = async function (collectionId) {
    const galleryContainer = document.getElementById('inspector-gallery-images-container');
    const vaultContainer = document.getElementById('inspector-vault-images-container');

    if (galleryContainer) galleryContainer.innerHTML = '<div class="text-center text-muted" style="margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    if (vaultContainer) vaultContainer.innerHTML = '';

    try {
        const colRes = await fetch(`/api/collections/${collectionId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        let currentImages = [];
        if (colRes.ok) {
            const data = await colRes.json();
            currentImages = data.items || data.Items || [];
        }
        window.inspectorGalleryImages = currentImages;

        const existingMediaIds = currentImages.map(t => String(t.targetId || t.TargetId));

        window.inspectorVaultImages = window.currentVaultImages.filter(t => {
            const att = t.attachments || t.Attachments || [];
            const img = att.find(a => (a.mediaType || a.MediaType) === 3);
            const mId = img ? String(img.mediaId || img.MediaId) : "0";
            return !existingMediaIds.includes(mId);
        });

        window.renderInspectorGalleryList(collectionId);
    } catch (e) { console.error("Error loading inspector gallery", e); }
};

window.renderInspectorGalleryList = function (collectionId) {
    const galleryContainer = document.getElementById('inspector-gallery-images-container');
    const vaultContainer = document.getElementById('inspector-vault-images-container');

    if (galleryContainer) {
        let gHtml = '';
        if (window.inspectorGalleryImages.length === 0) {
            gHtml = '<div class="text-center p-4 text-muted small">No images in this gallery.</div>';
        } else {
            window.inspectorGalleryImages.forEach((img, i) => {
                const title = img.title || img.Title || "Untitled";
                const linkId = img.linkId || img.LinkId;
                const artUrl = resolveMediaUrl(img.artUrl || img.ArtUrl);

                gHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex-grow: 1;">
                            <span style="color: #555; font-weight: 900; font-size: 0.75rem; width: 15px; text-align: right;">${i + 1}.</span>
                            <img src="${artUrl}" style="width: 35px; height: 35px; object-fit: cover; border-radius: 4px;">
                            <span style="color: #eee; font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                        </div>
                        <button onclick="window.inspectorRemoveGalleryImage(this, ${linkId}, ${collectionId})" style="background: transparent; border: 1px solid #ff4d4d; border-radius: 4px; color: #ff4d4d; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: 0.2s;" onmouseover="this.style.background='rgba(255,77,77,0.1)'" onmouseout="this.style.background='transparent'"><i class="fas fa-minus" style="font-size: 10px;"></i></button>
                    </div>
                `;
            });
        }
        galleryContainer.innerHTML = gHtml;
    }

    if (vaultContainer) {
        let vHtml = '';
        if (window.inspectorVaultImages.length === 0) {
            vHtml = '<div class="text-center p-4 text-muted small">No available images in vault.</div>';
        } else {
            window.inspectorVaultImages.forEach(img => {
                const title = img.title || img.Title || "Untitled";
                const att = img.attachments || img.Attachments || [];
                const imgAttach = att.find(a => (a.mediaType || a.MediaType) === 3);
                const mediaId = imgAttach ? (imgAttach.mediaId || imgAttach.MediaId) : 0;
                const artUrl = resolveMediaUrl(imgAttach ? (imgAttach.url || imgAttach.Url) : null);

                if (mediaId !== 0) {
                    vHtml += `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: #121212; padding: 10px; border-radius: 6px; border: 1px solid #222; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex-grow: 1;">
                                <img src="${artUrl}" style="width: 35px; height: 35px; object-fit: cover; border-radius: 4px;">
                                <span style="color: #aaa; font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                            </div>
                            <button onclick="window.inspectorAddGalleryImage(this, ${mediaId}, ${collectionId})" style="background: transparent; border: 1px solid #28a745; border-radius: 4px; color: #28a745; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: 0.2s;" onmouseover="this.style.background='rgba(40,167,69,0.1)'" onmouseout="this.style.background='transparent'"><i class="fas fa-plus" style="font-size: 10px;"></i></button>
                        </div>
                    `;
                }
            });
        }
        vaultContainer.innerHTML = vHtml;
    }
};

window.inspectorRemoveGalleryImage = async function (btn, linkId, collectionId) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 10px;"></i>'; btn.disabled = true;
    try {
        const res = await fetch(`/api/collections/items/${linkId}?collectionId=${collectionId}`, {
            method: 'DELETE', headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (res.ok) { window.loadInspectorGalleryList(collectionId); }
        else { btn.innerHTML = '<i class="fas fa-minus" style="font-size: 10px;"></i>'; btn.disabled = false; }
    } catch (e) { btn.disabled = false; }
};

window.inspectorAddGalleryImage = async function (btn, targetId, collectionId) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 10px;"></i>'; btn.disabled = true;
    try {
        const res = await fetch(`/api/collections/${collectionId}/add-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify({ TargetId: targetId, TargetType: 3 })
        });
        if (res.ok) { window.loadInspectorGalleryList(collectionId); }
        else { btn.innerHTML = '<i class="fas fa-plus" style="font-size: 10px;"></i>'; btn.disabled = false; }
    } catch (e) { btn.disabled = false; }
};

window.twoStepDeleteCollection = async function (btnElement, collectionId) {
    if (window.event) window.event.stopPropagation();

    if (!btnElement.classList.contains('confirming')) {
        btnElement.classList.add('confirming');
        btnElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Confirm?`;
        btnElement.style.color = '#ff4d4d';
        setTimeout(() => {
            if (btnElement) {
                btnElement.classList.remove('confirming');
                btnElement.innerHTML = `<i class="fas fa-trash"></i> Delete Gallery`;
                btnElement.style.color = '#ff0055';
            }
        }, 4000);
        return;
    }

    btnElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;
    try {
        const res = await fetch(`/api/collections/${collectionId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (res.ok) {
            const userId = document.getElementById("gallery-user-id")?.value;
            if (userId) {
                const toggleBtn = document.getElementById('vaultFilterBtn');
                window.loadImageHub(userId, toggleBtn ? toggleBtn.classList.contains('active') : true);
            }
        }
    } catch (e) { console.error(e); }
};


// ============================================
// 7. THE COLLECTION BUILDER (NAMESPACED FOR IMAGE HUB)
// ============================================
window.imageBuilderSelectedItems = [];

window.openImageCollectionBuilder = async function () {
    const userId = document.getElementById('gallery-user-id').value;
    window.imageBuilderSelectedItems = [];

    const titleInput = document.getElementById('icBuilderTitle');
    if (titleInput) titleInput.value = '';

    const selectedList = document.getElementById('icBuilderSelectedList');
    if (selectedList) selectedList.innerHTML = '';

    const modal = document.getElementById('imageCollectionBuilderModal');
    if (modal) modal.classList.remove('d-none');
    document.body.classList.add('no-scroll');

    const vaultList = document.getElementById('icBuilderVaultList');
    if (!vaultList) return;
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
                    const attach = (img.attachments || img.Attachments || []).find(a => (a.mediaType || a.MediaType) === 3);
                    const url = resolveMediaUrl(attach ? (attach.url || attach.Url) : null);
                    // FIX: Pass mId to the gallery builder so it tracks correct image records
                    const mId = attach ? (attach.mediaId || attach.MediaId) : 0;

                    const el = document.createElement('div');
                    el.className = 'builder-vault-item';
                    el.style.cssText = 'position: relative; width: 100%; padding-top: 100%; cursor: pointer; border-radius: 6px; overflow: hidden; border: 2px solid transparent; transition: transform 0.2s, border-color 0.2s;';
                    el.innerHTML = `<img src="${url}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">`;

                    el.onclick = () => window.toggleImageBuilderSelection(mId, url, el);
                    vaultList.appendChild(el);
                });
            }
        }
    } catch (e) {
        vaultList.innerHTML = '<div class="text-danger small">Error loading images.</div>';
    }
};

window.closeImageCollectionBuilder = function () {
    const modal = document.getElementById('imageCollectionBuilderModal');
    if (modal) modal.classList.add('d-none');
    document.body.classList.remove('no-scroll');
};

window.toggleImageBuilderSelection = function (targetId, url, element) {
    const index = window.imageBuilderSelectedItems.findIndex(x => x.targetId === targetId);

    if (index === -1) {
        window.imageBuilderSelectedItems.push({ targetId, url });
        element.style.borderColor = '#0dcaf0';
        element.style.opacity = '0.5';
    } else {
        window.imageBuilderSelectedItems.splice(index, 1);
        element.style.borderColor = 'transparent';
        element.style.opacity = '1';
    }
    window.renderImageBuilderSelectedList();
};

window.renderImageBuilderSelectedList = function () {
    const container = document.getElementById('icBuilderSelectedList');
    if (!container) return;
    container.innerHTML = '';

    if (window.imageBuilderSelectedItems.length === 0) {
        container.innerHTML = '<div class="text-center text-muted mt-4 small">Click an image from your vault to add it here.</div>';
        return;
    }

    window.imageBuilderSelectedItems.forEach((item, index) => {
        const el = document.createElement('div');
        el.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: #1a1a1a; border: 1px solid #333; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px;';
        el.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="color: #666; font-weight: bold; width: 20px;">${index + 1}.</span>
                <img src="${item.url}" style="width:40px; height:40px; object-fit:cover; border-radius: 4px;">
            </div>
            <button onclick="window.removeImageBuilderSelection(${item.targetId})" style="background: #ff4d4d; border: none; color: white; border-radius: 50%; width: 24px; height: 24px; flex-shrink:0; display: flex; align-items: center; justify-content: center; cursor: pointer;"><i class="fas fa-minus"></i></button>
        `;
        container.appendChild(el);
    });
};

window.removeImageBuilderSelection = function (targetId) {
    window.imageBuilderSelectedItems = window.imageBuilderSelectedItems.filter(x => x.targetId !== targetId);
    window.renderImageBuilderSelectedList();

    const vaultList = document.getElementById('icBuilderVaultList');
    if (vaultList) {
        const items = vaultList.querySelectorAll('.builder-vault-item');
        items.forEach(el => {
            if (el.onclick.toString().includes(targetId)) {
                el.style.borderColor = 'transparent';
                el.style.opacity = '1';
            }
        });
    }
};

window.saveImageCollection = async function () {
    const titleEl = document.getElementById('icBuilderTitle');
    const title = titleEl ? titleEl.value.trim() : '';

    if (!title) return alert("Please provide a title for the Gallery.");
    if (window.imageBuilderSelectedItems.length === 0) return alert("Please select at least one image.");

    const btn = document.getElementById('icBuilderSaveBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    const itemsPayload = window.imageBuilderSelectedItems.map((item, index) => ({
        TargetId: parseInt(item.targetId),
        TargetType: 3,
        SortOrder: index
    }));

    const payload = {
        Title: title,
        Description: "Photo Gallery",
        Type: 4,
        DisplayContext: 'gallery',
        CoverImageId: 0,
        Items: itemsPayload
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
            const toggleBtn = document.getElementById('vaultFilterBtn');
            window.loadImageHub(userId, toggleBtn ? toggleBtn.classList.contains('active') : true);
        } else {
            const err = await res.text();
            alert("Failed to save gallery: " + err);
        }
    } catch (e) {
        console.error(e);
        alert("Error connecting to server.");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Publish Gallery';
        }
    }
};

// ============================================
// 8. THE CAROUSEL DOCK MANAGER (NAMESPACED FOR IMAGE HUB)
// ============================================
window.isImageCarouselManagerActive = false;
window.imageCarouselDockItems = [];

window.toggleImageCarouselManager = async function () {
    const dock = document.getElementById('imageCarouselManagerDock');
    window.isImageCarouselManagerActive = !window.isImageCarouselManagerActive;

    const btn = document.getElementById('btnToggleImageCarouselManager');

    if (window.isImageCarouselManagerActive) {
        if (dock) dock.classList.remove('d-none');

        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> <span>Close Manager</span>';
            btn.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
        }

        window.renderImageCarouselDockSlots();

        // Auto-load existing carousel into the dock if empty
        const userId = window.AuthState?.userId;
        if (userId && window.imageCarouselDockItems.length === 0) {
            try {
                const existRes = await fetch(`/api/collections/user/${userId}/context/ProfileCarousel`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
                if (existRes.ok) {
                    const collections = await existRes.json();
                    if (collections && collections.length > 0) {
                        const colId = collections[0].id || collections[0].Id;
                        const detailRes = await fetch(`/api/collections/${colId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
                        if (detailRes.ok) {
                            const details = await detailRes.json();
                            const items = details.items || details.Items || [];

                            window.imageCarouselDockItems = items.map(item => {
                                const tType = item.targetType !== undefined ? item.targetType : (item.TargetType !== undefined ? item.TargetType : 3);
                                const tId = String(item.targetId || item.TargetId);
                                let cUrl = item.coverImageUrl || item.CoverImageUrl || item.artUrl || item.ArtUrl || '/img/default_cover.jpg';

                                // FIX: Bulletproof Collection Cover Lookup for dock slots
                                if ((tType === 0 || tType === 4 || tType === '0' || tType === '4') && window.currentImageCollections) {
                                    const foundCol = window.currentImageCollections.find(c => String(c.id || c.Id) === tId);
                                    if (foundCol && (foundCol.coverImageUrl || foundCol.CoverImageUrl)) {
                                        cUrl = foundCol.coverImageUrl || foundCol.CoverImageUrl;
                                    }
                                }

                                return {
                                    id: tId,
                                    title: item.title || item.Title,
                                    imgUrl: resolveMediaUrl(cUrl),
                                    targetType: tType
                                };
                            });
                            window.renderImageCarouselDockSlots();
                        }
                    }
                }
            } catch (e) { }
        }
    } else {
        if (dock) dock.classList.add('d-none');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-star"></i> <span>Manage Carousel</span>';
            btn.style.backgroundColor = 'transparent';
        }
    }
};

window.renderImageCarouselDockSlots = function () {
    const container = document.getElementById('imageCarouselDockSlotsContainer');
    if (!container) return;
    container.innerHTML = '';

    window.imageCarouselDockItems.forEach((item) => {
        const el = document.createElement('div');
        el.style.cssText = 'width: 100px; height: 100px; position: relative; border-radius: 6px; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 8px rgba(0,0,0,0.5);';

        const typeBadge = (item.targetType === 0 || item.targetType === 4 || item.targetType === '0' || item.targetType === '4')
            ? `<div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:10px; text-align:center; padding:2px 0;"><i class="fas fa-images"></i> Gallery</div>`
            : '';

        el.innerHTML = `
            <img src="${item.imgUrl}" style="width:100%; height:100%; object-fit:cover;">
            ${typeBadge}
            <div style="position:absolute; top:0; right:0; background:rgba(220,53,69,0.9); color:white; font-size:12px; padding:2px 6px; cursor:pointer;" onclick="window.removeFromImageCarouselDock('${item.id}')"><i class="fas fa-times"></i></div>
        `;
        container.appendChild(el);
    });

    if (window.imageCarouselDockItems.length === 0) {
        container.innerHTML = '<div class="text-muted w-100 text-center" style="line-height: 100px;">Click the <i class="fas fa-star"></i> on an image or gallery to feature it here.</div>';
    }
};

// FIX: Awaiting the manager toggle stops the asynchronous loading from overwriting the first click
window.addToImageCarouselDock = async function (targetId, titleEnc, imgUrl, targetType = 3) {
    if (!window.isImageCarouselManagerActive) {
        await window.toggleImageCarouselManager();
    }

    if (window.imageCarouselDockItems.find(x => String(x.id) === String(targetId))) return;
    if (window.imageCarouselDockItems.length >= 10) { alert("Carousel limit reached."); return; }

    window.imageCarouselDockItems.push({
        id: String(targetId),
        title: decodeURIComponent(titleEnc),
        imgUrl: imgUrl,
        targetType: targetType
    });
    window.renderImageCarouselDockSlots();
};

window.removeFromImageCarouselDock = function (targetId) {
    window.imageCarouselDockItems = window.imageCarouselDockItems.filter(x => String(x.id) !== String(targetId));
    window.renderImageCarouselDockSlots();
};

window.saveImageCarouselDock = async function () {
    // Removed the empty dock blocker so user can reset their carousel
    const btn = document.getElementById('btnSaveCarouselDock');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }

    const itemsPayload = window.imageCarouselDockItems.map((item, index) => ({
        TargetId: parseInt(item.id),
        TargetType: item.targetType !== undefined ? item.targetType : 3,
        SortOrder: index
    }));

    const payload = {
        Title: "Featured Carousel",
        Description: "Featured Images & Galleries",
        Type: 10,
        DisplayContext: 'ProfileCarousel',
        CoverImageId: 0,
        Items: itemsPayload
    };

    try {
        const res = await fetch('/api/collections/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            window.toggleImageCarouselManager();
            const userId = document.getElementById('gallery-user-id').value;
            window.loadImageCarousel(userId);
        } else {
            alert("Failed to save carousel.");
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = 'Save to Profile';
        }
    }
};

// ============================================
// 9. VAULT DELETION ORCHESTRATOR
// ============================================
window.deleteVaultImage = async function (postId, mediaId) {
    if (!mediaId || mediaId === 0) {
        alert("Cannot delete: Missing media reference.");
        return;
    }

    if (!confirm("Are you sure you want to delete this image? This will remove it from your vault and social feed permanently.")) return;

    try {
        const response = await fetch(`/api/imagehub/vault/${postId}/media/${mediaId}`, {
            method: 'DELETE',
            headers: {
                'X-Session-Id': window.AuthState?.sessionId || ""
            }
        });

        if (response.ok) {
            if (typeof window.closeImageLightbox === 'function') {
                window.closeImageLightbox();
            }

            document.querySelectorAll('.msg-context-menu.active').forEach(el => el.classList.remove('active'));

            const userId = document.getElementById('gallery-user-id').value;
            const toggleBtn = document.getElementById('vaultFilterBtn');
            const unassignedOnly = toggleBtn ? toggleBtn.classList.contains('active') : true;

            window.loadImageHub(userId, unassignedOnly);
        } else {
            const errText = await response.text();
            alert("Failed to delete image: " + errText);
        }
    } catch (err) {
        console.error("Error deleting image:", err);
        alert("A network error occurred while deleting.");
    }
};

// NEW: Bridge to the global feed.js editor
window.openStandardEditorFromHub = function (postId) {
    if (!postId || postId === '0') return;

    // Close context menus
    document.querySelectorAll('.msg-context-menu.active').forEach(el => el.classList.remove('active'));

    // Hand off directly to the existing FeedService (Removes the 404 fetch error)
    if (window.FeedService && typeof window.FeedService.openEditModal === 'function') {
        window.FeedService.openEditModal(postId);
    } else {
        console.warn("FeedService.openEditModal not found. Make sure feed.js is loaded.");
        alert("Global post editor not available on this page.");
    }
};