using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class ClearCollectionItems
    {
        public void Execute(long collectionId)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                string sql = "DELETE FROM collection_items WHERE collection_id = @cid;";
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}