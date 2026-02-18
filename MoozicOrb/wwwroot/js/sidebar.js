/* =========================================
   SIDEBAR MANAGER
   Handles population of profile data
   ========================================= */

const SidebarManager = {
    async init() {
        // Check if we have a session token
        // (Assuming AuthState stores this, or we check localStorage directly)
        const session = localStorage.getItem("moozic_session");

        if (session) {
            await this.updateProfile();
        }
    },

    async updateProfile() {
        try {
            const sidObj = JSON.parse(localStorage.getItem("moozic_session") || "{}");
            const sid = sidObj.sessionId;

            if (!sid) return;

            const res = await fetch("/api/creator/sidebar-info", {
                headers: { "X-Session-Id": sid }
            });

            if (res.ok) {
                const data = await res.json();

                // Populate DOM Elements
                const imgEl = document.getElementById("sidebar-img");
                const nameEl = document.getElementById("sidebar-name");
                const followersEl = document.getElementById("sidebar-followers");
                const followingEl = document.getElementById("sidebar-following");

                if (imgEl) imgEl.style.backgroundImage = `url('${data.pic}')`;
                if (nameEl) nameEl.innerText = data.name;
                if (followersEl) followersEl.innerHTML = `<strong>${data.followers}</strong> Followers`;
                if (followingEl) followingEl.innerHTML = `<strong>${data.following}</strong> Following`;
            }
        } catch (err) {
            console.error("Failed to update sidebar:", err);
        }
    },

    // --- NEW: Real-time SignalR Handler ---
    handleStatsUpdate(data) {
        // data = { userId, followers, following }

        // 1. Check if this update is for ME (The logged-in user)
        // If so, update the sidebar
        const session = JSON.parse(localStorage.getItem("moozic_session") || "{}");
        if (session && session.userId == data.userId) {
            const followersEl = document.getElementById("sidebar-followers");
            const followingEl = document.getElementById("sidebar-following");

            if (followersEl) followersEl.innerHTML = `<strong>${data.followers}</strong> Followers`;
            if (followingEl) followingEl.innerHTML = `<strong>${data.following}</strong> Following`;
        }

        // 2. Check if we are currently VIEWING this user's profile
        // If I am looking at User B's profile, and User C follows them,
        // I should see the number go up on the page header immediately.
        // We check the hidden input usually found in _ProfilePartial.cshtml
        const pageContext = document.getElementById("page-signalr-context"); // e.g. "user_105"

        if (pageContext && pageContext.value === `user_${data.userId}`) {
            const profileFollowers = document.getElementById("profile-stat-followers");
            const profileFollowing = document.getElementById("profile-stat-following");

            if (profileFollowers) profileFollowers.innerText = data.followers;
            if (profileFollowing) profileFollowing.innerText = data.following;
        }
    }
};

// Run on Load
document.addEventListener("DOMContentLoaded", () => {
    SidebarManager.init();
});

// Expose globally so Login-Init.js can call it after login
window.SidebarManager = SidebarManager;