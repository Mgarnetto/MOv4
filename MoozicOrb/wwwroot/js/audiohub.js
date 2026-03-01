// ============================================
// AUDIO CAROUSEL MANAGER (DOCK TOGGLE)
// ============================================
window.isAudioCarouselManagerActive = false;

window.toggleAudioCarouselManager = function () {
    window.isAudioCarouselManagerActive = !window.isAudioCarouselManagerActive;
    const btn = document.getElementById('btnToggleAudioCarouselManager');
    const dock = document.getElementById('audioCarouselManagerDock');

    if (window.isAudioCarouselManagerActive) {
        if (btn) btn.innerHTML = '<i class="fas fa-check"></i> <span class="d-none d-md-inline">Close Manager</span>';
        if (dock) dock.classList.remove('d-none');
    } else {
        if (btn) btn.innerHTML = '<i class="fas fa-star"></i> <span class="d-none d-md-inline">Manage Carousel</span>';
        if (dock) dock.classList.add('d-none');
    }
};

// ============================================
// AUDIO HUB: MASTER LOADER
// ============================================
window.loadAudioHub = async function (userId) {
    const isOwner = document.getElementById('audio-is-owner').value === 'true';
    const headers = {
        "X-Session-Id": window.AuthState?.sessionId || ""
    };

    if (isOwner) {
        window.initAudioCarouselDock();
    }

    try {
        const orphanRes = await fetch(`/api/audiohub/orphans/${userId}`, { headers });
        if (orphanRes.ok) {
            const orphanData = await orphanRes.json();
            renderOrphansList(orphanData.Items || orphanData.items, isOwner);
        }

        const albumRes = await fetch(`/api/audiohub/albums/${userId}`, { headers });
        if (albumRes.ok) {
            const albums = await albumRes.json();
            renderAlbumsList(albums, isOwner);
        }

        if (isOwner) {
            fetch(`/api/collections/mine?type=6`, { headers })
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    if (data && data.length > 0) {
                        document.getElementById('audioCarouselCollectionId').value = data[0].collectionId || data[0].CollectionId;

                        const items = data[0].items || data[0].Items;
                        if (items) {
                            items.forEach(item => {
                                const art = item.artUrl || item.ArtUrl || item.coverImageUrl || '/img/default_cover.jpg';
                                const targetId = item.targetId || item.TargetId;
                                const targetType = item.targetType !== undefined ? item.targetType : item.TargetType;
                                const title = item.title || item.Title || "Untitled";

                                window.addToAudioCarouselDock(targetId, targetType, title, art, true);
                            });
                        }
                    }
                });
        }
    } catch (err) {
        console.error("Error loading Audio Hub data:", err);
    }
};

// ============================================
// AUDIO HUB: LIST RENDERERS (MOBILE OPTIMIZED)
// ============================================
function renderOrphansList(items, isOwner) {
    const container = document.getElementById('audio-orphans-container');

    if (!items || items.length === 0) {
        const emptyMsg = isOwner ? "No singles or vault tracks found." : "No public tracks available.";
        container.innerHTML = `<div style="text-align: center; color: #888; padding: 2rem; border: 1px solid #333; border-radius: 8px; background: #121212;">${emptyMsg}</div>`;
        return;
    }

    // Conditionally render headers based on ownership
    let html = `
        <h4 style="color:white; border-bottom:1px solid #333; padding-bottom:10px;">Singles & Vault Tracks</h4>
        <div style="max-height: 500px; overflow-y: auto; background: #121212; border: 1px solid #222; border-radius: 8px;">
            <table style="width: 100%; border-collapse: collapse; color: #fff; font-size: 0.9rem;">
                <thead style="position: sticky; top: 0; background: #1a1a1a; z-index: 1;">
                    <tr>
                        <th style="text-align: center; padding: 12px 8px; border-bottom: 2px solid #333; width: 60px;">Art</th>
                        <th style="text-align: left; padding: 12px 8px; border-bottom: 2px solid #333;">Track Title</th>
                        ${isOwner ? `<th style="text-align: center; padding: 12px 8px; border-bottom: 2px solid #333; width: 100px;">Status</th>` : ''}
                        <th style="text-align: center; padding: 12px 8px; border-bottom: 2px solid #333; width: 80px;">Price</th>
                        ${isOwner ? `<th style="text-align: center; padding: 12px 8px; border-bottom: 2px solid #333; width: 100px;">Actions</th>` : ''}
                    </tr>
                </thead>
                <tbody>
    `;

    items.forEach(item => {
        const isLocked = item.isLocked || item.IsLocked;
        const price = item.price !== undefined ? item.price : item.Price;
        const visibility = item.visibility !== undefined ? item.visibility : item.Visibility;

        const lockIcon = isLocked ? '<i class="fas fa-lock" style="color: #ffc107; margin-left: 6px;" title="Sold Item - Locked"></i>' : '';
        const visState = visibility !== undefined && visibility !== null ? parseInt(visibility) : 0;

        let statusBadge = '';
        if (isOwner) {
            if (visState === 0) statusBadge = '<span style="background: #0d6efd; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">Public</span>';
            else if (visState === 1) statusBadge = '<span style="background: #0dcaf0; color: black; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">Link Only</span>';
            else statusBadge = '<span style="background: #6c757d; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">Private</span>';
        }

        const priceDisplay = price > 0 ? `<span style="color: #198754; font-weight: bold;">$${price.toFixed(2)}</span>` : '<span style="color: #888;">Free</span>';
        const rawTitle = item.title || item.Title || "Untitled Track";
        const encodedTitle = encodeURIComponent(rawTitle);

        // --- ADDED ARTIST EXTRACTION HERE ---
        const rawArtist = item.artistName || item.ArtistName || "Unknown Artist";
        const encodedArtist = encodeURIComponent(rawArtist);

        const art = item.artUrl || item.ArtUrl || '/img/default_cover.jpg';
        const targetId = item.targetId || item.TargetId;
        const rawUrl = item.url || item.Url || '';

        // Row configuration: Clickable for guests, static for owners
        const rowCursor = !isOwner ? 'cursor: pointer;' : '';

        // --- UPDATED ROW CLICK TO PASS ARTIST ---
        const rowClickEvent = !isOwner
            ? `onclick="if(window.AudioPlayer) window.AudioPlayer.playTrack('${rawUrl}', { title: decodeURIComponent('${encodedTitle}'), artist: decodeURIComponent('${encodedArtist}'), cover: '${art}' });"`
            : '';

        html += `
            <tr style="border-bottom: 1px solid #222; transition: background 0.2s; ${rowCursor}" onmouseover="this.style.background='#1a1a1a'" onmouseout="this.style.background='transparent'" ${rowClickEvent} title="${!isOwner ? 'Click to Play' : ''}">
                <td style="text-align: center; vertical-align: middle; padding: 8px;">
                    <div style="position: relative; display: inline-block;">
                        <img src="${art}" style="width: 35px; height: 35px; border-radius: 4px; object-fit: cover; display: block; margin: 0 auto;">
                        ${!isOwner ? `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); border-radius: 4px;"><i class="fas fa-play" style="color: white; font-size: 0.8rem;"></i></div>` : ''}
                    </div>
                </td>
                <td style="text-align: left; vertical-align: middle; padding: 8px; font-weight: 600; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${rawTitle}">
                    ${rawTitle} ${lockIcon}
                </td>
                
                ${isOwner ? `
                <td style="text-align: center; vertical-align: middle; padding: 8px;">
                    ${statusBadge}
                </td>
                ` : ''}
                
                <td style="text-align: center; vertical-align: middle; padding: 8px;">
                    ${priceDisplay}
                </td>
                
                ${isOwner ? `
                <td style="text-align: center; vertical-align: middle; padding: 8px;">
                    <div style="display: flex; justify-content: center; gap: 8px;">
                        <button style="background: transparent; border: 1px solid #0dcaf0; color: #0dcaf0; border-radius: 4px; padding: 4px 8px; cursor: pointer;" onclick="window.addToAudioCarouselDock(${targetId}, 1, decodeURIComponent('${encodedTitle}'), '${art}')" title="Add to Carousel"><i class="fas fa-star"></i></button>
                        <button style="background: transparent; border: 1px solid #f8f9fa; color: #f8f9fa; border-radius: 4px; padding: 4px 8px; cursor: pointer;" onclick="window.openAudioInspector(${targetId}, 1, '${encodedTitle}', ${price || 0}, ${visState}, ${isLocked})" title="Edit Settings"><i class="fas fa-edit"></i></button>
                    </div>
                </td>
                ` : ''}
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function renderAlbumsList(albums, isOwner) {
    const container = document.getElementById('audio-albums-container');
    if (!albums || albums.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <h4 style="color:white; border-bottom:1px solid #333; padding-bottom:10px; margin-top:30px;">Albums</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 20px;">
    `;

    albums.forEach(album => {
        const isLocked = album.isLocked || album.IsLocked;
        const price = album.price !== undefined ? album.price : album.Price;
        const visibility = album.visibility !== undefined ? album.visibility : album.Visibility;

        const lockIcon = isLocked ? '<i class="fas fa-lock text-warning"></i>' : '';
        const priceDisplay = price > 0 ? `$${price.toFixed(2)}` : 'Free';

        const visState = visibility !== undefined && visibility !== null ? parseInt(visibility) : 0;

        let statusIcon = '';
        if (visState === 0) statusIcon = '<i class="fas fa-globe text-primary" title="Public"></i>';
        else if (visState === 1) statusIcon = '<i class="fas fa-link text-info" title="Link Only"></i>';
        else statusIcon = '<i class="fas fa-lock text-secondary" title="Private"></i>';

        const rawTitle = album.title || album.Title || "Untitled Album";
        const encodedTitle = encodeURIComponent(rawTitle);

        // --- ADDED ARTIST EXTRACTION HERE ---
        const rawArtist = album.artistName || album.ArtistName || "Unknown Artist";
        const encodedArtist = encodeURIComponent(rawArtist);

        const art = album.coverImageUrl || album.CoverImageUrl || '/img/default_cover.jpg';
        const id = album.id || album.Id;
        const rawUrl = album.url || album.Url || '';

        // Row configuration: Clickable for guests, static for owners
        const cardCursor = !isOwner ? 'cursor: pointer;' : '';

        // --- UPDATED ALBUM CLICK TO PASS ARTIST ---
        const cardClickEvent = !isOwner
            ? `onclick="if(window.AudioPlayer) window.AudioPlayer.playTrack('${rawUrl}', { title: decodeURIComponent('${encodedTitle}'), artist: decodeURIComponent('${encodedArtist}'), cover: '${art}' });"`
            : '';

        html += `
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; overflow: hidden; transition: transform 0.2s; ${cardCursor}" class="album-card-hover shadow-sm" ${cardClickEvent}>
                <div style="position: relative; padding-top: 100%;">
                    <img src="${art}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                     ${!isOwner ? `<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'"><i class="fas fa-play" style="color: white; font-size: 2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);"></i></div>` : ''}
                </div>
                <div class="p-3">
                    <div class="text-white fw-bold text-truncate mb-1" title="${rawTitle}">${rawTitle}</div>
                    <div class="d-flex justify-content-between align-items-center mb-2" style="font-size: 0.8rem;">
                        <span class="text-success">${priceDisplay}</span>
                        <span>${statusIcon} ${lockIcon}</span>
                    </div>
                    
                    ${isOwner ? `
                        <div class="d-flex gap-2" style="position: relative; z-index: 2;">
                            <button class="btn btn-sm btn-outline-info flex-grow-1" onclick="window.addToAudioCarouselDock(${id}, 0, decodeURIComponent('${encodedTitle}'), '${art}')"><i class="fas fa-star"></i></button>
                            <button class="btn btn-sm btn-outline-light flex-grow-1" onclick="window.openAudioInspector(${id}, 0, '${encodedTitle}', ${price || 0}, ${visState}, ${isLocked})"><i class="fas fa-edit"></i></button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}

// ============================================
// AUDIO HUB: CAROUSEL DOCK LOGIC
// ============================================
window.initAudioCarouselDock = function () {
    const container = document.getElementById('audioCarouselDockSlotsContainer');
    container.innerHTML = '';

    for (let i = 0; i < 10; i++) {
        container.innerHTML += `
            <div class="audio-carousel-slot empty-slot" data-slot-index="${i}">
                <i class="fas fa-plus fa-2x" style="margin-bottom: 8px;"></i>
                <span style="font-size: 0.8rem; font-weight: 600;">Empty Slot</span>
            </div>
        `;
    }
};

window.addToAudioCarouselDock = function (targetId, targetType, title, artUrl, isInitLoad = false) {
    const container = document.getElementById('audioCarouselDockSlotsContainer');

    if (container.querySelector(`[data-target-id="${targetId}"][data-target-type="${targetType}"]`)) {
        if (!isInitLoad) alert("This item is already in your carousel!");
        return;
    }

    const emptySlot = container.querySelector('.empty-slot');
    if (!emptySlot) {
        if (!isInitLoad) alert("Your carousel is full! Remove an item to make space.");
        return;
    }

    const typeLabel = targetType === 0 ? "Album" : "Track";
    const safeTitle = title.replace(/'/g, "&#39;").replace(/"/g, "&quot;");

    emptySlot.classList.remove('empty-slot');
    emptySlot.classList.add('filled-slot');
    emptySlot.dataset.targetId = targetId;
    emptySlot.dataset.targetType = targetType;

    emptySlot.innerHTML = `
        <div class="audio-slot-art" style="background-image: url('${artUrl || '/img/default_cover.jpg'}');"></div>
        <div class="audio-slot-info">
            <div class="audio-slot-title text-truncate" title="${safeTitle}">${safeTitle}</div>
            <div class="audio-slot-type">${typeLabel}</div>
        </div>
        <button class="btn-audio-slot-remove" onclick="window.removeAudioCarouselSlot(this)" title="Remove from Carousel">
            <i class="fas fa-times"></i>
        </button>
    `;

    if (!isInitLoad && !window.isAudioCarouselManagerActive) {
        window.toggleAudioCarouselManager();
    }
};

window.removeAudioCarouselSlot = function (btn) {
    const slot = btn.parentElement;

    slot.classList.remove('filled-slot');
    slot.classList.add('empty-slot');

    delete slot.dataset.targetId;
    delete slot.dataset.targetType;

    slot.innerHTML = `
        <i class="fas fa-plus fa-2x" style="margin-bottom: 8px;"></i>
        <span style="font-size: 0.8rem; font-weight: 600;">Empty Slot</span>
    `;

    slot.parentElement.appendChild(slot);
};

window.saveAudioCarouselDock = async function () {
    const btn = document.querySelector('#audioCarouselManagerDock .btn-dock-save');
    if (btn) {
        btn.innerText = "Saving...";
        btn.disabled = true;
    }

    const slots = document.querySelectorAll('#audioCarouselDockSlotsContainer .filled-slot');
    const itemsToSave = [];

    slots.forEach((slot, index) => {
        itemsToSave.push({
            TargetId: parseInt(slot.dataset.targetId),
            TargetType: parseInt(slot.dataset.targetType),
            SortOrder: index
        });
    });

    const payload = {
        CollectionId: parseInt(document.getElementById('audioCarouselCollectionId').value) || 0,
        Title: "Featured Audio Carousel",
        CollectionType: 6,
        DisplayContext: "ProfileCarousel",
        Items: itemsToSave
    };

    const headers = {
        "Content-Type": "application/json",
        "X-Session-Id": window.AuthState?.sessionId || ""
    };

    try {
        const response = await fetch('/api/collections/upsert', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            document.getElementById('audioCarouselCollectionId').value = result.collectionId;

            if (btn) {
                btn.innerText = "Saved!";
                btn.style.background = "#28a745";
                setTimeout(() => {
                    btn.innerText = "Save to Profile";
                    btn.style.background = "linear-gradient(135deg, #00d2ff, #007bff)";
                    btn.disabled = false;
                    window.toggleAudioCarouselManager();
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
// AUDIO INSPECTOR (DECODE FIX)
// ============================================
window.openAudioInspector = function (targetId, targetType, encodedTitle, currentPrice, currentVisibility, isLocked) {
    const sidebar = document.getElementById('audio-inspector-sidebar');
    const typeLabel = targetType === 0 ? "Album" : "Track";

    const decodedTitle = decodeURIComponent(encodedTitle);

    document.getElementById('edit-target-id').value = targetId;
    document.getElementById('edit-target-type').value = targetType;
    document.getElementById('inspector-title').innerText = `Edit ${typeLabel}`;
    document.getElementById('edit-title').value = decodedTitle;
    document.getElementById('edit-price').value = currentPrice > 0 ? currentPrice.toFixed(2) : '';

    // THE FIX: Do not use || 1 here. Use the exact value passed.
    document.getElementById('edit-visibility').value = currentVisibility !== undefined && currentVisibility !== null ? currentVisibility : 0;

    const lockWarning = document.getElementById('inspector-lock-warning');
    const titleInput = document.getElementById('edit-title');

    if (isLocked) {
        lockWarning.classList.remove('d-none');
        titleInput.disabled = true;
        titleInput.style.opacity = '0.5';
    } else {
        lockWarning.classList.add('d-none');
        titleInput.disabled = false;
        titleInput.style.opacity = '1';
    }

    sidebar.classList.remove('closed');
};

window.closeAudioInspector = function () {
    const sidebar = document.getElementById('audio-inspector-sidebar');
    sidebar.classList.add('closed');
};

window.switchInspectorTab = function (tabName) {
    document.querySelectorAll('.audio-inspector .tab-btn').forEach(btn => btn.classList.remove('active'));

    if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    }

    document.getElementById('inspector-tab-details').classList.add('d-none');
    document.getElementById('inspector-tab-monetization').classList.add('d-none');

    document.getElementById(`inspector-tab-${tabName}`).classList.remove('d-none');
};

window.saveAudioInspector = async function () {
    const btn = document.querySelector('.audio-inspector .btn-dock-save');
    const originalText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    const payload = {
        TargetId: parseInt(document.getElementById('edit-target-id').value),
        TargetType: parseInt(document.getElementById('edit-target-type').value),
        Title: document.getElementById('edit-title').value,
        Visibility: parseInt(document.getElementById('edit-visibility').value),
        Price: parseFloat(document.getElementById('edit-price').value) || 0.00
    };

    try {
        const response = await fetch('/api/audiohub/update-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                "X-Session-Id": window.AuthState?.sessionId || ""
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            btn.innerText = "Saved!";
            btn.style.background = "#28a745";

            const userId = document.getElementById("audio-user-id").value;
            window.loadAudioHub(userId);

            setTimeout(() => {
                window.closeAudioInspector();
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