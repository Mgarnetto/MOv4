using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.Collections.Generic;
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
    }
}