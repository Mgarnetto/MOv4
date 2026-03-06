/* ============================================
   VIDEO HUB: JAVASCRIPT ENGINE
   Handles Carousels, Grids, and the Video Inspector
   ============================================ */

// ============================================
// 1. CAROUSEL MANAGER (DOCK TOGGLE)
// ============================================
window.isVideoCarouselManagerActive = false;

window.toggleVideoCarouselManager = function () {
    window.isVideoCarouselManagerActive = !window.isVideoCarouselManagerActive;
    const btn = document.getElementById('btnToggleVideoCarouselManager');
    const dock = document.getElementById('videoCarouselManagerDock');

    // Adjust main wrapper so content isn't hidden behind the dock
    const mainContainer = document.querySelector('.video-container');

    if (window.isVideoCarouselManagerActive) {
        if (btn) btn.innerHTML = '<i class="fas fa-check"></i> <span>Close Manager</span>';
        if (dock) dock.classList.remove('d-none');
        if (mainContainer) mainContainer.style.paddingBottom = '280px';
    } else {
        if (btn) btn.innerHTML = '<i class="fas fa-star"></i> <span>Manage Carousel</span>';
        if (dock) dock.classList.add('d-none');
        if (mainContainer) mainContainer.style.paddingBottom = '20px';
    }
};

// ============================================
// 2. MASTER LOADER
// ============================================
window.loadVideoHub = async function (userId) {
    const isOwner = document.getElementById('video-is-owner')?.value === 'true';
    const headers = { "X-Session-Id": window.AuthState?.sessionId || "" };

    if (isOwner) {
        window.initVideoCarouselDock();
    }

    try {
        // 1. Fetch All Videos (Using our optimized Integer endpoint: ContextType 1 = User, MediaType 2 = Video)
        const gridRes = await fetch(`/api/posts?contextType=1&contextId=${userId}&page=1&mediaType=2`, { headers });
        if (gridRes.ok) {
            const posts = await gridRes.json();
            renderVideoGrid(posts, isOwner);
        }

        // 2. Trigger the Visual Carousel Renderer
        window.loadVideoCarousel(userId);

        // 3. Populate Dock if Owner
        if (isOwner) {
            const existRes = await fetch(`/api/collections/user/${userId}/context/VideoCarousel`, { headers });
            if (existRes.ok) {
                const collections = await existRes.json();
                if (collections && collections.length > 0) {
                    const colId = collections[0].id || collections[0].Id;
                    document.getElementById('videoCarouselCollectionId').value = colId;

                    const detailRes = await fetch(`/api/collections/${colId}`, { headers });
                    if (detailRes.ok) {
                        const details = await detailRes.json();
                        const items = details.items || details.Items || [];
                        items.forEach(item => {
                            const art = item.artUrl || item.ArtUrl || '/img/default_cover.jpg';
                            const targetId = item.targetId || item.TargetId;
                            const title = item.title || item.Title || "Untitled";
                            window.addToVideoCarouselDock(targetId, title, art, true);
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error loading Video Hub data:", err);
    }
};

// ============================================
// 3. RENDERERS (CAROUSEL & GRID)
// ============================================
window.loadVideoCarousel = async function (userId) {
    const container = document.getElementById('video-carousel-container');
    if (!container) return;

    try {
        const headers = { "X-Session-Id": window.AuthState?.sessionId || "" };
        const existRes = await fetch(`/api/collections/user/${userId}/context/VideoCarousel`, { headers });
        let customItems = [];

        if (existRes.ok) {
            const collections = await existRes.json();
            if (collections && collections.length > 0) {
                const collectionId = collections[0].id || collections[0].Id;
                const detailRes = await fetch(`/api/collections/${collectionId}`, { headers });
                if (detailRes.ok) {
                    const details = await detailRes.json();
                    customItems = details.items || details.Items || [];
                }
            }
        }

        if (customItems.length > 0) {
            renderVideoCarouselUI(customItems, false);
        } else {
            // Fallback: Just grab the latest 5 videos from the posts table
            const fallbackRes = await fetch(`/api/posts?contextType=1&contextId=${userId}&page=1&mediaType=2`, { headers });
            if (fallbackRes.ok) {
                const posts = await fallbackRes.json();
                if (posts.length > 0) {
                    renderVideoCarouselUI(posts.slice(0, 5), true);
                } else {
                    container.innerHTML = '<div class="text-muted text-center p-4">No featured videos yet.</div>';
                }
            }
        }
    } catch (err) {
        container.innerHTML = '';
    }
};

function renderVideoCarouselUI(items, isFallback) {
    const container = document.getElementById('video-carousel-container');
    if (!container) return;

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px;">
            <h4 style="color:white; margin: 0; font-weight: 700;">${isFallback ? 'Recent Videos' : 'Featured Premieres'}</h4>
            <div style="display: flex; gap: 10px;">
                <button onclick="document.getElementById('video-carousel-track').scrollBy({left: -320, behavior: 'smooth'})" style="background: #1a1a1a; border: 1px solid #333; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fas fa-chevron-left"></i></button>
                <button onclick="document.getElementById('video-carousel-track').scrollBy({left: 320, behavior: 'smooth'})" style="background: #1a1a1a; border: 1px solid #333; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
        <div id="video-carousel-track" style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 15px; scrollbar-width: none; scroll-behavior: smooth;">
    `;

    items.forEach(item => {
        const pId = item.targetId || item.TargetId || item.id || item.Id;
        const title = item.title || item.Title || "Untitled Video";

        // Handle image extraction depending on if it's a CollectionItem or a PostDto
        let art = '/img/default_cover.jpg';
        if (item.artUrl || item.ArtUrl) {
            art = item.artUrl || item.ArtUrl;
        } else if (item.attachments || item.Attachments) {
            const att = item.attachments || item.Attachments;
            const vidAtt = att.find(a => a.mediaType === 2 || a.MediaType === 2);
            if (vidAtt && (vidAtt.snippetPath || vidAtt.SnippetPath)) {
                art = (vidAtt.snippetPath || vidAtt.SnippetPath).replace(/\\/g, '/');
                if (art === "null") art = '/img/default_cover.jpg';
            }
        }

        html += `
            <div style="flex: 0 0 300px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; overflow: hidden; position: relative; cursor: pointer; transition: transform 0.2s;" 
                 onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'"
                 onclick="window.openCinemaMode('${pId}')">
                
                <div style="position: relative; width: 100%; aspect-ratio: 16/9;">
                    <img src="${art}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                        <i class="fas fa-play-circle" style="color: white; font-size: 4rem; text-shadow: 0 2px 5px rgba(0,0,0,0.8);"></i>
                    </div>
                </div>
                <div style="padding: 12px;">
                    <div style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title.replace(/"/g, '&quot;')}">${title}</div>
                </div>
            </div>
        `;
    });

    html += `</div><style>#video-carousel-track::-webkit-scrollbar { display: none; }</style>`;
    container.innerHTML = html;
}

function renderVideoGrid(posts, isOwner) {
    const container = document.getElementById('video-hub-container');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 2rem; grid-column: 1 / -1;">No videos uploaded yet.</div>';
        return;
    }

    container.innerHTML = '';

    posts.forEach(post => {
        const pId = post.id !== undefined ? post.id : post.Id;
        const title = post.title || post.Title || 'Untitled Video';
        const desc = post.text || post.Text || '';
        const price = post.price !== undefined ? post.price : post.Price;
        const isLocked = false; // We can integrate a lock check later based on purchase state

        const attachments = post.attachments || post.Attachments || [];
        const vidAttach = attachments.find(a => (a.mediaType || a.MediaType) === 2);

        let sPath = vidAttach ? (vidAttach.snippetPath || vidAttach.SnippetPath) : null;
        const thumbSrc = (sPath && sPath !== "null") ? sPath.replace(/\\/g, '/') : '/img/default_cover.jpg';
        const createdAgo = post.createdAgo || post.CreatedAgo || 'Recently';

        const priceBadge = price > 0 ? `<span style="position: absolute; top: 10px; left: 10px; background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; z-index: 2;">$${price.toFixed(2)}</span>` : '';

        let html = `
            <div class="vid-card">
                ${priceBadge}
                <div class="vid-thumb-wrapper" onclick="window.openCinemaMode('${pId}')">
                    <img src="${thumbSrc}" class="vid-thumb-img">
                    <div class="vid-play-overlay"><i class="fas fa-play-circle" style="color: white; font-size: 3rem;"></i></div>
                </div>
                <div style="padding: 12px; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="overflow: hidden; padding-right: 10px;">
                        <div style="color: white; font-weight: bold; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title.replace(/"/g, '&quot;')}">${title}</div>
                        <div style="color: #888; font-size: 0.85rem; margin-top: 4px;"><i class="far fa-clock me-1"></i> ${createdAgo}</div>
                    </div>
                    
                    ${isOwner ? `
                    <div style="position: relative; display: flex; align-items: center; gap: 8px;">
                        <button style="background: transparent; border: 1px solid #0dcaf0; color: #0dcaf0; border-radius: 4px; width: 30px; height: 30px; padding: 0; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: center;" 
                                onmouseover="this.style.background='rgba(13, 202, 240, 0.1)'" onmouseout="this.style.background='transparent'" 
                                onclick="event.stopPropagation(); window.addToVideoCarouselDock(${pId}, decodeURIComponent('${encodeURIComponent(title)}'), '${thumbSrc}')" title="Add to Carousel">
                            <i class="fas fa-star" style="font-size: 0.8rem;"></i>
                        </button>
                        
                        <button class="msg-options-btn" style="background: transparent; border: none; color: #ccc; width: 30px; height: 30px; padding: 0; cursor: pointer; transition: color 0.2s;" 
                                onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#ccc'" 
                                onclick="event.stopPropagation(); toggleVideoMenu('vid-menu-${pId}')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        
                        <div id="vid-menu-${pId}" class="msg-context-menu" style="position: absolute; right: 0; top: 100%; margin-top: 5px; width: 150px; text-align: left; z-index: 1050; background: #222; border: 1px solid #444; border-radius: 6px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); display: none;">
                            <button onclick="event.stopPropagation(); window.openVideoInspector('${pId}', decodeURIComponent('${encodeURIComponent(title)}'), decodeURIComponent('${encodeURIComponent(desc)}'), ${price || 0}, 0, ${isLocked}, '${thumbSrc}')" 
                                    style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #fff; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-edit"></i> Edit Video
                            </button>
                            <button class="text-danger track-delete-btn" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #ff0055; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 10px;" 
                                    onclick="event.stopPropagation(); window.twoStepDeleteVideo(this, '${pId}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// ============================================
// 4. CAROUSEL DOCK LOGIC
// ============================================
window.initVideoCarouselDock = function () {
    const container = document.getElementById('videoCarouselDockSlotsContainer');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 5; i++) { // Videos usually cap at 5 for featured
        container.innerHTML += `
            <div class="vid-carousel-slot empty-slot" data-slot-index="${i}">
                <i class="fas fa-plus fa-2x" style="margin-bottom: 8px;"></i>
                <span style="font-size: 0.8rem; font-weight: 600;">Empty Slot</span>
            </div>
        `;
    }
};

window.addToVideoCarouselDock = function (targetId, title, artUrl, isInitLoad = false) {
    const container = document.getElementById('videoCarouselDockSlotsContainer');
    if (!container) return;

    if (container.querySelector(`[data-target-id="${targetId}"]`)) {
        if (!isInitLoad) alert("This video is already in your carousel!");
        return;
    }

    const emptySlot = container.querySelector('.empty-slot');
    if (!emptySlot) {
        if (!isInitLoad) alert("Your carousel is full! Remove a video to make space.");
        return;
    }

    const safeTitle = title.replace(/'/g, "&#39;").replace(/"/g, "&quot;");

    emptySlot.classList.remove('empty-slot');
    emptySlot.classList.add('filled-slot');
    emptySlot.dataset.targetId = targetId;

    emptySlot.innerHTML = `
        <div class="vid-slot-art" style="background-image: url('${artUrl || '/img/default_cover.jpg'}');"></div>
        <div style="z-index: 2; text-align: center; width: 100%; padding: 0 10px;">
            <div class="text-truncate" style="color: white; font-weight: bold; font-size: 0.9rem; text-shadow: 0 2px 4px rgba(0,0,0,0.8);" title="${safeTitle}">${safeTitle}</div>
        </div>
        <button onclick="window.removeVideoCarouselSlot(this)" style="position: absolute; top: -10px; right: -10px; background: #ff4d4d; color: white; border: 2px solid #111; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;">
            <i class="fas fa-times"></i>
        </button>
    `;

    if (!isInitLoad && !window.isVideoCarouselManagerActive) {
        window.toggleVideoCarouselManager();
    }
};

window.removeVideoCarouselSlot = function (btn) {
    const slot = btn.parentElement;
    slot.classList.remove('filled-slot');
    slot.classList.add('empty-slot');
    delete slot.dataset.targetId;

    slot.innerHTML = `
        <i class="fas fa-plus fa-2x" style="margin-bottom: 8px;"></i>
        <span style="font-size: 0.8rem; font-weight: 600;">Empty Slot</span>
    `;
    slot.parentElement.appendChild(slot); // Move to back of line
};

window.saveVideoCarouselDock = async function () {
    const btn = document.querySelector('#videoCarouselManagerDock .btn-dock-save');
    if (btn) { btn.innerText = "Saving..."; btn.disabled = true; }

    const slots = document.querySelectorAll('#videoCarouselDockSlotsContainer .filled-slot');
    const itemsToSave = [];

    slots.forEach((slot, index) => {
        itemsToSave.push({
            TargetId: parseInt(slot.dataset.targetId),
            TargetType: 2, // 2 = Video Media
            SortOrder: index
        });
    });

    const payload = {
        Title: "Featured Videos",
        Description: "My featured premieres",
        Type: 8, // 8 = Video Carousel
        DisplayContext: "VideoCarousel",
        CoverImageId: 0,
        Items: itemsToSave
    };

    try {
        const response = await fetch('/api/collections/create', {
            method: 'POST',
            headers: { "Content-Type": "application/json", "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            document.getElementById('videoCarouselCollectionId').value = result.id;

            if (btn) {
                btn.innerText = "Saved!";
                btn.style.background = "#28a745";

                const userId = document.getElementById("video-user-id")?.value || window.AuthState?.userId;
                if (userId) window.loadVideoCarousel(userId);

                setTimeout(() => {
                    btn.innerText = "Save to Profile";
                    btn.style.background = "linear-gradient(135deg, #00d2ff, #007bff)";
                    btn.disabled = false;
                    window.toggleVideoCarouselManager();
                }, 1000);
            }
        } else {
            alert("Error saving carousel.");
            if (btn) { btn.innerText = "Save to Profile"; btn.disabled = false; }
        }
    } catch (e) {
        console.error(e);
        if (btn) { btn.innerText = "Save to Profile"; btn.disabled = false; }
    }
};

// ============================================
// 5. THE VIDEO INSPECTOR
// ============================================
window.openVideoInspector = function (postId, title, desc, price, visibility, isLocked, coverUrl) {
    const sidebar = document.getElementById('video-inspector-sidebar');
    if (!sidebar) return;

    window.inspectorVideoCoverFile = null;
    const coverInput = document.getElementById('vid-edit-cover-input');
    if (coverInput) coverInput.value = '';
    const coverPreview = document.getElementById('vid-edit-cover-preview');
    if (coverPreview) coverPreview.src = coverUrl || '/img/default_cover.jpg';

    document.getElementById('vid-edit-target-id').value = postId;
    document.getElementById('vid-edit-title').value = title;
    document.getElementById('vid-edit-desc').value = desc;
    document.getElementById('vid-edit-price').value = price > 0 ? price.toFixed(2) : '';
    document.getElementById('vid-edit-visibility').value = visibility || 0;

    const lockWarning = document.getElementById('vid-inspector-lock-warning');
    const titleInput = document.getElementById('vid-edit-title');
    const coverWrapper = document.getElementById('vid-edit-cover-wrapper');

    if (isLocked) {
        if (lockWarning) lockWarning.classList.remove('d-none');
        titleInput.disabled = true; titleInput.style.opacity = '0.5';
        if (coverWrapper) { coverWrapper.classList.add('locked'); coverWrapper.style.pointerEvents = 'none'; coverWrapper.style.opacity = '0.5'; }
    } else {
        if (lockWarning) lockWarning.classList.add('d-none');
        titleInput.disabled = false; titleInput.style.opacity = '1';
        if (coverWrapper) { coverWrapper.classList.remove('locked'); coverWrapper.style.pointerEvents = 'auto'; coverWrapper.style.opacity = '1'; }
    }

    sidebar.classList.remove('closed');
};

window.closeVideoInspector = function () {
    const sidebar = document.getElementById('video-inspector-sidebar');
    if (sidebar) sidebar.classList.add('closed');
};

window.previewVideoInspectorCover = function (input) {
    if (input.files && input.files[0]) {
        window.inspectorVideoCoverFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('vid-edit-cover-preview');
            if (preview) preview.src = e.target.result;
        }
        reader.readAsDataURL(input.files[0]);
    }
};

window.saveVideoInspector = async function () {
    const btn = document.querySelector('#video-inspector-sidebar .btn-dock-save');
    const originalText = btn.innerText;
    btn.disabled = true;

    const postId = document.getElementById('vid-edit-target-id').value;

    try {
        let newThumbBlob = null;

        // Note: For full thumbnail extraction mapping onto the post table, we typically process this in C# via `UpdatePostDto`.
        // For Phase 2, we will update the text data using the optimized Post Controller we fixed earlier.
        btn.innerText = "Saving Metadata...";

        const payload = {
            Title: document.getElementById('vid-edit-title').value,
            Text: document.getElementById('vid-edit-desc').value,
            Price: parseFloat(document.getElementById('vid-edit-price').value) || null
        };

        const response = await fetch(`/api/posts/${postId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                "X-Session-Id": window.AuthState?.sessionId || ""
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            btn.innerText = "Saved!";
            btn.style.background = "#28a745";

            const userId = document.getElementById("video-user-id").value;
            window.loadVideoHub(userId);

            setTimeout(() => {
                window.closeVideoInspector();
                btn.innerText = originalText;
                btn.style.background = "linear-gradient(135deg, #00d2ff, #007bff)";
                btn.disabled = false;
            }, 1000);
        } else {
            alert("Failed to save changes.");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (e) {
        console.error("Error saving inspector:", e);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// ============================================
// 6. UTILITIES (MENU & CINEMA BRIDGE)
// ============================================
window.toggleVideoMenu = function (menuId) {
    const menu = document.getElementById(menuId);
    document.querySelectorAll('.msg-context-menu').forEach(m => {
        if (m.id !== menuId) m.style.display = 'none';
    });
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
};

document.addEventListener('click', function (e) {
    if (!e.target.closest('.msg-options-btn') && !e.target.closest('.msg-context-menu')) {
        document.querySelectorAll('.msg-context-menu').forEach(m => m.style.display = 'none');
    }
});

window.twoStepDeleteVideo = async function (btnElement, postId) {
    if (window.event) window.event.stopPropagation();

    if (!btnElement.classList.contains('confirming-delete')) {
        btnElement.classList.add('confirming-delete');
        btnElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Confirm?`;
        btnElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

        setTimeout(() => {
            if (btnElement) {
                btnElement.classList.remove('confirming-delete');
                btnElement.innerHTML = `<i class="fas fa-trash"></i> Delete`;
                btnElement.style.backgroundColor = 'transparent';
            }
        }, 4000);
        return;
    }

    btnElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;
    btnElement.disabled = true;

    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (response.ok) {
            const userId = document.getElementById("video-user-id")?.value || window.AuthState?.userId;
            if (userId) window.loadVideoHub(userId);
        } else {
            alert("Delete failed.");
            btnElement.disabled = false;
        }
    } catch (e) {
        console.error("Error deleting video:", e);
        btnElement.disabled = false;
    }
};

// TEMPORARY BRIDGE: Maps Cinema Mode clicks to the existing Post Modal until Phase 3 is implemented.
window.openCinemaMode = function (postId) {
    if (window.FeedService && window.FeedService.openPostModal) {
        window.FeedService.openPostModal(postId);
    } else {
        console.warn("FeedService not found. Cannot open post modal.");
    }
};