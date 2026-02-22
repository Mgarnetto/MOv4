using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class InsertCollectionItem
    {
        public void Execute(long collectionId, long targetId, int targetType, int sortOrder)
        {
            string sql = @"
                INSERT INTO collection_items (collection_id, target_id, target_type, sort_order, added_at) 
                VALUES (@cid, @tid, @ttype, @sort, NOW());";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.Parameters.AddWithValue("@tid", targetId);
                    cmd.Parameters.AddWithValue("@ttype", targetType);
                    cmd.Parameters.AddWithValue("@sort", sortOrder);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}