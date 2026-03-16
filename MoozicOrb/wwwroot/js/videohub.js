/* ============================================
   VIDEO HUB v2.0: JAVASCRIPT ENGINE
   Handles Cinematic Grid, Drag & Drop, Collections, Carousel, & Comments
   ============================================ */

window.currentVaultVideos = [];
window.collectionBuilderItems = [];
window.inspectorVideoCoverFile = null;

// ============================================
// 1. MASTER LOADER
// ============================================
window.loadVideoHub = async function (userId) {
    const isOwnerInput = document.getElementById('video-is-owner');
    const isOwner = isOwnerInput ? (isOwnerInput.value.toLowerCase() === 'true') : false;

    try {
        const vaultRes = await fetch(`/api/videohub/vault/${userId}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (vaultRes.ok) {
            window.currentVaultVideos = await vaultRes.json();
            renderVaultGrid(window.currentVaultVideos, isOwner);
        }

        const colRes = await fetch(`/api/videohub/collections/${userId}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (colRes.ok) {
            const collections = await colRes.json();
            renderCollectionsGrid(collections, isOwner);
        }

    } catch (err) {
        console.error("Error loading Video Hub data:", err);
    }
};

// ============================================
// 2. GRID RENDERERS & COLLECTION VIEWER
// ============================================
function renderVaultGrid(posts, isOwner) {
    const header = document.getElementById('video-grid-header');
    if (header) header.style.display = 'block';

    const container = document.getElementById('video-hub-container');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: #888; padding: 2rem; grid-column: 1 / -1;">No videos in vault.</div>';
        return;
    }

    container.innerHTML = '';

    posts.forEach(post => {
        const pId = post.id !== undefined ? post.id : post.Id;
        const title = post.title || post.Title || 'Untitled Video';
        const price = post.price !== undefined ? post.price : post.Price;
        const vis = post.visibility !== undefined ? post.visibility : (post.Visibility || 0);

        const attachments = post.attachments || post.Attachments || [];
        const vidAttach = attachments.find(a => (a.mediaType || a.MediaType) === 2);

        const vidUrl = vidAttach ? (vidAttach.url || vidAttach.Url) : '';
        const sPath = vidAttach ? (vidAttach.snippetPath || vidAttach.SnippetPath) : null;
        const thumbSrc = (sPath && sPath !== "null") ? sPath.replace(/\\/g, '/') : '/img/default_cover.jpg';

        // --- ADDED EXTRACT MEDIA ID ---
        const mediaId = vidAttach ? (vidAttach.mediaId || vidAttach.MediaId) : 0;

        const likes = post.likesCount || 0;
        const comments = post.commentsCount || 0;
        const isLiked = post.isLiked === true;

        let visIcon = '';
        if (vis === 1) visIcon = '<i class="fas fa-link text-warning position-absolute" style="top:10px; left:10px; z-index:10;"></i>';
        if (vis === 2) visIcon = '<i class="fas fa-lock text-danger position-absolute" style="top:10px; left:10px; z-index:10;"></i>';

        const priceBadge = price > 0 ? `<span style="position: absolute; top: 10px; left: ${vis > 0 ? '35px' : '10px'}; background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; z-index: 10;">$${price.toFixed(2)}</span>` : '';

        const safeTitle = encodeURIComponent(title);
        const safeDesc = encodeURIComponent(post.text || '');
        const safeVidUrl = encodeURIComponent(vidUrl);

        let html = `
            <div class="vid-card">
                ${visIcon}
                ${priceBadge}

                <div class="vid-thumb-wrapper" onclick="window.openCinemaModal('${pId}', '${safeVidUrl}', '${safeTitle}', '${safeDesc}')">
                    <img src="${thumbSrc}" class="vid-thumb-img">
                    <div class="vid-play-overlay"><i class="fas fa-play-circle" style="color: white; font-size: 3rem;"></i></div>
                    
                    ${isOwner ? `
                    <div class="vid-top-right-actions">
                        <div class="vid-action-circle" onclick="event.stopPropagation(); window.addToVideoCarouselDock('${mediaId}', '${safeTitle}', '${thumbSrc}')" title="Feature Video"><i class="fas fa-star" style="font-size:0.8rem;"></i></div>
                        <div class="vid-action-circle position-relative" onclick="event.stopPropagation(); this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <i class="fas fa-ellipsis-v"></i>
                        </div>
                        <div class="msg-context-menu" style="position: absolute; right: 0; top: 100%; width: 150px; z-index: 1050; background: #222; border: 1px solid #444; border-radius: 6px; display: none;">
                            <button onclick="event.stopPropagation(); window.openVideoInspector('${pId}', '${safeTitle}', '${safeDesc}', ${price || 0}, ${vis}, '${thumbSrc}', 2)" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-edit"></i> Edit Video</button>
                            <button class="text-danger" onclick="event.stopPropagation(); window.twoStepDeleteVideo(this, '${pId}')" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                    ` : ''}

                    <div style="position: absolute; bottom: 35px; left: 10px; right: 10px; color: white; font-weight: bold; font-size: 0.95rem; text-shadow: 0 2px 4px rgba(0,0,0,0.9); z-index: 5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${title}
                    </div>

                    <div class="vid-actions-overlay">
                        <button class="vid-btn-translucent" onclick="event.stopPropagation(); window.toggleGridLike(this, '${pId}')">
                            <i class="${isLiked ? 'fas text-danger' : 'far'} fa-heart"></i> <span>${likes}</span>
                        </button>
                        <button class="vid-btn-translucent" onclick="event.stopPropagation(); window.openCinemaModal('${pId}', '${safeVidUrl}', '${safeTitle}', '${safeDesc}')">
                            <i class="fas fa-comment"></i> ${comments}
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function renderCollectionsGrid(collections, isOwner) {
    const container = document.getElementById('video-collections-container');
    if (!container) return;

    const visibleCollections = collections.filter(c => c.displayContext !== 'video' && c.DisplayContext !== 'video');

    if (visibleCollections.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = `<h4 style="color:white; border-bottom:1px solid #333; padding-bottom:10px; margin-top:30px;">Video Collections</h4>
                <div class="video-hub-grid" style="margin-top: 15px;">`;

    visibleCollections.forEach(col => {
        const art = col.coverImageUrl || '/img/default_cover.jpg';
        const title = col.title || "Untitled Collection";
        const price = col.price || 0;
        const vis = col.visibility || 0;
        const safeTitle = encodeURIComponent(title);
        const safeDesc = encodeURIComponent(col.description || '');

        html += `
            <div class="vid-card">
                <div class="vid-thumb-wrapper" onclick="window.viewVideoCollection('${col.id}', '${safeTitle}')">
                    <img src="${art}" class="vid-thumb-img" style="opacity: 0.5;">
                    <div class="vid-play-overlay"><i class="fas fa-layer-group" style="color: white; font-size: 3rem;"></i></div>
                    
                    ${isOwner ? `
                    <div class="vid-top-right-actions">
                        <div class="vid-action-circle" onclick="event.stopPropagation(); window.addToVideoCarouselDock('${col.id}', '${safeTitle}', '${art}')" title="Feature Collection"><i class="fas fa-star" style="font-size:0.8rem;"></i></div>
                        <div class="vid-action-circle position-relative" onclick="event.stopPropagation(); this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <i class="fas fa-ellipsis-v"></i>
                        </div>
                        <div class="msg-context-menu" style="position: absolute; right: 0; top: 100%; width: 170px; z-index: 1050; background: #222; border: 1px solid #444; border-radius: 6px; display: none;">
                            <button onclick="event.stopPropagation(); window.openVideoInspector('${col.id}', '${safeTitle}', '${safeDesc}', ${price}, ${vis}, '${art}', 0)" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-edit"></i> Edit Collection</button>
                            <button class="text-danger" onclick="event.stopPropagation(); window.twoStepDeleteCollection(this, '${col.id}')" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                    ` : ''}

                    <div style="position: absolute; bottom: 10px; left: 10px; right: 10px; color: white; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.9); z-index: 5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${title}
                    </div>
                </div>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

window.viewVideoCollection = async function (collectionId, title) {
    const header = document.getElementById('video-grid-header');
    if (header) header.style.display = 'none';

    const container = document.getElementById('video-hub-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-4 text-muted" style="grid-column: 1 / -1;"><i class="fas fa-spinner fa-spin fa-2x"></i></div>';
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
        const res = await fetch(`/api/collections/${collectionId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        if (res.ok) {
            const data = await res.json();
            const items = data.items || data.Items || [];

            let html = `
                <div style="grid-column: 1 / -1; display: flex; align-items: center; gap: 15px; margin-bottom: 20px; background: #111; padding: 15px; border-radius: 8px; border: 1px solid #333;">
                    <button onclick="const uid = document.getElementById('video-user-id').value; window.loadVideoHub(uid);" style="background: #222; color: white; border: 1px solid #444; padding: 8px 15px; border-radius: 6px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#333'" onmouseout="this.style.background='#222'">
                        <i class="fas fa-arrow-left me-2"></i> Back to Vault
                    </button>
                    <h3 style="margin: 0; color: #0dcaf0; font-weight: 800;">${decodeURIComponent(title)}</h3>
                </div>`;

            if (items.length === 0) {
                html += `<div style="grid-column: 1 / -1; text-align: center; color: #888; padding: 2rem; background: #111; border-radius: 8px; border: 1px dashed #333;">No videos in this collection yet.</div>`;
            } else {
                items.forEach((item) => {
                    const safeTitle = encodeURIComponent(item.title || item.Title);
                    const safeUrl = encodeURIComponent(item.url || item.Url);
                    let thumbSrc = item.artUrl || item.ArtUrl || '/img/default_cover.jpg';
                    thumbSrc = thumbSrc.replace(/\\/g, '/');

                    const activePostId = item.postId || item.PostId || item.targetId;

                    html += `
                        <div class="vid-card">
                            <div class="vid-thumb-wrapper" onclick="window.openCinemaModal('${activePostId}', '${safeUrl}', '${safeTitle}', '')">
                                <img src="${thumbSrc}" class="vid-thumb-img">
                                <div class="vid-play-overlay"><i class="fas fa-play-circle" style="color: white; font-size: 3rem;"></i></div>
                                
                                <div style="position: absolute; bottom: 10px; left: 10px; right: 10px; color: white; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.9); z-index: 5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${item.title || item.Title}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            container.innerHTML = html;
        }
    } catch (e) {
        container.innerHTML = '<div class="text-danger p-3" style="grid-column: 1 / -1;">Failed to load collection episodes.</div>';
    }
};

// ============================================
// 3. BATCH DRAG & DROP UPLOAD
// ============================================
window.toggleVideoDropZone = function () {
    const wrapper = document.getElementById('videoDropZoneWrapper');
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

window.handleVideoDrop = function (e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = '#444';
    e.currentTarget.style.background = '#111';

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const input = document.getElementById('videoBatchUploadInput');
        input.files = e.dataTransfer.files;
        window.handleBatchVideoUpload(input);
    }
};

window.handleBatchVideoUpload = async function (input) {
    if (!input.files || input.files.length === 0) return;
    const userId = document.getElementById('video-user-id')?.value;
    if (!userId) return;

    const files = Array.from(input.files);
    input.value = '';

    const dropZone = document.getElementById('videoDropZoneContent');
    const originalDropHtml = dropZone ? dropZone.innerHTML : '';

    if (dropZone) {
        dropZone.innerHTML = `<i class="fas fa-spinner fa-spin fa-3x text-info mb-3"></i><h4 style="color: white;">Processing ${files.length} Video(s)...</h4>`;
    }

    for (let i = 0; i < files.length; i++) {
        let file = files[i];

        try {
            const meta = await window.processVideoUpload(file);
            const uploadData = new FormData();
            uploadData.append("file", file);
            if (meta.thumbnailBlob) uploadData.append("thumbnail", meta.thumbnailBlob, "thumbnail.jpg");
            uploadData.append("duration", meta.duration);

            const uploadRes = await fetch("/api/upload/video", {
                method: 'POST',
                headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                body: uploadData
            });

            if (!uploadRes.ok) throw new Error("File upload failed");
            const mediaResult = await uploadRes.json();

            const payload = {
                ContextType: 1, ContextId: parseInt(userId),
                Type: 6,
                Visibility: 2, // Private
                Title: file.name.split('.')[0],
                MediaAttachments: [{
                    MediaId: mediaResult.id,
                    MediaType: 2,
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

    if (dropZone) dropZone.innerHTML = originalDropHtml;
    window.toggleVideoDropZone();
    window.loadVideoHub(userId);
};

// ============================================
// 4. VIDEO INSPECTOR
// ============================================
window.switchVidInspectorTab = function (tabName) {
    document.querySelectorAll('#video-inspector-sidebar .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('#video-inspector-sidebar .tab-content').forEach(content => {
        content.classList.remove('active');
        content.classList.add('d-none');
    });

    const activeTab = document.getElementById(`tab-vid-${tabName}`);
    if (activeTab) activeTab.classList.add('active');

    const activeContent = document.getElementById(`vid-tab-content-${tabName}`);
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.classList.remove('d-none');
    }
};

window.openVideoInspector = async function (id, titleEnc, descEnc, price, visibility, coverUrl, targetType = 2) {
    const sidebar = document.getElementById('video-inspector-sidebar');
    if (!sidebar) return;

    window.inspectorVideoCoverFile = null;
    const coverInput = document.getElementById('vid-edit-cover-input');
    if (coverInput) coverInput.value = '';

    document.getElementById('vid-edit-cover-preview').src = coverUrl || '/img/default_cover.jpg';
    document.getElementById('vid-edit-target-id').value = id;
    document.getElementById('vid-edit-target-type').value = targetType;
    document.getElementById('vid-edit-title').value = decodeURIComponent(titleEnc);
    document.getElementById('vid-edit-desc').value = decodeURIComponent(descEnc);
    document.getElementById('vid-edit-price').value = price > 0 ? price.toFixed(2) : '';
    document.getElementById('vid-edit-visibility').value = visibility || 0;

    const episodesTab = document.getElementById('tab-vid-episodes');

    if (targetType === 0 || targetType === '0') {
        document.getElementById('vid-inspector-header-title').innerText = "Edit Collection";
        if (episodesTab) episodesTab.classList.remove('d-none');
        window.loadInspectorEpisodeList(id);
    } else {
        document.getElementById('vid-inspector-header-title').innerText = "Edit Video";
        if (episodesTab) episodesTab.classList.add('d-none');
    }

    window.switchVidInspectorTab('details');
    sidebar.classList.remove('closed');
};

window.closeVideoInspector = function () {
    const sidebar = document.getElementById('video-inspector-sidebar');
    if (sidebar) sidebar.classList.add('closed');
};

window.previewVideoInspectorCover = function (input) {
    if (input.files && input.files[0]) {
        window.inspectorVideoCoverFile = input.files[0];
        document.getElementById('vid-edit-cover-preview').src = URL.createObjectURL(input.files[0]);
    }
};

// --- EPISODE LIST LOGIC (Instant API Triggers) ---
window.inspectorSeriesEpisodes = [];
window.inspectorVaultVideos = [];

window.loadInspectorEpisodeList = async function (collectionId) {
    const episodeContainer = document.getElementById('inspector-series-episodes-container');
    const vaultContainer = document.getElementById('inspector-vault-videos-container');

    if (episodeContainer) episodeContainer.innerHTML = '<div class="text-center text-muted" style="margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    if (vaultContainer) vaultContainer.innerHTML = '';

    try {
        const colRes = await fetch(`/api/collections/${collectionId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        let currentEpisodes = [];
        if (colRes.ok) {
            const data = await colRes.json();
            currentEpisodes = data.items || data.Items || [];
        }
        window.inspectorSeriesEpisodes = currentEpisodes;

        const existingMediaIds = currentEpisodes.map(t => String(t.targetId || t.TargetId));

        window.inspectorVaultVideos = window.currentVaultVideos.filter(t => {
            const att = t.attachments || t.Attachments || [];
            const vid = att.find(a => (a.mediaType || a.MediaType) === 2);
            const mId = vid ? String(vid.mediaId || vid.MediaId) : "0";
            return !existingMediaIds.includes(mId);
        });

        window.renderInspectorEpisodeList(collectionId);
    } catch (e) { console.error("Error loading inspector episodes", e); }
};

window.renderInspectorEpisodeList = function (collectionId) {
    const episodeContainer = document.getElementById('inspector-series-episodes-container');
    const vaultContainer = document.getElementById('inspector-vault-videos-container');

    if (episodeContainer) {
        let eHtml = '';
        if (window.inspectorSeriesEpisodes.length === 0) {
            eHtml = '<div class="text-center p-4 text-muted small">No episodes in this collection.</div>';
        } else {
            window.inspectorSeriesEpisodes.forEach((track, i) => {
                const title = track.title || track.Title || "Untitled";
                const linkId = track.linkId || track.LinkId;
                eHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: #1a1a1a; padding: 10px; border-radius: 6px; border: 1px solid #333; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex-grow: 1;">
                            <span style="color: #555; font-weight: 900; font-size: 0.75rem; width: 15px; text-align: right;">${i + 1}.</span>
                            <span style="color: #eee; font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                        </div>
                        <button onclick="window.inspectorRemoveEpisode(this, ${linkId}, ${collectionId})" style="background: transparent; border: 1px solid #ff4d4d; border-radius: 4px; color: #ff4d4d; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: 0.2s;" onmouseover="this.style.background='rgba(255,77,77,0.1)'" onmouseout="this.style.background='transparent'"><i class="fas fa-minus" style="font-size: 10px;"></i></button>
                    </div>
                `;
            });
        }
        episodeContainer.innerHTML = eHtml;
    }

    if (vaultContainer) {
        let vHtml = '';
        if (window.inspectorVaultVideos.length === 0) {
            vHtml = '<div class="text-center p-4 text-muted small">No available videos in vault.</div>';
        } else {
            window.inspectorVaultVideos.forEach(track => {
                const title = track.title || track.Title || "Untitled";

                const att = track.attachments || track.Attachments || [];
                const vid = att.find(a => (a.mediaType || a.MediaType) === 2);
                const mediaId = vid ? (vid.mediaId || vid.MediaId) : 0;

                if (mediaId !== 0) {
                    vHtml += `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: #121212; padding: 10px; border-radius: 6px; border: 1px solid #222; margin-bottom: 8px;">
                            <span style="color: #aaa; font-size: 0.85rem; font-weight: 700; flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                            <button onclick="window.inspectorAddEpisode(this, ${mediaId}, ${collectionId})" style="background: transparent; border: 1px solid #28a745; border-radius: 4px; color: #28a745; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: 0.2s;" onmouseover="this.style.background='rgba(40,167,69,0.1)'" onmouseout="this.style.background='transparent'"><i class="fas fa-plus" style="font-size: 10px;"></i></button>
                        </div>
                    `;
                }
            });
        }
        vaultContainer.innerHTML = vHtml;
    }
};

window.inspectorRemoveEpisode = async function (btn, linkId, collectionId) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 10px;"></i>'; btn.disabled = true;
    try {
        const res = await fetch(`/api/collections/items/${linkId}?collectionId=${collectionId}`, {
            method: 'DELETE', headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (res.ok) { window.loadInspectorEpisodeList(collectionId); }
        else { btn.innerHTML = '<i class="fas fa-minus" style="font-size: 10px;"></i>'; btn.disabled = false; }
    } catch (e) { btn.disabled = false; }
};

window.inspectorAddEpisode = async function (btn, targetId, collectionId) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 10px;"></i>'; btn.disabled = true;
    try {
        const res = await fetch(`/api/collections/${collectionId}/add-item`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify({ TargetId: targetId, TargetType: 2 })
        });
        if (res.ok) { window.loadInspectorEpisodeList(collectionId); }
        else { btn.innerHTML = '<i class="fas fa-plus" style="font-size: 10px;"></i>'; btn.disabled = false; }
    } catch (e) { btn.disabled = false; }
};

window.saveVideoInspector = async function () {
    const btn = document.getElementById('vid-edit-save-btn');
    if (!btn) return;
    const originalText = btn.innerText;
    btn.disabled = true;

    const id = document.getElementById('vid-edit-target-id').value;
    const type = document.getElementById('vid-edit-target-type').value;

    try {
        let newMediaAttachments = [];
        if (window.inspectorVideoCoverFile) {
            btn.innerText = "UPLOADING ART...";
            const uploadData = new FormData();
            uploadData.append("file", window.inspectorVideoCoverFile);
            const uploadRes = await fetch("/api/upload/image", {
                method: 'POST',
                headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                body: uploadData
            });
            if (uploadRes.ok) {
                const mediaResult = await uploadRes.json();
                newMediaAttachments.push({ MediaId: mediaResult.id, MediaType: 3, Url: mediaResult.url });
            }
        }

        btn.innerText = "SAVING...";

        const payload = {
            Title: document.getElementById('vid-edit-title').value,
            Text: document.getElementById('vid-edit-desc').value,
            Price: parseFloat(document.getElementById('vid-edit-price').value) || null,
            Visibility: parseInt(document.getElementById('vid-edit-visibility').value),
            MediaAttachments: newMediaAttachments
        };

        const endpoint = (type == 0 || type == '0') ? `/api/videohub/collection/${id}` : `/api/videohub/video/${id}`;
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            btn.innerText = "SUCCESS";
            btn.style.background = "#28a745";
            const userId = document.getElementById("video-user-id").value;
            window.loadVideoHub(userId);
            setTimeout(() => {
                window.closeVideoInspector();
                btn.innerText = originalText;
                btn.style.background = "linear-gradient(135deg, #00d2ff, #007bff)";
                btn.disabled = false;
            }, 1000);
        } else { throw new Error("Save failed"); }
    } catch (e) {
        console.error(e);
        btn.innerText = originalText;
        btn.disabled = false;
        alert("Save failed.");
    }
};

window.twoStepDeleteVideo = async function (btnElement, postId) {
    if (window.event) window.event.stopPropagation();

    if (!btnElement.classList.contains('confirming')) {
        btnElement.classList.add('confirming');
        btnElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Confirm?`;
        btnElement.style.color = '#ff4d4d';
        setTimeout(() => {
            if (btnElement) {
                btnElement.classList.remove('confirming');
                btnElement.innerHTML = `<i class="fas fa-trash"></i> Delete`;
                btnElement.style.color = '#ff4d4d';
            }
        }, 4000);
        return;
    }

    btnElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Deleting...`;
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (response.ok) {
            const userId = document.getElementById("video-user-id")?.value;
            if (userId) window.loadVideoHub(userId);
        }
    } catch (e) { console.error(e); }
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
                btnElement.innerHTML = `<i class="fas fa-trash"></i> Delete`;
                btnElement.style.color = '#fff';
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
            const userId = document.getElementById("video-user-id")?.value;
            if (userId) window.loadVideoHub(userId);
        }
    } catch (e) { console.error(e); }
};

// ============================================
// 5. THE COLLECTION BUILDER (CREATE)
// ============================================
window.openVideoCollectionBuilder = function () {
    const modal = document.getElementById('videoCollectionBuilderModal');
    if (!modal) return;

    document.getElementById('vcBuilderHeaderTitle').innerHTML = '<i class="fas fa-layer-group text-info me-2"></i> Build Video Collection';
    document.getElementById('vcBuilderTargetId').value = '';
    document.getElementById('vcBuilderTitle').value = '';
    window.collectionBuilderItems = [];

    renderBuilderVaultList();
    renderBuilderSelectedList();

    modal.classList.remove('d-none');
};

window.closeVideoCollectionBuilder = function () {
    const modal = document.getElementById('videoCollectionBuilderModal');
    if (modal) modal.classList.add('d-none');
};

function renderBuilderVaultList() {
    const container = document.getElementById('vcBuilderVaultList');
    container.innerHTML = '';

    const available = window.currentVaultVideos.filter(v => {
        const att = v.attachments || v.Attachments || [];
        const vid = att.find(a => (a.mediaType || a.MediaType) === 2);
        const mId = vid ? (vid.mediaId || vid.MediaId) : 0;
        return !window.collectionBuilderItems.some(ci => ci.id === mId);
    });

    available.forEach(v => {
        const pId = v.id !== undefined ? v.id : v.Id;
        const title = v.title || v.Title || 'Untitled';
        const attachments = v.attachments || v.Attachments || [];
        const vidAttach = attachments.find(a => (a.mediaType || a.MediaType) === 2);
        let sPath = vidAttach ? (vidAttach.snippetPath || vidAttach.SnippetPath) : null;
        const thumbSrc = (sPath && sPath !== "null") ? sPath.replace(/\\/g, '/') : '/img/default_cover.jpg';

        container.innerHTML += `
            <div style="background: #222; border: 1px solid #444; border-radius: 6px; overflow: hidden; cursor: pointer; transition: transform 0.2s;" onclick="window.addVideoToBuilder(${pId})" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <div style="width: 100%; aspect-ratio: 16/9; background: #000; position: relative;">
                    <img src="${thumbSrc}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.7;">
                    <div style="position: absolute; top:0; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center;">
                        <i class="fas fa-plus-circle text-info" style="font-size: 2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.8);"></i>
                    </div>
                </div>
                <div style="padding: 5px 10px; font-size: 0.8rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
            </div>
        `;
    });
}

window.addVideoToBuilder = function (postId) {
    const video = window.currentVaultVideos.find(v => (v.id === postId || v.Id === postId));
    if (video) {
        const att = video.attachments || video.Attachments || [];
        const vid = att.find(a => (a.mediaType || a.MediaType) === 2);
        const mediaId = vid ? (vid.mediaId || vid.MediaId) : 0;

        if (mediaId !== 0) {
            window.collectionBuilderItems.push({
                id: mediaId,
                title: video.title || video.Title
            });
            renderBuilderVaultList();
            renderBuilderSelectedList();
        }
    }
};

function renderBuilderSelectedList() {
    const container = document.getElementById('vcBuilderSelectedList');
    if (window.collectionBuilderItems.length === 0) {
        container.innerHTML = '<div class="text-center text-muted mt-4 small">Click a video from your vault to add it here.</div>';
        return;
    }

    container.innerHTML = '';
    window.collectionBuilderItems.forEach((v, index) => {
        const title = v.title || 'Untitled';
        const mId = v.id;

        container.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; background: #1a1a1a; border: 1px solid #333; padding: 10px 15px; border-radius: 6px; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 15px; overflow: hidden;">
                    <span style="color: #666; font-weight: bold; width: 20px;">${index + 1}.</span>
                    <span style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                </div>
                <button onclick="window.removeVideoFromBuilder(${mId})" style="background: #ff4d4d; border: none; color: white; border-radius: 50%; width: 24px; height: 24px; flex-shrink:0; display: flex; align-items: center; justify-content: center; cursor: pointer;"><i class="fas fa-minus"></i></button>
            </div>
        `;
    });
}

window.removeVideoFromBuilder = function (mediaId) {
    window.collectionBuilderItems = window.collectionBuilderItems.filter(v => v.id !== mediaId);
    renderBuilderVaultList();
    renderBuilderSelectedList();
};

window.saveVideoCollection = async function () {
    const titleInput = document.getElementById('vcBuilderTitle').value.trim();
    if (!titleInput) { alert("Please enter a title for this collection."); return; }
    if (window.collectionBuilderItems.length === 0) { alert("Please add at least one video to the collection."); return; }

    const btn = document.getElementById('vcBuilderSaveBtn');
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const targetId = document.getElementById('vcBuilderTargetId').value;
        const isUpdate = targetId && targetId.length > 0;

        const itemsPayload = window.collectionBuilderItems.map((v, index) => ({
            TargetId: v.id,
            TargetType: 2,
            SortOrder: index
        }));

        const payload = {
            Title: titleInput,
            Description: "Video Collection",
            Type: 8,
            DisplayContext: "series",
            CoverImageId: 0,
            Items: itemsPayload
        };

        const res = await fetch('/api/collections/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            window.closeVideoCollectionBuilder();
            const userId = document.getElementById('video-user-id')?.value;
            if (userId) window.loadVideoHub(userId);
        } else {
            alert("Failed to save collection.");
        }
    } catch (e) {
        alert("Error saving collection.");
    } finally {
        btn.innerText = "Save Collection";
        btn.disabled = false;
    }
};

// ============================================
// 6. THE CAROUSEL DOCK MANAGER
// ============================================
window.isVideoCarouselManagerActive = false;
window.videoCarouselDockItems = [];

window.toggleVideoCarouselManager = async function () {
    window.isVideoCarouselManagerActive = !window.isVideoCarouselManagerActive;
    const btn = document.getElementById('btnToggleVideoCarouselManager');
    const dock = document.getElementById('videoCarouselManagerDock');

    if (window.isVideoCarouselManagerActive) {
        if (btn) btn.innerHTML = '<i class="fas fa-check"></i> <span>Close Manager</span>';
        if (dock) dock.classList.remove('d-none');

        window.renderVideoCarouselDockSlots();

        const userId = window.AuthState?.userId;
        if (userId && window.videoCarouselDockItems.length === 0) {
            try {
                const existRes = await fetch(`/api/collections/user/${userId}/context/video`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
                if (existRes.ok) {
                    const collections = await existRes.json();
                    if (collections && collections.length > 0) {
                        const colId = collections[0].id || collections[0].Id;
                        const detailRes = await fetch(`/api/collections/${colId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
                        if (detailRes.ok) {
                            const details = await detailRes.json();
                            const items = details.items || details.Items || [];
                            window.videoCarouselDockItems = items.map(item => {
                                return {
                                    id: String(item.targetId || item.TargetId),
                                    title: item.title || item.Title,
                                    imgUrl: item.artUrl || item.ArtUrl || '/img/default_cover.jpg'
                                };
                            });
                            window.renderVideoCarouselDockSlots();
                        }
                    }
                }
            } catch (e) { }
        }
    } else {
        if (btn) btn.innerHTML = '<i class="fas fa-star"></i> <span>Manage Carousel</span>';
        if (dock) dock.classList.add('d-none');
    }
};

window.renderVideoCarouselDockSlots = function () {
    const container = document.getElementById('videoCarouselDockSlotsContainer');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 5; i++) {
        if (window.videoCarouselDockItems[i]) {
            const item = window.videoCarouselDockItems[i];
            container.innerHTML += `
                <div class="vid-carousel-slot filled-slot" onclick="window.removeFromVideoCarouselDock('${item.id}')" title="Remove">
                    <img src="${item.imgUrl}" class="vid-slot-art">
                    <div style="z-index: 2; text-align: center; width: 100%; padding: 0 10px;">
                        <div class="text-truncate" style="color: white; font-weight: bold; font-size: 0.9rem; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${item.title}</div>
                    </div>
                    <button style="position: absolute; top: -10px; right: -10px; background: #ff4d4d; color: white; border: 2px solid #111; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;"><i class="fas fa-times"></i></button>
                </div>`;
        } else {
            container.innerHTML += `
                <div class="vid-carousel-slot empty-slot">
                    <i class="fas fa-plus fa-2x" style="margin-bottom: 8px;"></i>
                    <span style="font-size: 0.8rem; font-weight: 600;">Empty Slot</span>
                </div>`;
        }
    }
};

window.addToVideoCarouselDock = function (postId, titleEnc, imgUrl) {
    if (!window.isVideoCarouselManagerActive) window.toggleVideoCarouselManager();
    if (window.videoCarouselDockItems.find(x => x.id === String(postId))) return;
    if (window.videoCarouselDockItems.length >= 5) { alert("Carousel is full (max 5)"); return; }

    window.videoCarouselDockItems.push({ id: String(postId), title: decodeURIComponent(titleEnc), imgUrl: imgUrl });
    window.renderVideoCarouselDockSlots();
};

window.removeFromVideoCarouselDock = function (postId) {
    window.videoCarouselDockItems = window.videoCarouselDockItems.filter(x => x.id !== String(postId));
    window.renderVideoCarouselDockSlots();
};

window.saveVideoCarouselDock = async function () {
    const btn = document.querySelector('#videoCarouselManagerDock .btn-dock-save');
    if (btn) { btn.innerText = "Saving..."; btn.disabled = true; }

    try {
        const itemsToSave = window.videoCarouselDockItems.map((item, index) => ({
            TargetId: parseInt(item.id),
            TargetType: 2,
            SortOrder: index
        }));

        const payload = {
            Title: "Featured Videos",
            Description: "My featured premieres",
            Type: 8,
            DisplayContext: "video",
            CoverImageId: 0,
            Items: itemsToSave
        };

        const response = await fetch('/api/collections/create', {
            method: 'POST',
            headers: { "Content-Type": "application/json", "X-Session-Id": window.AuthState?.sessionId || "" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            if (btn) {
                btn.innerText = "Saved!";
                btn.style.background = "#28a745";
                setTimeout(() => {
                    btn.innerText = "Save to Profile";
                    btn.style.background = "linear-gradient(135deg, #00d2ff, #007bff)";
                    btn.disabled = false;
                    window.toggleVideoCarouselManager();
                    if (window.AppRouter) window.AppRouter.loadHtml(window.location.pathname);
                    else window.location.reload();
                }, 1000);
            }
        }
    } catch (e) {
        alert("Error saving carousel");
        if (btn) { btn.innerText = "Save to Profile"; btn.disabled = false; }
    }
};

// ============================================
// 7. THE CINEMA MODAL (Comments & Likes Addition)
// ============================================
window.openCinemaModal = async function (postId, vidUrlEnc, titleEnc, descEnc) {
    const modal = document.getElementById('cinemaModal');
    const player = document.getElementById('cinemaVideoPlayer');
    const titleEl = document.getElementById('cinemaVideoTitle');
    const descEl = document.getElementById('cinemaVideoDesc');
    const likeBtn = document.getElementById('cinemaLikeBtn');
    const likeCount = document.getElementById('cinemaLikeCount');

    if (!modal || !player) return;

    // Reset UI
    window.cancelCinemaReply();
    titleEl.innerText = decodeURIComponent(titleEnc);
    descEl.innerText = decodeURIComponent(descEnc);
    player.src = decodeURIComponent(vidUrlEnc);

    // Set loading state for likes
    likeBtn.dataset.id = postId;
    likeCount.innerText = "...";
    likeBtn.querySelector('i').className = 'far fa-heart fa-lg';

    // Load Local Comments
    window.loadCinemaComments(postId);

    modal.classList.remove('d-none');
    player.play().catch(e => console.log("Auto-play prevented", e));

    // FETCH LIVE STATS 
    try {
        const res = await fetch(`/api/posts/${postId}`, {
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });
        if (res.ok) {
            const post = await res.json();
            // Fallbacks handle C# PascalCase vs JS camelCase
            const likes = post.likesCount !== undefined ? post.likesCount : (post.LikesCount || 0);
            const isLiked = post.isLiked !== undefined ? post.isLiked : (post.IsLiked || false);

            likeCount.innerText = likes;
            likeBtn.querySelector('i').className = isLiked ? 'fas fa-heart fa-lg text-danger' : 'far fa-heart fa-lg';
        }
    } catch (e) {
        console.error("Failed to fetch live stats", e);
        likeCount.innerText = "0";
    }
};

window.closeCinemaModal = function () {
    const modal = document.getElementById('cinemaModal');
    const player = document.getElementById('cinemaVideoPlayer');
    if (modal) modal.classList.add('d-none');
    if (player) {
        player.pause();
        player.src = '';
    }
};

window.toggleCinemaLike = async function () {
    const btn = document.getElementById('cinemaLikeBtn');
    const countSpan = document.getElementById('cinemaLikeCount');
    if (!btn) return;

    const postId = btn.dataset.id;
    if (!postId) return;

    btn.disabled = true;

    try {
        const res = await fetch(`/api/posts/${postId}/like`, {
            method: 'POST',
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });

        if (res.ok) {
            const data = await res.json();
            let currentCount = parseInt(countSpan.innerText) || 0;
            const icon = btn.querySelector('i');
            const wasLiked = icon.classList.contains('fas');

            if (data.liked) {
                icon.className = 'fas fa-heart fa-lg text-danger';
                if (!wasLiked) countSpan.innerText = currentCount + 1;
            } else {
                icon.className = 'far fa-heart fa-lg';
                if (wasLiked) countSpan.innerText = Math.max(0, currentCount - 1);
            }
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; }
};

window.toggleGridLike = async function (btn, postId) {
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
                icon.className = 'fas fa-heart text-danger';
                span.innerText = count + 1;
            } else {
                icon.className = 'far fa-heart';
                span.innerText = Math.max(0, count - 1);
            }
        }
    } catch (e) { console.error(e); }
    finally { btn.disabled = false; }
};

window.loadCinemaComments = async function (postId) {
    const wrapper = document.getElementById('cinemaCommentsWrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '<div class="text-center text-muted mt-4"><i class="fas fa-spinner fa-spin"></i> Loading comments...</div>';

    try {
        const res = await fetch(`/api/posts/${postId}/comments`, {
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });
        if (res.ok) {
            const comments = await res.json();
            if (comments.length === 0) {
                wrapper.innerHTML = '';
                return;
            }

            // Safe Image Resolver
            const resolvePic = (pic) => {
                if (!pic || pic === 'null') return '/img/profile_default.jpg';
                if (pic.startsWith('http') || pic.startsWith('/')) return pic;
                return '/' + pic;
            };

            // Recursive Comment Renderer
            const renderComment = (c, isReply = false) => {
                const pic = resolvePic(c.authorPic);
                let html = `
                    <div style="display: flex; gap: 12px; margin-bottom: ${isReply ? '12' : '20'}px; ${!isReply ? 'border-bottom: 1px solid #222; padding-bottom: 15px;' : ''}">
                        <img src="${pic}" style="width: ${isReply ? '28' : '40'}px; height: ${isReply ? '28' : '40'}px; border-radius: 50%; object-fit: cover; border: 1px solid #333; flex-shrink: 0;">
                        <div style="flex-grow: 1;">
                            <div style="font-weight: bold; font-size: ${isReply ? '0.8' : '0.85'}rem; color: #fff;">
                                ${c.authorName} 
                                <span style="color: #666; font-size: 0.75rem; font-weight: normal; margin-left: 8px;">${c.createdAgo}</span>
                            </div>
                            <div style="color: #ccc; font-size: ${isReply ? '0.85' : '0.95'}rem; margin-top: 4px; line-height: 1.4; word-break: break-word;">${c.content}</div>
                            ${!isReply ? `
                            <div style="margin-top: 6px;">
                                <button onclick="window.prepareCinemaReply(${c.commentId}, '${encodeURIComponent(c.authorName)}')" style="background: rgba(13, 202, 240, 0.1); border: 1px solid rgba(13, 202, 240, 0.3); color: #0dcaf0; font-size: 0.75rem; font-weight: bold; cursor: pointer; padding: 2px 10px; border-radius: 12px; transition: 0.2s;" onmouseover="this.style.background='rgba(13, 202, 240, 0.2)'" onmouseout="this.style.background='rgba(13, 202, 240, 0.1)'">Reply</button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;

                // Recursively attach replies if they exist
                if (c.replies && c.replies.length > 0) {
                    html += `
                        <div style="margin-left: 52px; border-left: 2px solid #333; padding-left: 15px; margin-bottom: 15px;">
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

window.prepareCinemaReply = function (commentId, authorNameEnc) {
    document.getElementById('cinemaReplyParentId').value = commentId;
    document.getElementById('cinemaReplyName').innerText = decodeURIComponent(authorNameEnc);
    const badge = document.getElementById('cinemaReplyBadge');
    badge.classList.remove('d-none');
    document.getElementById('cinemaCommentInput').focus();
};

window.cancelCinemaReply = function () {
    const parentInput = document.getElementById('cinemaReplyParentId');
    if (parentInput) parentInput.value = '';
    const badge = document.getElementById('cinemaReplyBadge');
    if (badge) badge.classList.add('d-none');
};

window.submitCinemaComment = async function () {
    const btn = document.getElementById('cinemaLikeBtn');
    if (!btn) return;
    const postId = btn.dataset.id;

    const input = document.getElementById('cinemaCommentInput');
    const parentInput = document.getElementById('cinemaReplyParentId');

    const content = input.value.trim();
    if (!content) return;

    // Parse the parent ID if it exists
    const parentId = parentInput.value ? parseInt(parentInput.value) : null;

    try {
        const res = await fetch('/api/posts/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
            body: JSON.stringify({ PostId: parseInt(postId), Content: content, ParentId: parentId })
        });

        if (res.ok) {
            input.value = '';
            window.cancelCinemaReply(); // Hide the badge
            window.loadCinemaComments(postId); // Refresh the feed
        }
    } catch (e) { console.error(e); }
};

document.addEventListener('click', function (e) {
    if (!e.target.closest('.vid-top-right-actions') && !e.target.closest('.msg-context-menu')) {
        document.querySelectorAll('.vid-top-right-actions .msg-context-menu').forEach(el => el.style.display = 'none');
    }
});