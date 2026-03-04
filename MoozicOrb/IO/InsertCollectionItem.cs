using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class InsertCollectionItem
    {
        public void Execute(long collectionId, long targetId, int targetType, int sortOrder)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // Atomically checks if the collection exists and is NOT locked
                string sql = @"
                    INSERT INTO collection_items (collection_id, target_id, target_type, sort_order)
                    SELECT @cid, @tid, @type, @sort
                    FROM collections 
                    WHERE collection_id = @cid AND is_locked = 0;
                ";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.Parameters.AddWithValue("@tid", targetId);
                    cmd.Parameters.AddWithValue("@type", targetType);
                    cmd.Parameters.AddWithValue("@sort", sortOrder);

                    int rows = cmd.ExecuteNonQuery();
                    if (rows == 0)
                    {
                        // Throws an error that your Controller will catch and send to the UI as a 400 BadRequest
                        throw new InvalidOperationException("Action denied: Collection is locked or does not exist.");
                    }
                }
            }
        }
    }
}