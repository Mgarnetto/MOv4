using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class CheckCollectionOwner
    {
        public bool Execute(long collectionId, int userId)
        {
            string sql = "SELECT 1 FROM collections WHERE collection_id = @cid AND user_id = @uid LIMIT 1;";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    var result = cmd.ExecuteScalar();
                    return result != null; // True if they own it, false if they don't.
                }
            }
        }
    }
}