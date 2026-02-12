using MySql.Data.MySqlClient;
using MoozicOrb.API.Models;
using System;
using System.Collections.Generic;
using System.Text;

namespace MoozicOrb.IO
{
    public class MessageGroupQuery
    {
        private readonly string _connString = DBConn1.ConnectionString;

        public List<GroupDto> GetGroupsForUser(int userId)
        {
            string csv = "";
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                var cmd = new MySqlCommand("SELECT user_groups FROM user WHERE user_id = @uid", conn);
                cmd.Parameters.AddWithValue("@uid", userId);
                var res = cmd.ExecuteScalar();
                csv = res != DBNull.Value ? res.ToString() : "";
            }

            if (string.IsNullOrEmpty(csv)) return new List<GroupDto>();

            var ids = new List<string>();
            foreach (var s in csv.Split(','))
            {
                if (long.TryParse(s, out long id) && id > 0) ids.Add(s);
            }

            if (ids.Count == 0) return new List<GroupDto>();

            var groups = new List<GroupDto>();
            string inClause = string.Join(",", ids);

            // Fetch Groups and calculate the latest timestamp (Message vs Creation)
            // We alias the result column as 'latest_ts'
            string sql = $@"
                SELECT 
                    g.group_id, 
                    g.group_name, 
                    g.total_users, 
                    g.creator_user_id, 
                    g.creation_date,
                    COALESCE(
                        (SELECT MAX(timestamp) FROM group_messages WHERE group_id = g.group_id), 
                        g.creation_date
                    ) AS latest_ts
                FROM message_group g 
                WHERE g.group_id IN ({inClause}) 
                ORDER BY latest_ts DESC";

            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                using (var r = cmd.ExecuteReader())
                {
                    while (r.Read())
                    {
                        // 1. Get raw time from DB
                        var rawTs = r["latest_ts"] != DBNull.Value ? Convert.ToDateTime(r["latest_ts"]) : DateTime.UtcNow;

                        // 2. Specify it is UTC (Do NOT convert to Local)
                        // This ensures consistency with Direct Messages which are now saving as UTC.
                        var utcTs = DateTime.SpecifyKind(rawTs, DateTimeKind.Utc);

                        groups.Add(new GroupDto
                        {
                            GroupId = r.GetInt64("group_id"),
                            GroupName = r["group_name"].ToString(),
                            TotalUsers = r.GetInt32("total_users"),
                            IsCreator = (r.GetInt32("creator_user_id") == userId),

                            // Map to standard 'Timestamp' property as UTC
                            Timestamp = utcTs
                        });
                    }
                }
            }
            return groups;
        }

        public List<GroupMemberDto> GetGroupMembers(long groupId)
        {
            var members = new List<GroupMemberDto>();
            string sql = @"
                SELECT m.role, u.user_id, u.username, u.display_name, u.profile_pic 
                FROM message_group_members m
                JOIN user u ON m.user_id = u.user_id
                WHERE m.group_id = @gid
                ORDER BY m.role DESC, u.username ASC";

            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@gid", groupId);
                    using (var r = cmd.ExecuteReader())
                    {
                        while (r.Read())
                        {
                            members.Add(new GroupMemberDto
                            {
                                UserId = r.GetInt32("user_id"),
                                UserName = r["username"].ToString(),
                                DisplayName = r["display_name"]?.ToString() ?? r["username"].ToString(),
                                ProfilePic = r["profile_pic"]?.ToString() ?? "/img/profile_default.jpg",
                                Role = r.GetInt32("role")
                            });
                        }
                    }
                }
            }
            return members;
        }
    }
}