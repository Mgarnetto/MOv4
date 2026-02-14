using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateGroupMessage
    {
        public bool Execute(long groupId, int userId, long messageId, string newText)
        {
            // Verify GroupID, MessageID, and SenderID (Ownership)
            string sql = @"UPDATE group_messages 
                           SET message_text = @text 
                           WHERE group_id = @gid AND message_id = @mid AND sender_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@text", newText);
                    cmd.Parameters.AddWithValue("@gid", groupId);
                    cmd.Parameters.AddWithValue("@mid", messageId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }
    }
}
