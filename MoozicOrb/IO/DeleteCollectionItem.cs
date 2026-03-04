using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class DeleteCollectionItem
    {
        public void Execute(long linkId, long collectionId)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                string sql = @"
                    DELETE ci FROM collection_items ci
                    INNER JOIN collections c ON ci.collection_id = c.collection_id
                    WHERE ci.link_id = @linkId AND c.collection_id = @cid AND c.is_locked = 0;
                ";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@linkId", linkId);
                    cmd.Parameters.AddWithValue("@cid", collectionId);

                    int rows = cmd.ExecuteNonQuery();
                    if (rows == 0)
                    {
                        throw new InvalidOperationException("Action denied: Collection is locked or track not found.");
                    }
                }
            }
        }
    }
}