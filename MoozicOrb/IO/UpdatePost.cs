using MySql.Data.MySqlClient;
using MoozicOrb.API.Models;
using System;

namespace MoozicOrb.IO
{
    public class UpdatePost
    {
        public bool Execute(long postId, int userId, string title, string text, decimal? price = null, int? quantity = null, int visibility = 0)
        {
            string sql = @"
                UPDATE posts 
                SET title = @title, content_text = @text, price = @price, quantity = @qty, visibility = @vis 
                WHERE post_id = @pid AND user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@pid", postId);
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@title", title ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@text", text ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@price", price ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@qty", quantity ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@vis", visibility);

                    return cmd.ExecuteNonQuery() > 0;
                }
            }
        }
    }
}