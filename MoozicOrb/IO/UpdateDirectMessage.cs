using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateDirectMessage
    {
        public bool Execute(int userId, long messageId, string newText)
        {
            string sql = "UPDATE messages SET message_text = @text WHERE message_id = @mid AND sender_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@text", newText);
                    cmd.Parameters.AddWithValue("@mid", messageId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }
    }
}
