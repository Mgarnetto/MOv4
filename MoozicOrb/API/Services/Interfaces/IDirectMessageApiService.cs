using MoozicOrb.API.Models;
using System.Collections.Generic;

namespace MoozicOrb.API.Services.Interfaces
{
    public interface IDirectMessageApiService
    {
        long CreateDirectMessage(int senderId, int receiverId, string text);

        IEnumerable<DirectMessageDto> GetDirectMessages(int userId1, int userId2);

        DirectMessageDto GetDirectMessage(long messageId);

        // All messages for inbox-style load
        IEnumerable<DirectMessageDto> GetAllMessagesForUser(int userId);

        // Grouped by other user (bootstrap)
        Dictionary<int, List<DirectMessageDto>> GetAllDirectMessages(int userId);

        bool EditDirectMessage(int userId, long messageId, string newText);
        bool DeleteDirectMessage(int userId, long messageId);
    }
}





