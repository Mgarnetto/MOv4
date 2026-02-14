using MySql.Data.MySqlClient;
using MoozicOrb.API.Models;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MoozicOrb.IO
{
    public class MessageGroupIO
    {
        private readonly string _connString = DBConn1.ConnectionString;

        // 1. CREATE GROUP (Transaction: Insert Group -> Insert Member -> Update User CSV)
        public long CreateGroup(string name, int creatorId)
        {
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                using (var trans = conn.BeginTransaction())
                {
                    try
                    {
                        // A. Insert Group
                        long newGroupId = 0;
                        string sqlGroup = @"INSERT INTO message_group (group_name, creator_user_id, creation_date, total_users) 
                                            VALUES (@name, @creator, NOW(), 1); 
                                            SELECT LAST_INSERT_ID();";
                        using (var cmd = new MySqlCommand(sqlGroup, conn, trans))
                        {
                            cmd.Parameters.AddWithValue("@name", name);
                            cmd.Parameters.AddWithValue("@creator", creatorId);
                            newGroupId = Convert.ToInt64(cmd.ExecuteScalar());
                        }

                        // B. Insert Member (Association Table)
                        string sqlMember = @"INSERT INTO message_group_members (group_id, user_id, role) VALUES (@gid, @uid, 1)"; // Role 1 = Creator
                        using (var cmd = new MySqlCommand(sqlMember, conn, trans))
                        {
                            cmd.Parameters.AddWithValue("@gid", newGroupId);
                            cmd.Parameters.AddWithValue("@uid", creatorId);
                            cmd.ExecuteNonQuery();
                        }

                        // C. Update User CSV
                        UpdateUserGroupCsv(conn, trans, creatorId, newGroupId, true);

                        trans.Commit();
                        return newGroupId;
                    }
                    catch
                    {
                        trans.Rollback();
                        throw;
                    }
                }
            }
        }

        // 2. ADD MEMBER (Transaction: Insert Member -> Update Count -> Update User CSV)
        public void AddMember(long groupId, int userId)
        {
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                using (var trans = conn.BeginTransaction())
                {
                    try
                    {
                        // A. Insert Member (Ignore if exists)
                        string sqlInsert = @"INSERT IGNORE INTO message_group_members (group_id, user_id, role) VALUES (@gid, @uid, 0)";
                        using (var cmd = new MySqlCommand(sqlInsert, conn, trans))
                        {
                            cmd.Parameters.AddWithValue("@gid", groupId);
                            cmd.Parameters.AddWithValue("@uid", userId);
                            int rows = cmd.ExecuteNonQuery();
                            if (rows == 0) return; // Already a member, abort
                        }

                        // B. Increment Count
                        new MySqlCommand($"UPDATE message_group SET total_users = total_users + 1 WHERE group_id = {groupId}", conn, trans).ExecuteNonQuery();

                        // C. Update User CSV
                        UpdateUserGroupCsv(conn, trans, userId, groupId, true);

                        trans.Commit();
                    }
                    catch { trans.Rollback(); throw; }
                }
            }
        }

        // 3. REMOVE MEMBER (Transaction: Delete Member -> Decr Count -> Update User CSV)
        public void RemoveMember(long groupId, int userId)
        {
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                using (var trans = conn.BeginTransaction())
                {
                    try
                    {
                        // A. Delete Member
                        string sqlDelete = "DELETE FROM message_group_members WHERE group_id = @gid AND user_id = @uid";
                        using (var cmd = new MySqlCommand(sqlDelete, conn, trans))
                        {
                            cmd.Parameters.AddWithValue("@gid", groupId);
                            cmd.Parameters.AddWithValue("@uid", userId);
                            int rows = cmd.ExecuteNonQuery();
                            if (rows == 0) return; // Not a member
                        }

                        // B. Decrement Count
                        new MySqlCommand($"UPDATE message_group SET total_users = total_users - 1 WHERE group_id = {groupId}", conn, trans).ExecuteNonQuery();

                        // C. Update User CSV
                        UpdateUserGroupCsv(conn, trans, userId, groupId, false);

                        trans.Commit();
                    }
                    catch { trans.Rollback(); throw; }
                }
            }
        }

        // --- HELPER: CSV LOGIC ---
        private void UpdateUserGroupCsv(MySqlConnection conn, MySqlTransaction trans, int userId, long groupId, bool isAdding)
        {
            // 1. Fetch current CSV
            string currentCsv = "";
            string sqlFetch = "SELECT user_groups FROM user WHERE user_id = @uid FOR UPDATE"; // Lock row
            using (var cmd = new MySqlCommand(sqlFetch, conn, trans))
            {
                cmd.Parameters.AddWithValue("@uid", userId);
                var result = cmd.ExecuteScalar();
                currentCsv = result != DBNull.Value ? result.ToString() : "";
            }

            // 2. Manipulate List
            var groups = currentCsv.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            string gIdStr = groupId.ToString();

            if (isAdding)
            {
                if (!groups.Contains(gIdStr)) groups.Add(gIdStr);
            }
            else
            {
                groups.Remove(gIdStr);
            }

            string newCsv = string.Join(",", groups);

            // 3. Update DB
            string sqlUpdate = "UPDATE user SET user_groups = @csv WHERE user_id = @uid";
            using (var cmd = new MySqlCommand(sqlUpdate, conn, trans))
            {
                cmd.Parameters.AddWithValue("@csv", newCsv);
                cmd.Parameters.AddWithValue("@uid", userId);
                cmd.ExecuteNonQuery();
            }
        }

        // --- READS ---
        public List<int> GetGroupMemberIds(long groupId)
        {
            var list = new List<int>();
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                string sql = "SELECT user_id FROM message_group_members WHERE group_id = @gid";
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@gid", groupId);
                    using (var r = cmd.ExecuteReader())
                    {
                        while (r.Read()) list.Add(r.GetInt32(0));
                    }
                }
            }
            return list;
        }

        // ... (Existing Create, AddMember, RemoveMember methods) ...

        // 4. UPDATE GROUP NAME (Owner/Admin only - Verified by Controller)
        public bool UpdateGroup(long groupId, string newName)
        {
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                string sql = "UPDATE message_group SET group_name = @name WHERE group_id = @gid";
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@name", newName);
                    cmd.Parameters.AddWithValue("@gid", groupId);
                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }

        // 5. DELETE GROUP (Owner Only)
        // Transaction: Remove Members -> Remove Messages -> Delete Group -> Update CSVs
        public void DeleteGroup(long groupId)
        {
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                using (var trans = conn.BeginTransaction())
                {
                    try
                    {
                        // A. Get Member IDs to update their CSVs later
                        var memberIds = new List<int>();
                        using (var cmd = new MySqlCommand("SELECT user_id FROM message_group_members WHERE group_id = @gid FOR UPDATE", conn, trans))
                        {
                            cmd.Parameters.AddWithValue("@gid", groupId);
                            using (var r = cmd.ExecuteReader())
                            {
                                while (r.Read()) memberIds.Add(r.GetInt32(0));
                            }
                        }

                        // B. Delete Members & Messages
                        new MySqlCommand($"DELETE FROM message_group_members WHERE group_id = {groupId}", conn, trans).ExecuteNonQuery();
                        new MySqlCommand($"DELETE FROM group_messages WHERE group_id = {groupId}", conn, trans).ExecuteNonQuery();

                        // C. Delete Group
                        new MySqlCommand($"DELETE FROM message_group WHERE group_id = {groupId}", conn, trans).ExecuteNonQuery();

                        // D. Update User CSVs (Remove this GroupID)
                        foreach (var uid in memberIds)
                        {
                            UpdateUserGroupCsv(conn, trans, uid, groupId, false); // false = remove
                        }

                        trans.Commit();
                    }
                    catch { trans.Rollback(); throw; }
                }
            }
        }

        // 6. UPDATE MEMBER ROLE
        public bool UpdateMemberRole(long groupId, int targetUserId, int newRole)
        {
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                string sql = "UPDATE message_group_members SET role = @role WHERE group_id = @gid AND user_id = @uid";
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@role", newRole);
                    cmd.Parameters.AddWithValue("@gid", groupId);
                    cmd.Parameters.AddWithValue("@uid", targetUserId);
                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }

        // Helper to check role (for Controller validation)
        public int GetUserRole(long groupId, int userId)
        {
            using (var conn = new MySqlConnection(_connString))
            {
                conn.Open();
                string sql = "SELECT role FROM message_group_members WHERE group_id = @gid AND user_id = @uid";
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@gid", groupId);
                    cmd.Parameters.AddWithValue("@uid", userId);
                    object result = cmd.ExecuteScalar();
                    if (result != null && result != DBNull.Value) return Convert.ToInt32(result);
                    return -1; // Not a member
                }
            }
        }
    }
}