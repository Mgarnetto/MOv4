using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class DeleteComment
    {
        public bool Execute(int userId, long commentId)
        {
            string sql = "DELETE FROM comments WHERE comment_id = @cid AND user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", commentId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }
    }
}
