/* =========================================
   CUSTOM VIDEO PLAYER CONTROLLER
   Handles all .custom-video-wrapper instances
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {

    // 1. CLICK HANDLING (Play/Pause, Fullscreen, Seek)
    document.body.addEventListener('click', (e) => {
        const wrapper = e.target.closest('.custom-video-wrapper');
        if (!wrapper) return;

        const video = wrapper.querySelector('video');

        // A. BIG OVERLAY BUTTON or VIDEO CLICK
        if (e.target.closest('.video-overlay-play') || e.target.classList.contains('custom-video')) {
            toggleVideo(video, wrapper);
        }

        // B. SMALL TOOLBAR PLAY BUTTON
        if (e.target.closest('.v-play-toggle')) {
            toggleVideo(video, wrapper);
        }

        // C. FULLSCREEN TOGGLE
        if (e.target.closest('.v-fullscreen-toggle')) {
            toggleFullscreen(wrapper);
        }

        // D. SEEK BAR CLICK
        if (e.target.closest('.v-progress-container')) {
            const container = e.target.closest('.v-progress-container');
            const rect = container.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
        }
    });

    // 2. VIDEO PROGRESS UPDATE
    document.addEventListener('timeupdate', (e) => {
        if (e.target.tagName === 'VIDEO' && e.target.classList.contains('custom-video')) {
            const video = e.target;
            const wrapper = video.closest('.custom-video-wrapper');
            if (wrapper) {
                const percent = (video.currentTime / video.duration) * 100;
                const fill = wrapper.querySelector('.v-progress-fill');
                if (fill) fill.style.width = `${percent}%`;
            }
        }
    }, true);

    // 3. VIDEO ENDED RESET
    document.addEventListener('ended', (e) => {
        if (e.target.tagName === 'VIDEO' && e.target.classList.contains('custom-video')) {
            const wrapper = e.target.closest('.custom-video-wrapper');
            wrapper.classList.remove('playing');
            const btnIcon = wrapper.querySelector('.v-play-toggle i');
            if (btnIcon) btnIcon.className = 'fas fa-play';

            // Show overlay again on end
            const overlay = wrapper.querySelector('.video-overlay-play');
            if (overlay) overlay.style.opacity = '1';
        }
    }, true);
});

// --- HELPERS ---

function toggleVideo(video, wrapper) {
    // 1. LAZY LOAD CHECK
    // If the video is hidden (thumb-mode), initialize it now.
    if (video.classList.contains('d-none')) {
        const dataSrc = video.getAttribute('data-src');
        if (dataSrc) {
            video.src = dataSrc;
            video.removeAttribute('data-src');
        }
        video.classList.remove('d-none');
        // We do NOT remove thumb-mode here yet; wait for play() success to avoid flicker
    }

    if (video.paused) {
        // Pause all other videos
        document.querySelectorAll('video').forEach(v => {
            if (v !== video) {
                v.pause();
                v.closest('.custom-video-wrapper')?.classList.remove('playing');
                const ov = v.closest('.custom-video-wrapper')?.querySelector('.video-overlay-play');
                if (ov) ov.style.opacity = '1';
            }
        });

        // 2. PLAY LOGIC
        video.play().then(() => {
            wrapper.classList.add('playing');

            // CLEANUP THUMBNAIL VISUALS
            wrapper.classList.remove('thumb-mode');
            wrapper.style.backgroundImage = 'none';

            // Update Icon
            const btnIcon = wrapper.querySelector('.v-play-toggle i');
            if (btnIcon) {
                btnIcon.classList.remove('fa-play');
                btnIcon.classList.add('fa-pause');
            }

            // Hide Big Overlay
            const overlay = wrapper.querySelector('.video-overlay-play');
            if (overlay) overlay.style.opacity = '0';

        }).catch(err => console.error("Play error:", err));

    } else {
        // 3. PAUSE LOGIC
        video.pause();
        wrapper.classList.remove('playing');

        const btnIcon = wrapper.querySelector('.v-play-toggle i');
        if (btnIcon) {
            btnIcon.classList.remove('fa-pause');
            btnIcon.classList.add('fa-play');
        }

        // Show Big Overlay when paused
        const overlay = wrapper.querySelector('.video-overlay-play');
        if (overlay) overlay.style.opacity = '1';
    }
}

function toggleFullscreen(wrapper) {
    if (!document.fullscreenElement) {
        if (wrapper.requestFullscreen) wrapper.requestFullscreen();
        else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

window.VideoPlayerService = {
    loadAndPlay: function (mediaId) {
        const wrapper = document.getElementById(`video-container-${mediaId}`);
        const video = document.getElementById(`vid-${mediaId}`);

        if (!video || !wrapper) return;

        // Ensure controls are visible
        const controls = wrapper.querySelector('.video-controls');
        if (controls) controls.classList.remove('d-none');

        // Reuse the main toggle logic to handle data-src swapping
        toggleVideo(video, wrapper);
    }
};