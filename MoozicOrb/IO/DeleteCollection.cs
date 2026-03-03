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

                // THE FIX: Check lock status instead of just count
                string checkSql = "SELECT is_locked FROM collections WHERE collection_id = @cid AND user_id = @uid";
                using (var checkCmd = new MySqlCommand(checkSql, conn))
                {
                    checkCmd.Parameters.AddWithValue("@cid", collectionId);
                    checkCmd.Parameters.AddWithValue("@uid", userId);
                    
                    var result = checkCmd.ExecuteScalar();
                    
                    if (result == null) return false; // Doesn't exist or isn't owner
                    if (Convert.ToBoolean(result) == true) return false; // Locked! Cannot delete.
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