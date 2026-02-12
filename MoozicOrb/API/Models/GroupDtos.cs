using System;
using System.Collections.Generic;

namespace MoozicOrb.API.Models
{
    public class CreateGroupRequest
    {
        public string Name { get; set; }
        public List<int> InitialMemberIds { get; set; } = new List<int>(); // Optional: Add friends immediately
    }

    public class GroupMemberRequest
    {
        public int UserId { get; set; }
    }

    public class GroupDto
    {
        public long GroupId { get; set; }
        public string GroupName { get; set; }
        public int TotalUsers { get; set; }
        public bool IsCreator { get; set; }

        // "Timestamp" = The latest activity time (creation or last message).
        // This matches the naming convention of your Direct Messages.
        public DateTime Timestamp { get; set; }
    }

    public class GroupMemberDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string DisplayName { get; set; }
        public string ProfilePic { get; set; }
        public int Role { get; set; }
    }
}