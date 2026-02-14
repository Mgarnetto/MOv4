using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class DeleteGroupMessage
    {
        public bool Execute(long groupId, int userId, long messageId)
        {
            // Strict Delete: Only the sender can delete their message.
            string sql = @"DELETE FROM group_messages 
                           WHERE group_id = @gid AND message_id = @mid AND sender_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
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