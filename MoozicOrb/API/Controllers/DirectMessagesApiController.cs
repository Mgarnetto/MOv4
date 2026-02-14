using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services.Interfaces;
using MoozicOrb.Hubs;
using MoozicOrb.IO;
using MoozicOrb.Services;
using System;
using System.Collections.Generic;
using System.Linq; // Added for Select
using System.Text.Json;
using System.Threading.Tasks;

[ApiController]
[Route("api/direct/messages")]
public class DirectMessagesController : ControllerBase
{
    private readonly IDirectMessageApiService _service;
    private readonly IHttpContextAccessor _http;
    private readonly IHubContext<MessageHub> _hub;
    private readonly UserConnectionManager _connections;
    private readonly UserQuery _userQuery;
    private readonly NotificationService _notify;

    public DirectMessagesController(
        IDirectMessageApiService service,
        IHttpContextAccessor http,
        IHubContext<MessageHub> hub,
        UserConnectionManager connections,
        NotificationService notify)
    {
        _service = service;
        _http = http;
        _hub = hub;
        _connections = connections;
        _userQuery = new UserQuery();
        _notify = notify;
    }

    // =========================================
    // Helpers
    // =========================================
    private int GetUserId()
    {
        var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
        var session = SessionStore.GetSession(sid);

        if (session == null)
            throw new UnauthorizedAccessException();

        return session.UserId;
    }

    // =========================================
    // NEW: Search Users for Group Creation
    // =========================================
    [HttpGet("search")]
    public IActionResult SearchUsers(string query)
    {
        GetUserId(); // Auth check
        if (string.IsNullOrWhiteSpace(query)) return Ok(new List<object>());

        // Use existing IO logic
        var users = _userQuery.SearchUsers(query);

        // Map to lightweight JSON
        var results = users.Select(u => new
        {
            id = u.UserId,
            name = !string.IsNullOrEmpty(u.DisplayName) ? u.DisplayName : u.UserName,
            img = !string.IsNullOrEmpty(u.ProfilePic) ? u.ProfilePic : "/img/profile_default.jpg",
            username = u.UserName
        });

        return Ok(results);
    }

    // =========================================
    // GET: User Info for Chat Header
    // =========================================
    [HttpGet("user-info/{targetUserId:int}")]
    public IActionResult GetUserInfo(int targetUserId)
    {
        GetUserId(); // Auth check

        var user = _userQuery.GetUserById(targetUserId);
        if (user == null) return NotFound();

        return Ok(new
        {
            id = user.UserId,
            name = !string.IsNullOrEmpty(user.DisplayName) ? user.DisplayName : user.UserName,
            img = !string.IsNullOrEmpty(user.ProfilePic) ? user.ProfilePic : "/img/profile_default.jpg"
        });
    }

    // =========================================
    // GET: Conversation
    // =========================================
    [HttpGet("with/{otherUserId:int}")]
    public ActionResult<IEnumerable<DirectMessageDto>> GetConversation(int otherUserId)
    {
        int me = GetUserId();
        var messages = _service.GetDirectMessages(me, otherUserId);
        return Ok(messages);
    }

    // =========================================
    // GET: Single message
    // =========================================
    [HttpGet("single/{messageId:long}")]
    public ActionResult<DirectMessageDto> GetMessage(long messageId)
    {
        int me = GetUserId();
        var msg = _service.GetDirectMessage(messageId);
        if (msg == null) return NotFound();
        if (msg.SenderId != me && msg.ReceiverId != me) return Forbid();
        return Ok(msg);
    }

    // =========================================
    // POST: Send DM
    // =========================================
    [HttpPost]
    public async Task<IActionResult> CreateMessage([FromBody] JsonElement body)
    {
        if (!body.TryGetProperty("receiverId", out var r) ||
            !body.TryGetProperty("text", out var t))
            return BadRequest();

        int senderId = GetUserId();
        int receiverId = r.GetInt32();
        string text = t.GetString();

        var messageId = _service.CreateDirectMessage(senderId, receiverId, text);

        // 1. 🔔 Notify recipient via SignalR (Live Chat)
        foreach (var conn in _connections.GetConnections(receiverId))
        {
            await _hub.Clients.Client(conn).SendAsync("OnDirectMessage", new { senderId, messageId });
        }

        // 2. 🔔 Notify sender (Live Chat - Multi-tab)
        foreach (var conn in _connections.GetConnections(senderId))
        {
            await _hub.Clients.Client(conn).SendAsync("OnDirectMessage", new { senderId, messageId });
        }

        // 3. 🔔 SYSTEM NOTIFICATION
        await _notify.NotifyUser(receiverId, senderId, "message", senderId, "sent you a message");

        return Ok(new { messageId });
    }

    // =========================================
    // GET: Bootstrap
    // =========================================
    [HttpGet]
    public ActionResult GetAllDirectMessages()
    {
        int me = GetUserId();
        var conversations = _service.GetAllDirectMessages(me);
        return Ok(new
        {
            users = conversations.Keys,
            messages = conversations
        });
    }

    // =========================================
    // PUT: Edit Message
    // =========================================
    [HttpPut("{messageId}")]
    public async Task<IActionResult> EditMessage(long messageId, [FromBody] JsonElement body)
    {
        try
        {
            if (!body.TryGetProperty("text", out var t)) return BadRequest("Text required");
            string newText = t.GetString();
            if (string.IsNullOrWhiteSpace(newText)) return BadRequest("Text cannot be empty");

            int userId = GetUserId();

            // 1. Perform Edit
            bool success = _service.EditDirectMessage(userId, messageId, newText);
            if (!success) return BadRequest("Could not edit message (Access Denied or Not Found)");

            // 2. Fetch Message to Identify Recipient
            var msg = _service.GetDirectMessage(messageId);
            if (msg != null)
            {
                // 3. Notify Recipient (SignalR)
                foreach (var conn in _connections.GetConnections(msg.ReceiverId))
                {
                    await _hub.Clients.Client(conn).SendAsync("OnDirectMessageUpdated", new
                    {
                        messageId,
                        text = newText
                    });
                }

                // 4. Notify Sender (Sync other tabs)
                foreach (var conn in _connections.GetConnections(userId))
                {
                    await _hub.Clients.Client(conn).SendAsync("OnDirectMessageUpdated", new
                    {
                        messageId,
                        text = newText
                    });
                }
            }

            return Ok(new { success = true });
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (Exception ex) { return BadRequest(ex.Message); }
    }

    // =========================================
    // DELETE: Delete Message
    // =========================================
    [HttpDelete("{messageId}")]
    public async Task<IActionResult> DeleteMessage(long messageId)
    {
        try
        {
            int userId = GetUserId();

            // 1. Fetch Message BEFORE deletion (to know who to notify)
            var msg = _service.GetDirectMessage(messageId);
            if (msg == null) return NotFound();

            // 2. Perform Delete
            bool success = _service.DeleteDirectMessage(userId, messageId);
            if (!success) return BadRequest("Could not delete message (Access Denied)");

            // 3. Notify Recipient (SignalR)
            foreach (var conn in _connections.GetConnections(msg.ReceiverId))
            {
                await _hub.Clients.Client(conn).SendAsync("OnDirectMessageDeleted", new { messageId });
            }

            // 4. Notify Sender (Sync other tabs)
            foreach (var conn in _connections.GetConnections(userId))
            {
                await _hub.Clients.Client(conn).SendAsync("OnDirectMessageDeleted", new { messageId });
            }

            return Ok(new { success = true });
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (Exception ex) { return BadRequest(ex.Message); }
    }
}




