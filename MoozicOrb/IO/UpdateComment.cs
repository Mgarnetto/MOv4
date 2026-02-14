using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateComment
    {
        public bool Execute(int userId, long commentId, string newText)
        {
            string sql = "UPDATE comments SET content_text = @text WHERE comment_id = @cid AND user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@text", newText);
                    cmd.Parameters.AddWithValue("@cid", commentId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }
    }
}