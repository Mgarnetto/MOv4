using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class DeleteCollection
    {
        public bool Execute(long collectionId, int userId)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // Double check ownership before deleting
                string checkSql = "SELECT COUNT(*) FROM collections WHERE collection_id = @cid AND user_id = @uid";
                using (var checkCmd = new MySqlCommand(checkSql, conn))
                {
                    checkCmd.Parameters.AddWithValue("@cid", collectionId);
                    checkCmd.Parameters.AddWithValue("@uid", userId);
                    if (System.Convert.ToInt32(checkCmd.ExecuteScalar()) == 0) return false;
                }

                // Delete Items First
                using (var delItems = new MySqlCommand("DELETE FROM collection_items WHERE collection_id = @cid", conn))
                {
                    delItems.Parameters.AddWithValue("@cid", collectionId);
                    delItems.ExecuteNonQuery();
                }

                // Delete Master Collection
                using (var delCol = new MySqlCommand("DELETE FROM collections WHERE collection_id = @cid", conn))
                {
                    delCol.Parameters.AddWithValue("@cid", collectionId);
                    return delCol.ExecuteNonQuery() > 0;
                }
            }
        }
    }
}