using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class UpdateCollection
    {
        public bool Execute(long collectionId, int userId, string title, string desc, int type, string context, long coverId)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                string sql = @"
                    UPDATE collections 
                    SET title = @title, description = @desc, collection_type = @type, 
                        display_context = @ctx, cover_image_id = @cover
                    WHERE collection_id = @cid AND user_id = @uid AND is_locked = 0;
                ";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@title", title);
                    cmd.Parameters.AddWithValue("@desc", desc ?? "");
                    cmd.Parameters.AddWithValue("@type", type);
                    cmd.Parameters.AddWithValue("@ctx", context ?? "");
                    cmd.Parameters.AddWithValue("@cover", coverId);

                    int rows = cmd.ExecuteNonQuery();
                    return rows > 0;
                }
            }
        }
    }
}