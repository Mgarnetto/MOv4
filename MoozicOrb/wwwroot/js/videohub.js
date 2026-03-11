/* ============================================
   VIDEO HUB v2.0: JAVASCRIPT ENGINE
   Handles Cinematic Grid, Drag & Drop, Collections, and Carousel
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
        // 1. Fetch Vault Videos (Type 6 and Type 1)
        const vaultRes = await fetch(`/api/videohub/vault/${userId}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (vaultRes.ok) {
            window.currentVaultVideos = await vaultRes.json();
            renderVaultGrid(window.currentVaultVideos, isOwner);
        }

        // 2. Fetch Video Collections (Type 8)
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
// 2. GRID RENDERERS
// ============================================
function renderVaultGrid(posts, isOwner) {
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

        const likes = post.likesCount || 0;
        const comments = post.commentsCount || 0;

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

                <div class="vid-thumb-wrapper" onclick="window.openCinemaModal('${pId}', '${safeVidUrl}', '${safeTitle}', '${safeDesc}', ${likes}, ${comments})">
                    <img src="${thumbSrc}" class="vid-thumb-img">
                    <div class="vid-play-overlay"><i class="fas fa-play-circle" style="color: white; font-size: 3rem;"></i></div>
                    
                    ${isOwner ? `
                    <div class="vid-top-right-actions">
                        <div class="vid-action-circle" onclick="event.stopPropagation(); window.addToVideoCarouselDock('${pId}', '${safeTitle}', '${thumbSrc}')" title="Feature Video"><i class="fas fa-star" style="font-size:0.8rem;"></i></div>
                        <div class="vid-action-circle position-relative" onclick="event.stopPropagation(); this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <i class="fas fa-ellipsis-v"></i>
                        </div>
                        <div class="msg-context-menu" style="position: absolute; right: 0; top: 100%; width: 150px; z-index: 1050; background: #222; border: 1px solid #444; border-radius: 6px; display: none;">
                            <button onclick="event.stopPropagation(); window.openVideoInspector('${pId}', '${safeTitle}', '${safeDesc}', ${price || 0}, ${vis}, '${thumbSrc}', 2)" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-edit"></i> Edit Video</button>
                            <button class="text-danger" onclick="event.stopPropagation(); window.twoStepDeleteVideo(this, '${pId}')" style="background: transparent; border: none; padding: 10px 15px; width: 100%; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 10px;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                    ` : ''}

                    <div class="vid-actions-overlay">
                        <button class="vid-btn-translucent" onclick="event.stopPropagation();"><i class="fas fa-heart ${post.isLiked ? 'text-danger' : ''}"></i> ${likes}</button>
                        <button class="vid-btn-translucent" onclick="event.stopPropagation(); window.openCinemaModal('${pId}', '${safeVidUrl}', '${safeTitle}', '${safeDesc}', ${likes}, ${comments}, true)"><i class="fas fa-comment"></i> ${comments}</button>
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

    if (collections.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = `<h4 style="color:white; border-bottom:1px solid #333; padding-bottom:10px; margin-top:30px;">Video Collections</h4>
                <div class="video-hub-grid" style="margin-top: 15px;">`;

    collections.forEach(col => {
        const art = col.coverImageUrl || '/img/default_cover.jpg';
        const title = col.title || "Untitled Collection";
        const price = col.price || 0;
        const vis = col.visibility || 0;
        const safeTitle = encodeURIComponent(title);
        const safeDesc = encodeURIComponent(col.description || '');

        html += `
            <div class="vid-card">
                <div class="vid-thumb-wrapper" onclick="alert('View Collection: ${col.id} - Phase 3 Coming Soon!')">
                    <img src="${art}" class="vid-thumb-img" style="opacity: 0.5;">
                    <div class="vid-play-overlay"><i class="fas fa-layer-group" style="color: white; font-size: 3rem;"></i></div>
                    
                    ${isOwner ? `
                    <div style="position: absolute; top: 10px; right: 10px; z-index: 20; display: flex; gap: 8px;">
                        <button onclick="event.stopPropagation(); window.openVideoInspector('${col.id}', '${safeTitle}', '${safeDesc}', ${price}, ${vis}, '${art}', 0)" title="Edit Collection" style="background: rgba(0,0,0,0.7); border: 1px solid #444; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;"><i class="fas fa-edit text-info"></i></button>
                        <button onclick="event.stopPropagation(); window.deleteVideoCollection(this, '${col.id}')" title="Delete Collection" style="background: rgba(0,0,0,0.7); border: 1px solid #444; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;"><i class="fas fa-trash text-danger"></i></button>
                    </div>
                    ` : ''}

                    <div style="position: absolute; bottom: 10px; left: 10px; color: white; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.9); z-index: 5;">
                        ${title}
                    </div>
                </div>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

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
// 4. VIDEO INSPECTOR (AudioHub Style)
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

    // Switch behavior based on TargetType (0 = Collection, 2 = Individual Video)
    if (targetType === 0 || targetType === '0') {
        document.getElementById('vid-inspector-header-title').innerText = "Edit Collection";
        if (episodesTab) episodesTab.classList.remove('d-none');

        // Fetch items and store them locally
        try {
            const res = await fetch(`/api/collections/${id}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
            if (res.ok) {
                const data = await res.json();
                window.inspectorCollectionItems = data.items || data.Items || [];
            }
        } catch (e) {
            window.inspectorCollectionItems = [];
        }

        window.renderInspectorSeriesEpisodes();
        window.renderInspectorVaultVideos();
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

// --- EPISODE LIST LOGIC (Local Array) ---
window.inspectorCollectionItems = [];

window.renderInspectorSeriesEpisodes = function () {
    const container = document.getElementById('inspector-series-episodes-container');
    if (!container) return;

    if (window.inspectorCollectionItems.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-muted small">No episodes in this collection.</div>';
        return;
    }

    // Notice the justify-content: space-between pushes the button to the far right!
    container.innerHTML = window.inspectorCollectionItems.map((item, idx) => `
        <div class="inspector-item-row">
            <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex-grow: 1;">
                <span style="color: #555; font-weight: 900; font-size: 0.75rem; width: 15px;">${idx + 1}</span>
                <span style="color: #eee; font-size: 0.85rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title || item.Title || "Untitled"}</span>
            </div>
            <button onclick="window.removeItemFromInspectorCollection('${item.targetId || item.TargetId}')" style="background: transparent; border: none; color: #ff4d4d; cursor: pointer; padding: 5px; flex-shrink: 0;"><i class="fas fa-trash-alt"></i></button>
        </div>
    `).join('');
};

window.renderInspectorVaultVideos = function () {
    const container = document.getElementById('inspector-vault-videos-container');
    if (!container) return;

    // Filter out videos that are already in the local inspectorCollectionItems array
    const available = window.currentVaultVideos.filter(v => !window.inspectorCollectionItems.some(ci => String(ci.targetId || ci.TargetId) === String(v.id || v.Id)));

    if (available.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-muted small">No available videos in vault.</div>';
        return;
    }

    container.innerHTML = available.map(v => {
        const pId = v.id !== undefined ? v.id : v.Id;
        const title = v.title || v.Title || 'Untitled';
        return `
            <div class="inspector-item-row" style="cursor: pointer;" onclick="window.addItemToInspectorCollection('${pId}')">
                <span style="color: #eee; font-size: 0.85rem; font-weight: 700; flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                <i class="fas fa-plus-circle text-success" style="font-size: 1.1rem; flex-shrink: 0; padding: 5px;"></i>
            </div>
        `;
    }).join('');
};

window.addItemToInspectorCollection = function (postId) {
    const video = window.currentVaultVideos.find(v => String(v.id || v.Id) === String(postId));
    if (video) {
        window.inspectorCollectionItems.push({
            targetId: postId,
            TargetId: postId,
            title: video.title || video.Title,
            TargetType: 2
        });
        window.renderInspectorSeriesEpisodes();
        window.renderInspectorVaultVideos();
    }
};

window.removeItemFromInspectorCollection = function (targetId) {
    window.inspectorCollectionItems = window.inspectorCollectionItems.filter(ci => String(ci.targetId || ci.TargetId) !== String(targetId));
    window.renderInspectorSeriesEpisodes();
    window.renderInspectorVaultVideos();
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

        // MAP THE LOCAL ITEMS TO BE SAVED
        const itemsPayload = window.inspectorCollectionItems.map((v, index) => ({
            TargetId: v.targetId || v.TargetId,
            TargetType: 2,
            SortOrder: index
        }));

        const payload = {
            Title: document.getElementById('vid-edit-title').value,
            Text: document.getElementById('vid-edit-desc').value,
            Price: parseFloat(document.getElementById('vid-edit-price').value) || null,
            Visibility: parseInt(document.getElementById('vid-edit-visibility').value),
            MediaAttachments: newMediaAttachments,
            Items: itemsPayload // Include the ordered items for collection updates
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

// ============================================
// 5. THE COLLECTION BUILDER (CREATE & EDIT)
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

window.editVideoCollection = async function (collectionId) {
    const modal = document.getElementById('videoCollectionBuilderModal');
    if (!modal) return;

    document.getElementById('vcBuilderHeaderTitle').innerHTML = '<i class="fas fa-layer-group text-warning me-2"></i> Edit Video Collection';
    document.getElementById('vcBuilderTargetId').value = collectionId;

    try {
        const res = await fetch(`/api/collections/${collectionId}`, { headers: { "X-Session-Id": window.AuthState?.sessionId || "" } });
        if (res.ok) {
            const details = await res.json();
            document.getElementById('vcBuilderTitle').value = details.title || details.Title;

            const rawItems = details.items || details.Items || [];

            window.collectionBuilderItems = rawItems.map(item => ({
                id: item.targetId || item.TargetId,
                title: item.title || item.Title,
                attachments: [{ mediaType: 2, snippetPath: item.artUrl || item.ArtUrl }]
            }));

            renderBuilderVaultList();
            renderBuilderSelectedList();
            modal.classList.remove('d-none');
        }
    } catch (e) {
        alert("Error loading collection for editing.");
    }
};

window.closeVideoCollectionBuilder = function () {
    const modal = document.getElementById('videoCollectionBuilderModal');
    if (modal) modal.classList.add('d-none');
};

function renderBuilderVaultList() {
    const container = document.getElementById('vcBuilderVaultList');
    container.innerHTML = '';

    const available = window.currentVaultVideos.filter(v => !window.collectionBuilderItems.some(ci => ci.id === v.id || ci.id === v.Id));

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
    const video = window.currentVaultVideos.find(v => v.id === postId || v.Id === postId);
    if (video) {
        window.collectionBuilderItems.push(video);
        renderBuilderVaultList();
        renderBuilderSelectedList();
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
        const pId = v.id !== undefined ? v.id : v.Id;
        const title = v.title || v.Title || 'Untitled';

        container.innerHTML += `
            <div style="display: flex; align-items: center; justify-content: space-between; background: #1a1a1a; border: 1px solid #333; padding: 10px 15px; border-radius: 6px;">
                <div style="display: flex; align-items: center; gap: 15px; overflow: hidden;">
                    <span style="color: #666; font-weight: bold; width: 20px;">${index + 1}.</span>
                    <span style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</span>
                </div>
                <button onclick="window.removeVideoFromBuilder(${pId})" style="background: #ff4d4d; border: none; color: white; border-radius: 50%; width: 24px; height: 24px; flex-shrink:0; display: flex; align-items: center; justify-content: center; cursor: pointer;"><i class="fas fa-minus"></i></button>
            </div>
        `;
    });
}

window.removeVideoFromBuilder = function (postId) {
    window.collectionBuilderItems = window.collectionBuilderItems.filter(v => v.id !== postId && v.Id !== postId);
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
            TargetId: v.id !== undefined ? v.id : v.Id,
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

        const url = isUpdate ? `/api/collections/${targetId}` : '/api/collections/create';
        const method = isUpdate ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
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

window.deleteVideoCollection = async function (btnElement, id) {
    if (!confirm("Are you sure you want to delete this collection? The videos will remain in your vault.")) return;

    try {
        const res = await fetch(`/api/collections/${id}`, {
            method: 'DELETE',
            headers: { 'X-Session-Id': window.AuthState?.sessionId || '' }
        });

        if (res.ok) {
            const userId = document.getElementById('video-user-id')?.value;
            if (userId) window.loadVideoHub(userId);
        }
    } catch (e) { console.error(e); }
}

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
// 7. THE CINEMA MODAL
// ============================================
window.openCinemaModal = function (postId, vidUrlEnc, titleEnc, descEnc, likes, comments, autoFocusComments = false) {
    const modal = document.getElementById('cinemaModal');
    const player = document.getElementById('cinemaVideoPlayer');
    const titleEl = document.getElementById('cinemaVideoTitle');
    const descEl = document.getElementById('cinemaVideoDesc');
    const likeBtn = document.getElementById('cinemaLikeBtn');
    const likeCount = document.getElementById('cinemaLikeCount');
    const commentsWrapper = document.getElementById('cinemaCommentsWrapper');

    if (!modal || !player) return;

    titleEl.innerText = decodeURIComponent(titleEnc);
    descEl.innerText = decodeURIComponent(descEnc);
    player.src = decodeURIComponent(vidUrlEnc);

    likeBtn.dataset.id = postId;
    likeCount.innerText = likes;

    commentsWrapper.innerHTML = `<div id="comments-list-${postId}" class="mb-3"></div>`;
    if (window.loadComments) {
        window.loadComments(postId, document.getElementById(`comments-list-${postId}`));
    }

    modal.classList.remove('d-none');
    player.play().catch(e => console.log("Auto-play prevented", e));
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

window.submitCinemaComment = function () {
    const btn = document.getElementById('cinemaLikeBtn');
    if (!btn) return;
    const postId = btn.dataset.id;

    const input = document.getElementById('cinemaCommentInput');
    const content = input.value.trim();
    if (!content) return;

    fetch('/api/posts/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': window.AuthState?.sessionId || '' },
        body: JSON.stringify({ PostId: postId, Content: content })
    }).then(res => {
        if (res.ok) {
            input.value = '';
            if (window.loadComments) window.loadComments(postId, document.getElementById(`comments-list-${postId}`));
        }
    }).catch(e => console.error(e));
};

document.addEventListener('click', function (e) {
    if (!e.target.closest('.vid-top-right-actions') && !e.target.closest('.msg-context-menu')) {
        document.querySelectorAll('.vid-top-right-actions .msg-context-menu').forEach(el => el.style.display = 'none');
    }
});