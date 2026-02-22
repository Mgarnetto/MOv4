using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class DeleteCollectionItem
    {
        public void Execute(long linkId, long collectionId)
        {
            // We include collectionId in the WHERE clause as an extra safety measure
            string sql = "DELETE FROM collection_items WHERE link_id = @lid AND collection_id = @cid;";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@lid", linkId);
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}