using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class DeleteCollection
    {
        public bool Execute(long collectionId, int userId)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // Securely requires ownership AND unlocked status
                string sql = "DELETE FROM collections WHERE collection_id = @cid AND user_id = @uid AND is_locked = 0;";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0; // Returns false to the controller if locked, resulting in a clean "Delete failed" message.
                }
            }
        }
    }
}