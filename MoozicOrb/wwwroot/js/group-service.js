/* GROUP SERVICE
   - Handles HTTP API calls for Group Management (CRUD)
   - Does NOT manage UI state (AuthState does that)
   - Does NOT handle real-time sockets (MessageService does that)
*/

(() => {
    const GroupService = {

        // Helper to get headers
        _getHeaders() {
            return {
                'Content-Type': 'application/json',
                'X-Session-Id': window.AuthState?.sessionId || ''
            };
        },

        // 1. CREATE GROUP
        async createGroup(name, initialMemberIds = []) {
            if (!name) return null;
            try {
                // FIX: Changed keys to camelCase (name, initialMemberIds)
                // This ensures ASP.NET Core correctly binds the InitialMemberIds list.
                const res = await fetch('/api/groups/create', {
                    method: 'POST',
                    headers: this._getHeaders(),
                    body: JSON.stringify({ name: name, initialMemberIds: initialMemberIds })
                });

                if (res.ok) {
                    const group = await res.json(); // Returns { groupId, name }
                    return group;
                } else {
                    const err = await res.text();
                    console.warn("[GroupService] Creation failed:", err);
                    alert("Failed to create group: " + err);
                }
            } catch (err) {
                console.error("[GroupService] Error:", err);
            }
            return null;
        },

        // 2. GET MY GROUPS 
        // (Called by AuthState.bootstrap or Sidebar refresh)
        async getMyGroups() {
            try {
                const res = await fetch('/api/groups/mine', {
                    headers: this._getHeaders()
                });
                if (res.ok) return await res.json();
            } catch (err) { console.error(err); }
            return [];
        },

        // 3. GET MEMBERS OF A GROUP
        // (Useful for "Group Info" modals later)
        async getMembers(groupId) {
            try {
                const res = await fetch(`/api/groups/${groupId}/members`, {
                    headers: this._getHeaders()
                });
                if (res.ok) return await res.json();
            } catch (err) { console.error(err); }
            return [];
        },

        // 4. ADD MEMBER
        async addMember(groupId, userId) {
            try {
                const res = await fetch(`/api/groups/${groupId}/members/add`, {
                    method: 'POST',
                    headers: this._getHeaders(),
                    body: JSON.stringify({ UserId: parseInt(userId) })
                });
                return res.ok;
            } catch (err) { return false; }
        },

        // 5. REMOVE MEMBER
        async removeMember(groupId, userId) {
            try {
                const res = await fetch(`/api/groups/${groupId}/members/remove`, {
                    method: 'POST',
                    headers: this._getHeaders(),
                    body: JSON.stringify({ UserId: parseInt(userId) })
                });
                return res.ok;
            } catch (err) { return false; }
        },

        // 6. RENAME GROUP (Admin/Owner)
        async renameGroup(groupId, newName) {
            try {
                const res = await fetch(`/api/groups/${groupId}`, {
                    method: 'PUT',
                    headers: this._getHeaders(),
                    body: JSON.stringify({ name: newName })
                });
                return res.ok;
            } catch (err) { return false; }
        },

        // 7. SET MEMBER ROLE (Promote/Demote)
        async setMemberRole(groupId, userId, role) {
            // Role: 0 = Member, 2 = Admin
            try {
                const res = await fetch(`/api/groups/${groupId}/members/${userId}/role`, {
                    method: 'PATCH',
                    headers: this._getHeaders(),
                    body: JSON.stringify({ role: parseInt(role) })
                });
                return res.ok;
            } catch (err) { return false; }
        },

        // 8. DELETE GROUP (Owner Only)
        async deleteGroup(groupId) {
            try {
                const res = await fetch(`/api/groups/${groupId}`, {
                    method: 'DELETE',
                    headers: this._getHeaders()
                });
                return res.ok;
            } catch (err) { return false; }
        }
    };

    // Expose to Window
    window.GroupService = GroupService;
})();