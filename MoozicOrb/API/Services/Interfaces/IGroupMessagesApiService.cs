using MoozicOrb.API.Models;
using System.Collections.Generic;

namespace MoozicOrb.API.Services.Interfaces
{
    public interface IGroupMessageApiService
    {
        long CreateGroupMessage(long groupId, int senderId, string text);

        IEnumerable<GroupMessageDto> GetGroupMessages(long groupId);

        GroupMessageDto GetGroupMessage(long groupId, long messageId);
    }
}

