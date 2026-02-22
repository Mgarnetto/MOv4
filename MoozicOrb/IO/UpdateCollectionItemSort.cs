using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class UpdateCollectionItemSort
    {
        public void Execute(long linkId, int newSortOrder)
        {
            string sql = "UPDATE collection_items SET sort_order = @sort WHERE link_id = @lid;";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@lid", linkId);
                    cmd.Parameters.AddWithValue("@sort", newSortOrder);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}
