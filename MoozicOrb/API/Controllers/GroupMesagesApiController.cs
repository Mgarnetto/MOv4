using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services.Interfaces;
using MoozicOrb.Hubs;
using MoozicOrb.Services;
using System.Text.Json;
using System.Threading.Tasks;

[ApiController]
[Route("api/groups/{groupId:long}/messages")]
public class GroupMessagesController : ControllerBase
{
    private readonly IGroupMessageApiService _service;
    private readonly IHttpContextAccessor _http;
    private readonly IHubContext<MessageHub> _hub;
    private readonly NotificationService _notifier; // 1. Add Service

    public GroupMessagesController(
        IGroupMessageApiService service,
        IHttpContextAccessor http,
        IHubContext<MessageHub> hub,
        NotificationService notifier) // 2. Inject Service
    {
        _service = service;
        _http = http;
        _hub = hub;
        _notifier = notifier;
    }

    private int GetUserId()
    {
        var sid = _http.HttpContext?.Request.Headers["X-Session-Id"].ToString();
        var session = SessionStore.GetSession(sid);
        if (session == null)
            throw new UnauthorizedAccessException();
        return session.UserId;
    }

    // ✅ Get list
    [HttpGet]
    public ActionResult<IEnumerable<GroupMessageDto>> GetMessages(
        long groupId, int? limit = null)
    {
        var msgs = _service.GetGroupMessages(groupId);

        if (limit.HasValue)
            msgs = msgs.Take(limit.Value).ToList();

        return Ok(msgs);
    }

    // ✅ Get single message
    [HttpGet("{messageId:long}")]
    public ActionResult<GroupMessageDto> GetMessage(
        long groupId,
        long messageId)
    {
        var msg = _service.GetGroupMessage(groupId, messageId);
        if (msg == null)
            return NotFound();

        return Ok(msg);
    }

    // ✅ Create
    [HttpPost]
    public async Task<IActionResult> CreateMessage(
        long groupId,
        [FromBody] JsonElement body)
    {
        if (!body.TryGetProperty("text", out var t))
            return BadRequest();

        int userId = GetUserId();
        string text = t.GetString();

        var messageId =
            _service.CreateGroupMessage(groupId, userId, text);

        // 🔔 1. Notify Chat Window (Real-time message)
        await _hub.Clients
            .Group($"group-{groupId}")
            .SendAsync("OnGroupMessage", new
            {
                groupId,
                messageId
            });

        // 🔔 2. Ring the Bell (Persistent Notification)
        // This updates the red badge and shows the toast for users off-screen.
        await _notifier.NotifyGroup(groupId, userId, "sent a message to the group");

        return Ok(new { messageId });
    }

    // =========================================
    // PUT: Edit Message
    // =========================================
    [HttpPut("{messageId}")]
    public async Task<IActionResult> EditMessage(long groupId, long messageId, [FromBody] JsonElement body)
    {
        try
        {
            if (!body.TryGetProperty("text", out var t)) return BadRequest("Text required");
            string newText = t.GetString();
            if (string.IsNullOrWhiteSpace(newText)) return BadRequest("Text cannot be empty");

            int userId = GetUserId();

            bool success = _service.EditGroupMessage(groupId, userId, messageId, newText);
            if (!success) return BadRequest("Could not edit message (Access Denied or Not Found)");

            // Notify Group (Real-time update)
            await _hub.Clients.Group($"group-{groupId}").SendAsync("OnGroupMessageUpdated", new
            {
                groupId,
                messageId,
                text = newText
            });

            return Ok(new { success = true });
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (Exception ex) { return BadRequest(ex.Message); }
    }

    // =========================================
    // DELETE: Delete Message
    // =========================================
    [HttpDelete("{messageId}")]
    public async Task<IActionResult> DeleteMessage(long groupId, long messageId)
    {
        try
        {
            int userId = GetUserId();

            bool success = _service.DeleteGroupMessage(groupId, userId, messageId);
            if (!success) return BadRequest("Could not delete message (Access Denied)");

            // Notify Group
            await _hub.Clients.Group($"group-{groupId}").SendAsync("OnGroupMessageDeleted", new
            {
                groupId,
                messageId
            });

            return Ok(new { success = true });
        }
        catch (UnauthorizedAccessException) { return Unauthorized(); }
        catch (Exception ex) { return BadRequest(ex.Message); }
    }
}








