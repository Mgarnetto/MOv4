/* =========================================
   FOLLOW SERVICE
   Handles Follow/Unfollow logic
   ========================================= */

document.addEventListener('click', async (e) => {
    // 1. Check if the clicked element is our Follow Button
    const btn = e.target.closest('#btn-follow-action');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    // 2. Auth Check
    if (!window.AuthState || !window.AuthState.loggedIn) {
        // Trigger Login Dropdown if not logged in
        const toggle = document.getElementById('loginToggleBtn');
        if (toggle) toggle.click();
        return;
    }

    // 3. Prepare Data
    const userId = btn.getAttribute('data-id');
    const currentStatus = btn.getAttribute('data-status'); // 'following' or 'not-following'
    const isUnfollowing = currentStatus === 'following';

    // Prevent double clicks
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = "...";

    try {
        // 4. Determine Endpoint
        const endpoint = isUnfollowing
            ? `/api/creator/unfollow/${userId}`
            : `/api/creator/follow/${userId}`;

        const sid = window.AuthState.sessionId;

        // 5. Execute API Call
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': sid
            }
        });

        if (res.ok) {
            // 6. UI Update: Toggle Button Style & Text
            if (isUnfollowing) {
                // Now Not Following -> Blue Button
                btn.setAttribute('data-status', 'not-following');
                btn.className = "btn-login me-2"; // Solid Blue
                btn.innerText = "Follow";
                updateProfileStat(-1); // Decrease count
            } else {
                // Now Following -> Outline Button
                btn.setAttribute('data-status', 'following');
                btn.className = "btn-sidebar-outline me-2"; // Transparent/Gray
                btn.innerText = "Unfollow";
                updateProfileStat(1); // Increase count
            }

            // 7. SYNC SIDEBAR (My "Following" count changed)
            if (window.SidebarManager) {
                window.SidebarManager.updateProfile();
            }

        } else {
            // Revert on failure
            btn.innerText = originalText;
            console.error("Follow action failed");
        }
    } catch (err) {
        console.error("Follow error:", err);
        btn.innerText = originalText;
    } finally {
        btn.disabled = false;
    }
});

// Helper to update the number on the page immediately
function updateProfileStat(change) {
    const el = document.getElementById('profile-stat-followers');
    if (el) {
        let val = parseInt(el.innerText) || 0;
        val += change;
        if (val < 0) val = 0;
        el.innerText = val;
    }
}