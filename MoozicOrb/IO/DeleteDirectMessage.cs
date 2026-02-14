using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class DeleteDirectMessage
    {
        public bool Execute(int userId, long messageId)
        {
            // Only the sender can delete the message for everyone (unsend).
            // (Optionally, you could allow receivers to "hide" it, but for now we'll do strict delete)
            string sql = "DELETE FROM messages WHERE message_id = @mid AND sender_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@mid", messageId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }
    }
}
