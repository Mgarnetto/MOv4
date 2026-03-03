// ============================================
// AUDIO CAROUSEL MANAGER (DOCK TOGGLE)
// ============================================
window.isAudioCarouselManagerActive = false;

window.toggleAudioCarouselManager = function () {
    window.isAudioCarouselManagerActive = !window.isAudioCarouselManagerActive;
    const btn = document.getElementById('btnToggleAudioCarouselManager');
    const dock = document.getElementById('audioCarouselManagerDock');

    // Grab the main audio wrapper to adjust its height
    const mainContainer = document.querySelector('.audio-container');

    if (window.isAudioCarouselManagerActive) {
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

        // Trigger the visual carousel renderer
        window.loadAudioCarousel(userId);

        if (isOwner) {
            fetch(`/api/collections/user/${userId}/context/ProfileCarousel`, { headers })
                .then(res => res.ok ? res.json() : [])
                .then(collections => {
                    if (collections && collections.length > 0) {
                        const colId = collections[0].id || collections[0].Id;
                        document.getElementById('audioCarouselCollectionId').value = colId;

                        fetch(`/api/collections/${colId}`, { headers })
                            .then(res => res.ok ? res.json() : null)
                            .then(details => {
                                if (details) {
                                    const items = details.items || details.Items || [];
                                    items.forEach(item => {
                                        const art = item.artUrl || item.ArtUrl || '/img/default_cover.jpg';
                                        const targetId = item.targetId || item.TargetId;
                                        const targetType = item.targetType !== undefined ? item.targetType : item.TargetType;
                                        const title = item.title || item.Title || "Untitled";

                                        window.addToAudioCarouselDock(targetId, targetType, title, art, true);
                                    });
                                }
                            });
                    }
                });
        }
    } catch (err) {
        console.error("Error loading Audio Hub data:", err);
    }
};

// ============================================
// AUDIO CAROUSEL: VISUAL RENDERER & FALLBACK
// ============================================
window.loadAudioCarousel = async function (userId) {
    const container = document.getElementById('audio-carousel-container');
    if (!container) return;

    try {
        const headers = { "X-Session-Id": window.AuthState?.sessionId || "" };

        const existRes = await fetch(`/api/collections/user/${userId}/context/ProfileCarousel`, { headers });
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
            renderAudioCarouselUI(customItems, false);
        } else {
            const fallbackRes = await fetch(`/api/audiohub/orphans/${userId}`, { headers });
            if (fallbackRes.ok) {
                const orphanData = await fallbackRes.json();
                const orphans = orphanData.items || orphanData.Items || [];

                if (orphans.length > 0) {
                    const top10 = orphans.slice(0, 10);
                    renderAudioCarouselUI(top10, true);
                } else {
                    container.innerHTML = '';
                }
            }
        }
    } catch (err) {
        console.error("Error loading audio carousel:", err);
        container.innerHTML = '';
    }
};

function renderAudioCarouselUI(items, isFallback) {
    const container = document.getElementById('audio-carousel-container');
    if (!container) return;

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px;">
            <h4 style="color:white; margin: 0; font-weight: 700;">${isFallback ? 'Recent Uploads' : 'Featured Audio'}</h4>
            <div style="display: flex; gap: 10px;">
                <button onclick="document.getElementById('audio-carousel-track').scrollBy({left: -250, behavior: 'smooth'})" style="background: #1a1a1a; border: 1px solid #333; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fas fa-chevron-left"></i></button>
                <button onclick="document.getElementById('audio-carousel-track').scrollBy({left: 250, behavior: 'smooth'})" style="background: #1a1a1a; border: 1px solid #333; color: white; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; display: flex; align-items: center; justify-content: center;"><i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
        <div id="audio-carousel-track" style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 15px; scrollbar-width: none; scroll-behavior: smooth;">
    `;

    items.forEach(item => {
        const title = item.title || item.Title || "Untitled Track";
        const encodedTitle = encodeURIComponent(title);
        const artist = item.artistName || item.ArtistName || "Unknown Artist";
        const encodedArtist = encodeURIComponent(artist);
        const art = item.artUrl || item.ArtUrl || '/img/default_cover.jpg';
        const url = item.url || item.Url || '';

        html += `
            <div style="flex: 0 0 200px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; overflow: hidden; position: relative; cursor: pointer; transition: transform 0.2s;" 
                 onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'"
                 onclick="if(window.AudioPlayer) window.AudioPlayer.playTrack('${url}', { title: decodeURIComponent('${encodedTitle}'), artist: decodeURIComponent('${encodedArtist}'), cover: '${art}' });">
                
                <div style="position: relative; width: 100%; height: 200px;">
                    <img src="${art}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                        <i class="fas fa-play-circle" style="color: white; font-size: 4rem; text-shadow: 0 2px 5px rgba(0,0,0,0.8);"></i>
                    </div>
                </div>
                <div style="padding: 12px; text-align: center;">
                    <div style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title.replace(/"/g, '&quot;')}">${title}</div>
                    <div style="color: #888; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${artist.replace(/"/g, '&quot;')}">${artist}</div>
                </div>
            </div>
        `;
    });

    html += `</div>
    <style>#audio-carousel-track::-webkit-scrollbar { display: none; }</style>`;

    container.innerHTML = html;
}

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

        const rawArtist = item.artistName || item.ArtistName || "Unknown Artist";
        const encodedArtist = encodeURIComponent(rawArtist);

        const art = item.artUrl || item.ArtUrl || '/img/default_cover.jpg';
        const targetId = item.targetId || item.TargetId;
        const rawUrl = item.url || item.Url || '';

        const rowCursor = !isOwner ? 'cursor: pointer;' : '';

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
                    <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                        <button style="background: transparent; border: 1px solid #0dcaf0; color: #0dcaf0; border-radius: 4px; padding: 4px 8px; cursor: pointer; margin-right: 8px; transition: background 0.2s;" onmouseover="this.style.background='rgba(13, 202, 240, 0.1)'" onmouseout="this.style.background='transparent'" onclick="window.addToAudioCarouselDock(${targetId}, 1, decodeURIComponent('${encodedTitle}'), '${art}')" title="Add to Carousel"><i class="fas fa-star"></i></button>
                        
                        <div style="position: relative; display: flex; align-items: center;">
                            <button class="msg-options-btn" style="background: transparent; border: none; color: #ccc; padding: 6px; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#ccc'" onclick="toggleAudioMenu('audio-menu-${targetId}')">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            
                            <div id="audio-menu-${targetId}" class="msg-context-menu" style="position: absolute; right: 0; top: 100%; margin-top: 5px; width: max-content; text-align: left; z-index: 1050;">
                                <button onclick="window.openAudioInspector(${targetId}, 1, '${encodedTitle}', ${price || 0}, ${visState}, ${isLocked})" style="background: transparent; border: none; padding: 8px 12px; width: 100%; text-align: left; color: #fff; cursor: pointer;">
                                    <i class="fas fa-edit" style="margin-right: 8px;"></i> Edit Details
                                </button>
                                
                                ${!isLocked ? `
                                <button class="text-danger track-delete-btn" style="background: transparent; border: none; padding: 8px 12px; width: 100%; text-align: left; color: #ff0055; cursor: pointer;" onclick="window.twoStepDeleteTrack(this, ${targetId})">
                                    <i class="fas fa-trash" style="margin-right: 8px;"></i> Delete Track
                                </button>
                                ` : `
                                <button class="text-muted" style="background: transparent; border: none; padding: 8px 12px; width: 100%; text-align: left; color: #6c757d; cursor: not-allowed;" title="Item is locked/sold">
                                    <i class="fas fa-lock" style="margin-right: 8px;"></i> Locked
                                </button>
                                `}
                            </div>
                        </div>
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

        const lockIcon = isLocked ? '<i class="fas fa-lock" style="color: #ffc107; margin-left: 6px;"></i>' : '';
        const priceDisplay = price > 0 ? `$${price.toFixed(2)}` : 'Free';

        const visState = visibility !== undefined && visibility !== null ? parseInt(visibility) : 0;

        let statusIcon = '';
        if (visState === 0) statusIcon = '<i class="fas fa-globe" style="color: #0d6efd;" title="Public"></i>';
        else if (visState === 1) statusIcon = '<i class="fas fa-link" style="color: #0dcaf0;" title="Link Only"></i>';
        else statusIcon = '<i class="fas fa-lock" style="color: #6c757d;" title="Private"></i>';

        const rawTitle = album.title || album.Title || "Untitled Album";
        const encodedTitle = encodeURIComponent(rawTitle);

        const rawArtist = album.artistName || album.ArtistName || "Unknown Artist";
        const encodedArtist = encodeURIComponent(rawArtist);

        const art = album.coverImageUrl || album.CoverImageUrl || '/img/default_cover.jpg';
        const id = album.id || album.Id;
        const rawUrl = album.url || album.Url || '';

        const cardCursor = 'cursor: pointer;';
        const cardClickEvent = `onclick="window.openAlbumView(${id}, '${encodedTitle}', '${art}', ${isOwner})"`;

        // COMPLETELY BOOTSTRAP FREE GRID CARD WITH PROPER FLEX ALIGNMENT
        html += `
            <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; transition: transform 0.2s; ${cardCursor} display: flex; flex-direction: column;" class="album-card-hover" ${cardClickEvent}>
                <div style="position: relative; padding-top: 100%; border-radius: 8px 8px 0 0; overflow: hidden;">
                    <img src="${art}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">
                     <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'"><i class="fas fa-list" style="color: white; font-size: 2rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);"></i></div>
                </div>
                <div style="padding: 15px; display: flex; flex-direction: column; flex-grow: 1;">
                    <div style="color: white; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px;" title="${rawTitle}">${rawTitle}</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; margin-bottom: 10px;">
                        <span style="color: #28a745; font-weight: bold;">${priceDisplay}</span>
                        <span>${statusIcon} ${lockIcon}</span>
                    </div>
                    
                    ${isOwner ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2; margin-top: auto;">
                            <button style="flex-grow: 1; background: transparent; border: 1px solid #0dcaf0; color: #0dcaf0; border-radius: 4px; padding: 6px 12px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(13, 202, 240, 0.1)'" onmouseout="this.style.background='transparent'" onclick="event.stopPropagation(); window.addToAudioCarouselDock(${id}, 0, decodeURIComponent('${encodedTitle}'), '${art}')" title="Add to Carousel"><i class="fas fa-star"></i></button>
                            
                            <div style="position: relative; display: flex; align-items: center; margin-left: 8px;">
                                <button class="msg-options-btn" style="background: transparent; border: none; color: #ccc; padding: 6px 10px; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#ccc'" onclick="toggleAudioMenu('album-menu-${id}')">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                
                                <div id="album-menu-${id}" class="msg-context-menu" style="position: absolute; right: 0; bottom: 100%; margin-bottom: 5px; width: max-content; text-align: left; z-index: 1050;">
                                    <button onclick="event.stopPropagation(); window.openAudioInspector(${id}, 0, '${encodedTitle}', ${price || 0}, ${visState}, ${isLocked})" style="background: transparent; border: none; padding: 8px 12px; width: 100%; text-align: left; color: #fff; cursor: pointer;">
                                        <i class="fas fa-edit" style="margin-right: 8px;"></i> Edit Details
                                    </button>
                                    
                                    ${!isLocked ? `
                                    <button class="text-danger track-delete-btn" style="background: transparent; border: none; padding: 8px 12px; width: 100%; text-align: left; color: #ff0055; cursor: pointer;" onclick="window.twoStepDeleteAlbum(this, ${id})">
                                        <i class="fas fa-trash" style="margin-right: 8px;"></i> Delete Album
                                    </button>
                                    ` : `
                                    <button class="text-muted" style="background: transparent; border: none; padding: 8px 12px; width: 100%; text-align: left; color: #6c757d; cursor: not-allowed;" title="Item is locked/sold">
                                        <i class="fas fa-lock" style="margin-right: 8px;"></i> Locked
                                    </button>
                                    `}
                                </div>
                            </div>
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
// AUDIO MENU & DELETION LOGIC (NEW)
// ============================================

// Toggle the 3-dot menu safely
window.toggleAudioMenu = function (menuId) {
    document.querySelectorAll('.msg-context-menu.active').forEach(menu => {
        if (menu.id !== menuId) menu.classList.remove('active');
    });

    const menu = document.getElementById(menuId);
    if (menu) {
        if (window.event) window.event.stopPropagation();
        menu.classList.toggle('active');
    }
};

// Close menus when clicking outside
document.addEventListener('click', function (e) {
    if (!e.target.closest('.msg-options-btn') && !e.target.closest('.msg-context-menu')) {
        document.querySelectorAll('.msg-context-menu.active').forEach(m => m.classList.remove('active'));
    }
});

// The 2-Step Deletion Logic
window.twoStepDeleteTrack = async function (btnElement, trackId) {
    if (window.event) window.event.stopPropagation();

    if (!btnElement.classList.contains('confirming-delete')) {
        btnElement.classList.add('confirming-delete');
        btnElement.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Confirm Delete?`;
        btnElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

        setTimeout(() => {
            if (btnElement) {
                btnElement.classList.remove('confirming-delete');
                btnElement.innerHTML = `<i class="fas fa-trash" style="margin-right: 8px;"></i> Delete Track`;
                btnElement.style.backgroundColor = 'transparent';
            }
        }, 4000);
        return;
    }

    btnElement.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Deleting...`;
    btnElement.disabled = true;

    try {
        const response = await fetch(`/api/media/audio/${trackId}`, {
            method: 'DELETE',
            headers: {
                "X-Session-Id": window.AuthState?.sessionId || ""
            }
        });

        if (response.ok) {
            const userId = document.getElementById("audio-user-id")?.value || window.AuthState?.userId;
            if (userId) window.loadAudioHub(userId);
        } else {
            const errText = await response.text();
            alert("Delete failed: " + errText);
            btnElement.disabled = false;
        }
    } catch (e) {
        console.error("Error deleting track:", e);
        alert("Network error occurred.");
        btnElement.disabled = false;
    }
};

window.twoStepDeleteAlbum = async function (btnElement, albumId) {
    if (window.event) window.event.stopPropagation();

    if (!btnElement.classList.contains('confirming-delete')) {
        btnElement.classList.add('confirming-delete');
        btnElement.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Confirm Delete?`;
        btnElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

        setTimeout(() => {
            if (btnElement) {
                btnElement.classList.remove('confirming-delete');
                btnElement.innerHTML = `<i class="fas fa-trash" style="margin-right: 8px;"></i> Delete Album`;
                btnElement.style.backgroundColor = 'transparent';
            }
        }, 4000);
        return;
    }

    btnElement.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Deleting...`;
    btnElement.disabled = true;

    try {
        const response = await fetch(`/api/collections/${albumId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (response.ok) {
            const userId = document.getElementById("audio-user-id")?.value || window.AuthState?.userId;
            if (userId) window.loadAudioHub(userId);
        } else {
            alert("Delete failed: Cannot delete locked albums.");
            btnElement.disabled = false;
        }
    } catch (e) {
        console.error("Error deleting album:", e);
        btnElement.disabled = false;
    }
};

window.twoStepRemoveTrackFromAlbum = async function (btnElement, linkId, albumId) {
    if (window.event) window.event.stopPropagation();

    if (!btnElement.classList.contains('confirming-delete')) {
        btnElement.classList.add('confirming-delete');
        btnElement.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Confirm Remove?`;
        btnElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

        setTimeout(() => {
            if (btnElement) {
                btnElement.classList.remove('confirming-delete');
                btnElement.innerHTML = `<i class="fas fa-trash" style="margin-right: 8px;"></i> Remove Track`;
                btnElement.style.backgroundColor = 'transparent';
            }
        }, 4000);
        return;
    }

    btnElement.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Removing...`;
    btnElement.disabled = true;

    try {
        const response = await fetch(`/api/collections/items/${linkId}?collectionId=${albumId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (response.ok) {
            const coverUrl = document.getElementById('albumViewCover').src;
            const encodedTitle = encodeURIComponent(document.getElementById('albumViewTitle').innerText);
            window.openAlbumView(albumId, encodedTitle, coverUrl, true);
        } else {
            const err = await response.text();
            alert("Failed to remove track: " + err);
            btnElement.disabled = false;
        }
    } catch (e) {
        console.error("Error removing track:", e);
        btnElement.disabled = false;
    }
};

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
        Title: "Featured Audio",
        Description: "My featured audio tracks",
        Type: 6,
        DisplayContext: "ProfileCarousel",
        CoverImageId: 0,
        Items: itemsToSave
    };

    const headers = {
        "Content-Type": "application/json",
        "X-Session-Id": window.AuthState?.sessionId || ""
    };

    try {
        const response = await fetch('/api/collections/create', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            document.getElementById('audioCarouselCollectionId').value = result.id;

            if (btn) {
                btn.innerText = "Saved!";
                btn.style.background = "#28a745";

                const userId = document.getElementById("audio-user-id")?.value || window.AuthState?.userId;
                if (userId) window.loadAudioCarousel(userId);

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
        const response = await fetch('/api/audiohub/metadata', {
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

// ============================================
// AUDIO HUB: BATCH UPLOAD & DRAG/DROP
// ============================================

window.toggleAudioDropzone = function () {
    const wizard = document.getElementById('audio-dropzone-wizard');
    if (wizard) {
        wizard.classList.toggle('d-none');
    }
};

window.handleBatchAudioSelect = async function (eventOrInput) {
    const input = eventOrInput.target ? eventOrInput.target : eventOrInput;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    const maxFiles = 20;

    const queueContainer = document.getElementById('batch-upload-queue');

    if (files.length > maxFiles) {
        if (queueContainer) queueContainer.innerHTML = `<div style="color: #ff0055;"><i class="fas fa-exclamation-circle" style="margin-right: 8px;"></i> Max ${maxFiles} tracks allowed at once.</div>`;
        input.value = '';
        return;
    }

    if (queueContainer) {
        queueContainer.innerHTML = `<div style="color: #0dcaf0; font-weight: bold;"><i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Securing ${files.length} tracks to your Vault...</div>`;
    }

    const formData = new FormData();
    files.forEach(file => {
        if (file.type.startsWith('audio/')) {
            formData.append("files", file);
        }
    });

    try {
        const response = await fetch('/api/upload/audio/batch', {
            method: 'POST',
            headers: {
                "X-Session-Id": window.AuthState?.sessionId || ""
            },
            body: formData
        });

        if (response.ok) {
            const result = await response.json();

            if (queueContainer) {
                queueContainer.innerHTML = `<div style="color: #28a745; font-weight: bold;"><i class="fas fa-check-circle" style="margin-right: 8px;"></i> Successfully secured ${result.items ? result.items.length : files.length} tracks!</div>`;
            }

            const userId = document.getElementById("audio-user-id")?.value || window.AuthState?.userId;
            if (userId) {
                window.loadAudioHub(userId);
            }

            setTimeout(() => {
                window.toggleAudioDropzone();
                if (queueContainer) queueContainer.innerHTML = '';
            }, 2500);

        } else {
            const errText = await response.text();
            if (queueContainer) {
                queueContainer.innerHTML = `<div style="color: #ff0055;"><i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Upload failed: ${errText}</div>`;
            }
        }
    } catch (err) {
        console.error("Batch upload error:", err);
        if (queueContainer) {
            queueContainer.innerHTML = `<div style="color: #ff0055;"><i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> An error occurred during the batch upload.</div>`;
        }
    } finally {
        input.value = '';
    }
};

window.initAudioDragAndDrop = function () {
    const dropZone = document.getElementById('audio-dropzone-wizard');
    const fileInput = document.getElementById('batchAudioInput');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#0dcaf0";
        dropZone.style.backgroundColor = "rgba(0, 210, 255, 0.05)";
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#555";
        dropZone.style.backgroundColor = "#1a1a1a";
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#555";
        dropZone.style.backgroundColor = "#1a1a1a";

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            window.handleBatchAudioSelect(fileInput);
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    window.initAudioDragAndDrop();
});

// ============================================
// ALBUM BUILDER LOGIC (TYPE 7 COLLECTIONS)
// ============================================

window.albumAvailableTracks = [];
window.albumSelectedTracks = [];
window.albumCoverFile = null;

window.openAlbumBuilderModal = async function () {
    const modal = document.getElementById('albumBuilderModal');
    if (!modal) return;

    window.albumAvailableTracks = [];
    window.albumSelectedTracks = [];
    window.albumCoverFile = null;
    document.getElementById('albumTitleInput').value = '';
    document.getElementById('albumDescInput').value = '';
    document.getElementById('albumCoverInput').value = '';
    document.getElementById('albumCoverImg').src = '';
    document.getElementById('albumCoverImg').classList.add('d-none');
    document.getElementById('albumCoverIcon').classList.remove('d-none');
    document.getElementById('album-track-count').innerText = "0";

    document.getElementById('album-available-tracks').innerHTML = '<div style="text-align: center; color: #6c757d; margin-top: 1.5rem;"><i class="fas fa-spinner fa-spin"></i></div>';
    document.getElementById('album-selected-tracks').innerHTML = '<div style="text-align: center; color: #6c757d; margin-top: 100px; font-size: 0.85rem;">Click \'+\' on a track to add it</div>';

    modal.classList.remove('d-none');

    const userId = document.getElementById("audio-user-id").value;
    try {
        const res = await fetch(`/api/audiohub/orphans/${userId}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });
        if (res.ok) {
            const data = await res.json();
            window.albumAvailableTracks = data.items || data.Items || [];
            window.renderAlbumBuilderLists();
        }
    } catch (e) {
        console.error("Failed to load tracks for builder", e);
    }
};

window.closeAlbumBuilderModal = function () {
    document.getElementById('albumBuilderModal').classList.add('d-none');
};

window.previewAlbumCover = function (input) {
    if (input.files && input.files[0]) {
        window.albumCoverFile = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('albumCoverImg');
            img.src = e.target.result;
            img.classList.remove('d-none');
            document.getElementById('albumCoverIcon').classList.add('d-none');
        }
        reader.readAsDataURL(input.files[0]);
    }
};

window.renderAlbumBuilderLists = function () {
    const availContainer = document.getElementById('album-available-tracks');
    const selContainer = document.getElementById('album-selected-tracks');
    document.getElementById('album-track-count').innerText = window.albumSelectedTracks.length;

    if (window.albumAvailableTracks.length === 0) {
        availContainer.innerHTML = '<div style="text-align: center; color: #6c757d; margin-top: 1.5rem; font-size:0.85rem;">No tracks available in Vault.</div>';
    } else {
        let availHtml = '';
        window.albumAvailableTracks.forEach(track => {
            const title = track.title || track.Title || "Untitled";
            const tId = track.targetId || track.TargetId;
            availHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #121212; padding: 8px 10px; border-radius: 4px; margin-bottom: 5px; border: 1px solid #222;">
                    <span style="color: #fff; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px;">${title}</span>
                    <button onclick="window.moveToAlbum(${tId})" style="background: #28a745; border: none; color: white; border-radius: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;"><i class="fas fa-plus" style="font-size: 10px;"></i></button>
                </div>
            `;
        });
        availContainer.innerHTML = availHtml;
    }

    if (window.albumSelectedTracks.length === 0) {
        selContainer.innerHTML = '<div style="text-align: center; color: #6c757d; margin-top: 100px; font-size: 0.85rem;">Click \'+\' on a track to add it</div>';
    } else {
        let selHtml = '';
        window.albumSelectedTracks.forEach((track, index) => {
            const title = track.title || track.Title || "Untitled";
            const tId = track.targetId || track.TargetId;
            selHtml += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(40, 167, 69, 0.1); padding: 8px 10px; border-radius: 4px; margin-bottom: 5px; border: 1px solid rgba(40, 167, 69, 0.3);">
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                        <span style="color: #28a745; font-size: 0.75rem; font-weight: bold;">${index + 1}.</span>
                        <span style="color: #fff; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">${title}</span>
                    </div>
                    <button onclick="window.removeFromAlbum(${tId})" style="background: #dc3545; border: none; color: white; border-radius: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer;"><i class="fas fa-minus" style="font-size: 10px;"></i></button>
                </div>
            `;
        });
        selContainer.innerHTML = selHtml;
    }
};

window.moveToAlbum = function (trackId) {
    const trackIndex = window.albumAvailableTracks.findIndex(t => (t.targetId || t.TargetId) === trackId);
    if (trackIndex > -1) {
        const track = window.albumAvailableTracks.splice(trackIndex, 1)[0];
        window.albumSelectedTracks.push(track);
        window.renderAlbumBuilderLists();
    }
};

window.removeFromAlbum = function (trackId) {
    const trackIndex = window.albumSelectedTracks.findIndex(t => (t.targetId || t.TargetId) === trackId);
    if (trackIndex > -1) {
        const track = window.albumSelectedTracks.splice(trackIndex, 1)[0];
        window.albumAvailableTracks.push(track);
        window.renderAlbumBuilderLists();
    }
};

window.saveNewAlbum = async function () {
    const title = document.getElementById('albumTitleInput').value.trim();
    const desc = document.getElementById('albumDescInput').value.trim();

    if (!title) {
        alert("Please enter an Album Title.");
        return;
    }
    if (window.albumSelectedTracks.length === 0) {
        alert("Please add at least one track to the album.");
        return;
    }

    const btn = document.getElementById('btnSaveAlbum');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Saving...';
    btn.disabled = true;

    try {
        let coverImageId = 0;

        if (window.albumCoverFile) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Uploading Art...';
            const imgData = new FormData();
            imgData.append("file", window.albumCoverFile);

            const imgRes = await fetch("/api/upload/image", {
                method: 'POST',
                headers: { 'X-Session-Id': window.AuthState?.sessionId || '' },
                body: imgData
            });

            if (imgRes.ok) {
                const mediaResult = await imgRes.json();
                coverImageId = mediaResult.id;
            } else {
                alert("Cover art upload failed. Saving without art.");
            }
        }

        const itemsPayload = window.albumSelectedTracks.map((track, index) => ({
            TargetId: parseInt(track.targetId || track.TargetId),
            TargetType: 1,
            SortOrder: index
        }));

        const payload = {
            Title: title,
            Description: desc,
            Type: 7,
            DisplayContext: "album",
            CoverImageId: coverImageId,
            Items: itemsPayload
        };

        btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Creating Album...';

        const createRes = await fetch('/api/collections/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': window.AuthState?.sessionId || ''
            },
            body: JSON.stringify(payload)
        });

        if (createRes.ok) {
            btn.innerHTML = 'Success!';
            btn.style.background = '#20c997';

            setTimeout(() => {
                window.closeAlbumBuilderModal();
                btn.innerHTML = 'Create Album';
                btn.style.background = '#28a745';
                btn.disabled = false;

                const userId = document.getElementById("audio-user-id")?.value || window.AuthState?.userId;
                if (userId) window.loadAudioHub(userId);
            }, 1000);

        } else {
            const err = await createRes.text();
            alert("Failed to save album: " + err);
            btn.innerHTML = 'Create Album';
            btn.disabled = false;
        }

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
        btn.innerHTML = 'Create Album';
        btn.disabled = false;
    }
};

// ============================================
// ALBUM VIEWER (TRACKLIST & PLAYBACK)
// ============================================

window.currentAlbumTracks = [];

window.openAlbumView = async function (albumId, encodedTitle, coverUrl, isOwner = false) {
    const modal = document.getElementById('albumViewModal');
    document.getElementById('albumViewTitle').innerText = decodeURIComponent(encodedTitle);
    document.getElementById('albumViewCover').src = coverUrl;
    const trackListContainer = document.getElementById('albumViewTracklist');

    trackListContainer.innerHTML = '<div style="text-align: center; padding: 3rem 0;"><i class="fas fa-spinner fa-spin fa-2x" style="color: #6c757d;"></i></div>';
    modal.classList.remove('d-none');

    try {
        const res = await fetch(`/api/collections/${albumId}`, {
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (res.ok) {
            const data = await res.json();
            const items = data.items || data.Items || [];
            window.currentAlbumTracks = items;

            if (items.length === 0) {
                trackListContainer.innerHTML = '<div style="color: #6c757d; text-align: center; padding: 3rem 0;">This album is empty.</div>';
                return;
            }

            let html = '';
            items.forEach((item, index) => {
                const title = item.title || item.Title || "Untitled";
                const url = item.url || item.Url;
                const artist = item.artistName || item.ArtistName || "Unknown";
                const linkId = item.linkId || item.LinkId;

                const safeTitle = title.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                const safeArtist = artist.replace(/'/g, "\\'").replace(/"/g, '&quot;');

                html += `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px 20px; border-bottom: 1px solid #1a1a1a; transition: background 0.2s;" 
                         onmouseover="this.style.background='#1a1a1a'" onmouseout="this.style.background='transparent'">
                        
                        <div style="display: flex; align-items: center; gap: 15px; flex-grow: 1; cursor: pointer;" onclick="if(window.AudioPlayer) window.AudioPlayer.playTrack('${url}', { title: '${safeTitle}', artist: '${safeArtist}', cover: '${coverUrl}' });">
                            <i class="fas fa-play" style="color: #0dcaf0; font-size: 0.9rem; opacity: 0.7;"></i>
                            <span style="color: #666; font-size: 0.9rem; width: 20px; text-align: right; font-weight: bold;">${index + 1}.</span>
                            <div style="color: #fff; font-weight: 500; font-size: 0.95rem;">${title}</div>
                        </div>

                        <div style="display:flex; align-items:center;">
                            ${isOwner ? `
                                <div style="position: relative; display: flex; align-items: center;">
                                    <button class="msg-options-btn" style="background: transparent; border: none; color: #ccc; padding: 0 10px; cursor: pointer;" onclick="toggleAudioMenu('album-track-menu-${linkId}')">
                                        <i class="fas fa-ellipsis-v"></i>
                                    </button>
                                    
                                    <div id="album-track-menu-${linkId}" class="msg-context-menu" style="position: absolute; right: 0; top: 100%; margin-top: 5px; width: max-content; text-align: left; z-index: 1050;">
                                        <button class="track-delete-btn" style="background: transparent; border: none; padding: 8px 12px; width: 100%; text-align: left; color: #ff0055; cursor: pointer;" onclick="window.twoStepRemoveTrackFromAlbum(this, ${linkId}, ${albumId})">
                                            <i class="fas fa-trash" style="margin-right: 8px;"></i> Remove Track
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
            trackListContainer.innerHTML = html;
        }
    } catch (e) {
        console.error("Failed to load album tracks", e);
        trackListContainer.innerHTML = '<div style="color: #ff0055; text-align: center; padding: 3rem 0;">Failed to load tracklist.</div>';
    }
};

window.twoStepRemoveTrackFromAlbum = async function (btnElement, linkId, albumId) {
    if (window.event) window.event.stopPropagation();

    if (!btnElement.classList.contains('confirming-delete')) {
        btnElement.classList.add('confirming-delete');
        btnElement.innerHTML = `<i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i> Confirm Remove?`;
        btnElement.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';

        setTimeout(() => {
            if (btnElement) {
                btnElement.classList.remove('confirming-delete');
                btnElement.innerHTML = `<i class="fas fa-trash" style="margin-right: 8px;"></i> Remove Track`;
                btnElement.style.backgroundColor = 'transparent';
            }
        }, 4000);
        return;
    }

    btnElement.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i> Removing...`;
    btnElement.disabled = true;

    try {
        const response = await fetch(`/api/collections/items/${linkId}?collectionId=${albumId}`, {
            method: 'DELETE',
            headers: { "X-Session-Id": window.AuthState?.sessionId || "" }
        });

        if (response.ok) {
            const coverUrl = document.getElementById('albumViewCover').src;
            const encodedTitle = encodeURIComponent(document.getElementById('albumViewTitle').innerText);
            window.openAlbumView(albumId, encodedTitle, coverUrl, true);
        } else {
            const err = await response.text();
            alert("Failed to remove track: " + err);
            btnElement.disabled = false;
        }
    } catch (e) {
        console.error("Error removing track:", e);
        btnElement.disabled = false;
    }
};

window.closeAlbumView = function () {
    document.getElementById('albumViewModal').classList.add('d-none');
};

window.playEntireAlbum = function () {
    if (window.currentAlbumTracks && window.currentAlbumTracks.length > 0) {
        const firstTrack = window.currentAlbumTracks[0];
        const url = firstTrack.url || firstTrack.Url;
        const title = (firstTrack.title || firstTrack.Title || "Untitled").replace(/'/g, "\\'");
        const artist = (firstTrack.artistName || firstTrack.ArtistName || "Unknown").replace(/'/g, "\\'");
        const cover = document.getElementById('albumViewCover').src;

        if (window.AudioPlayer && typeof window.AudioPlayer.playTrack === 'function') {
            window.AudioPlayer.playTrack(url, { title: title, artist: artist, cover: cover });
        }
    }
};