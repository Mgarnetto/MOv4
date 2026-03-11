using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class ToggleCollectionLike
    {
        public bool Execute(int userId, long collectionId)
        {
            bool isLiked = false;
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // 1. Check if like exists
                string checkSql = "SELECT COUNT(*) FROM collection_likes WHERE collection_id = @cid AND user_id = @uid";
                int count = 0;
                using (var cmd = new MySqlCommand(checkSql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.Parameters.AddWithValue("@uid", userId);
                    count = Convert.ToInt32(cmd.ExecuteScalar());
                }

                // 2. Toggle the Like
                if (count > 0)
                {
                    string delSql = "DELETE FROM collection_likes WHERE collection_id = @cid AND user_id = @uid";
                    using (var cmd = new MySqlCommand(delSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@cid", collectionId);
                        cmd.Parameters.AddWithValue("@uid", userId);
                        cmd.ExecuteNonQuery();
                    }
                    isLiked = false; // It was removed
                }
                else
                {
                    string insSql = "INSERT INTO collection_likes (collection_id, user_id) VALUES (@cid, @uid)";
                    using (var cmd = new MySqlCommand(insSql, conn))
                    {
                        cmd.Parameters.AddWithValue("@cid", collectionId);
                        cmd.Parameters.AddWithValue("@uid", userId);
                        cmd.ExecuteNonQuery();
                    }
                    isLiked = true; // It was added
                }
            }
            return isLiked;
        }
    }
}