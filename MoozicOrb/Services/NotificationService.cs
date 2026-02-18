using Microsoft.AspNetCore.SignalR;
using MoozicOrb.API.Models;
using MoozicOrb.Hubs;
using MoozicOrb.IO;
using System; // Required for DateTime
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;

namespace MoozicOrb.Services
{
    public class NotificationService
    {
        // Renamed _hub to _chatHub for clarity, added _postHub for sidebar stats
        private readonly IHubContext<MessageHub> _chatHub;
        private readonly IHubContext<PostHub> _postHub;
        private readonly UserConnectionManager _connections;

        // Inject BOTH Hubs
        public NotificationService(
            IHubContext<MessageHub> chatHub,
            IHubContext<PostHub> postHub,
            UserConnectionManager connections)
        {
            _chatHub = chatHub;
            _postHub = postHub;
            _connections = connections;
        }

        // 1. Single User Notification (Direct Messages) -> Uses MessageHub
        public async Task NotifyUser(int recipientId, int actorId, string type, long refId, string customMsg = null)
        {
            if (recipientId == actorId) return;

            string messageText = customMsg ?? GetDefaultMessage(type);

            var io = new NotificationIO();
            long notifId = io.Insert(recipientId, actorId, type, refId, messageText);

            if (notifId > 0)
            {
                var payload = await BuildPayload(notifId, actorId, type, messageText, refId);
                var conns = _connections.GetConnections(recipientId);
                foreach (var cid in conns)
                {
                    // Changed from _hub to _chatHub
                    await _chatHub.Clients.Client(cid).SendAsync("OnNotification", payload);
                }
            }
        }

        // 2. Group Notification (For Group Chats) -> Uses MessageHub
        public async Task NotifyGroup(long groupId, int senderId, string customMsg)
        {
            // A. Get Members from the new Association Table
            var groupIO = new MessageGroupIO();
            List<int> memberIds = groupIO.GetGroupMemberIds(groupId);

            // B. Filter out sender
            memberIds = memberIds.Where(uid => uid != senderId).ToList();
            if (memberIds.Count == 0) return;

            var io = new NotificationIO();
            string type = "group_message";

            // C. Loop & Notify
            foreach (int userId in memberIds)
            {
                // In a group chat, we might NOT want to save a persistent notification for every single message 
                // to the DB if it's too spammy. But for now, we will save it to be safe.
                long notifId = io.Insert(userId, senderId, type, groupId, customMsg);

                if (notifId > 0)
                {
                    var payload = await BuildPayload(notifId, senderId, type, customMsg, groupId);
                    var conns = _connections.GetConnections(userId);
                    foreach (var cid in conns)
                    {
                        // Changed from _hub to _chatHub
                        await _chatHub.Clients.Client(cid).SendAsync("OnNotification", payload);
                    }
                }
            }
        }

        // 3. Mass Notification (Followers) -> Uses MessageHub (usually)
        public async Task NotifyFollowers(int authorId, long postId, string postTitle)
        {
            var followers = new List<int>();
            try
            {
                // followers = new GetFollowers().Execute(authorId); 
            }
            catch { }

            if (followers.Count == 0) return;

            string msg = $"posted: {postTitle}";
            var io = new NotificationIO();

            foreach (int followerId in followers)
            {
                long notifId = io.Insert(followerId, authorId, "post_new", postId, msg);

                if (notifId > 0)
                {
                    var payload = await BuildPayload(notifId, authorId, "post_new", msg, postId);
                    var conns = _connections.GetConnections(followerId);
                    foreach (var cid in conns)
                    {
                        // Changed from _hub to _chatHub
                        await _chatHub.Clients.Client(cid).SendAsync("OnNotification", payload);
                    }
                }
            }
        }

        private string GetDefaultMessage(string type) => type switch
        {
            "message" => "sent you a message",
            "group_message" => "sent a message to the group",
            "post_new" => "posted something new",
            _ => "updated something"
        };

        private async Task<NotificationDto> BuildPayload(long id, int actorId, string type, string msg, long refId)
        {
            var actor = new UserQuery().GetUserById(actorId);
            return new NotificationDto
            {
                Id = id,
                ActorId = actorId,
                ActorName = actor?.UserName ?? "Someone",
                ActorPic = actor?.ProfilePic ?? "/img/profile_default.jpg",
                Type = type,
                Message = msg,
                ReferenceId = refId,

                // ADDED: Fix for "Just Now" issue on real-time updates
                CreatedAt = DateTime.UtcNow,
                CreatedAgo = "Just now"
            };
        }

        // 4. REAL-TIME STATS UPDATE -> Uses PostHub
        public async Task SendStatsUpdate(int userId)
        {
            // 1. Get fresh counts from the Database
            var io = new GetFollowCounts();
            var counts = io.Execute(userId);

            // 2. Broadcast to the User's specific group using POSTHUB
            // The frontend notification.js connects to /PostHub and joins "user_{id}"
            await _postHub.Clients.Group($"user_{userId}").SendAsync("ReceiveStatsUpdate", new
            {
                userId = userId,
                followers = counts.Followers,
                following = counts.Following
            });
        }
    }
}