using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;

namespace MoozicOrb.API.Controllers
{
    [ApiController]
    [Route("api/groups")]
    public class GroupsController : ControllerBase
    {
        private readonly IHttpContextAccessor _http;
        private readonly NotificationService _notifier;

        public GroupsController(IHttpContextAccessor http, NotificationService notifier)
        {
            _http = http;
            _notifier = notifier;
        }

        private int GetUserId()
        {
            var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
            var session = SessionStore.GetSession(sid);
            if (session == null) return 0;
            return session.UserId;
        }

        // 1. GET MY GROUPS (For Sidebar)
        [HttpGet("mine")]
        public IActionResult GetMyGroups()
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();

            var groups = new MessageGroupQuery().GetGroupsForUser(uid);
            return Ok(groups);
        }

        // 2. GET MEMBERS (For Group Info Screen)
        [HttpGet("{id}/members")]
        public IActionResult GetMembers(long id)
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();

            // Security check: Is user actually in this group?
            // (You can implement IsMember check here if strictly needed)

            var members = new MessageGroupQuery().GetGroupMembers(id);
            return Ok(members);
        }

        // 3. CREATE GROUP
        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] CreateGroupRequest req)
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();
            if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest("Group Name Required");

            try
            {
                var io = new MessageGroupIO();

                // A. Create Group & Add Creator
                long newGroupId = io.CreateGroup(req.Name, uid);

                // B. Add Initial Members (if any)
                if (req.InitialMemberIds != null && req.InitialMemberIds.Count > 0)
                {
                    foreach (int memberId in req.InitialMemberIds)
                    {
                        if (memberId != uid) // Don't add creator twice
                        {
                            // FIX: Added try/catch so one failure doesn't abort the whole process
                            try
                            {
                                io.AddMember(newGroupId, memberId);
                                // Notify them
                                await _notifier.NotifyUser(memberId, uid, "group_invite", newGroupId, $"added you to group '{req.Name}'");
                            }
                            catch (Exception ex)
                            {
                                // Log the error (console for now) and continue
                                Console.WriteLine($"Failed to add member {memberId} to group {newGroupId}: {ex.Message}");
                            }
                        }
                    }
                }

                return Ok(new { groupId = newGroupId, name = req.Name });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // 4. ADD MEMBER
        [HttpPost("{id}/members/add")]
        public async Task<IActionResult> AddMember(long id, [FromBody] GroupMemberRequest req)
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();

            // TODO: Verify 'uid' is an Admin of group 'id' if you want permissions

            try
            {
                new MessageGroupIO().AddMember(id, req.UserId);

                // Notify the user they were added
                await _notifier.NotifyUser(req.UserId, uid, "group_invite", id, "added you to a group");

                return Ok();
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // 5. REMOVE MEMBER (Kick or Leave)
        [HttpPost("{id}/members/remove")]
        public IActionResult RemoveMember(long id, [FromBody] GroupMemberRequest req)
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();

            // Logic: Can only remove self (Leave), OR must be Admin to remove others (Kick)
            // For now, allowing open removal, but you should restrict this.

            try
            {
                new MessageGroupIO().RemoveMember(id, req.UserId);
                return Ok();
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // ... (Existing code) ...

        // =========================================
        // PUT: Rename Group
        // =========================================
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateGroup(long id, [FromBody] JsonElement body)
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();

            if (!body.TryGetProperty("name", out var n)) return BadRequest("Name required");
            string newName = n.GetString();

            var io = new MessageGroupIO();
            int myRole = io.GetUserRole(id, uid);

            // Only Owner (1) or Admin (2) can rename
            if (myRole < 1) return Forbid("Only Admins can rename groups.");

            if (io.UpdateGroup(id, newName))
            {
                // Optional: Notify group via SignalR if you have Hub injected here
                return Ok(new { success = true, name = newName });
            }
            return BadRequest("Update failed.");
        }

        // =========================================
        // DELETE: Delete Group
        // =========================================
        [HttpDelete("{id}")]
        public IActionResult DeleteGroup(long id)
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();

            var io = new MessageGroupIO();
            int myRole = io.GetUserRole(id, uid);

            // Only Owner (1) can delete
            if (myRole != 1) return Forbid("Only the Group Creator can delete the group.");

            try
            {
                io.DeleteGroup(id);
                return Ok(new { success = true });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        // =========================================
        // PATCH: Update Member Role
        // =========================================
        [HttpPatch("{id}/members/{targetUserId}/role")]
        public async Task<IActionResult> SetMemberRole(long id, int targetUserId, [FromBody] JsonElement body)
        {
            int uid = GetUserId();
            if (uid == 0) return Unauthorized();

            if (!body.TryGetProperty("role", out var r)) return BadRequest("Role required");
            int newRole = r.GetInt32(); // 0 = Member, 2 = Admin

            if (newRole != 0 && newRole != 2) return BadRequest("Invalid Role");

            var io = new MessageGroupIO();
            int myRole = io.GetUserRole(id, uid);
            int targetCurrentRole = io.GetUserRole(id, targetUserId);

            // Security Logic:
            // 1. Only Creator (1) can promote/demote Admins (2).
            // 2. Admins (2) cannot change other Admins or Creator.

            if (myRole == 1)
            {
                // Creator can do anything to anyone (except demote themselves here)
                if (targetUserId == uid) return BadRequest("Cannot change your own role here.");
            }
            else
            {
                return Forbid("Only the Group Creator can manage Admin roles.");
            }

            if (io.UpdateMemberRole(id, targetUserId, newRole))
            {
                await _notifier.NotifyUser(targetUserId, uid, "group_role", id,
                   newRole == 2 ? "promoted you to Admin" : "removed your Admin status");
                return Ok(new { success = true });
            }

            return BadRequest("Role update failed.");
        }
    }
}