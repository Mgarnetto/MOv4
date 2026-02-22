using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateCollection
    {
        public bool Execute(long collectionId, int userId, string title, string description, int type, string displayContext, long? coverId)
        {
            string sql = @"
                UPDATE collections 
                SET title = @title, 
                    description = @desc, 
                    collection_type = @type, 
                    display_context = @context, 
                    cover_image_id = @cover
                WHERE collection_id = @cid AND user_id = @uid;";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@title", title);
                    cmd.Parameters.AddWithValue("@desc", description ?? "");
                    cmd.Parameters.AddWithValue("@type", type);
                    cmd.Parameters.AddWithValue("@context", displayContext ?? "showcase");
                    cmd.Parameters.AddWithValue("@cover", coverId.HasValue && coverId.Value > 0 ? coverId.Value : (object)DBNull.Value);

                    return cmd.ExecuteNonQuery() > 0;
                }
            }
        }
    }
}