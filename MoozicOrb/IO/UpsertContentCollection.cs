using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpsertContextCollection
    {
        public long Execute(int userId, string title, string description, int type, string displayContext, long? coverId)
        {
            long collectionId = 0;

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // 1. Check if a collection for this context already exists
                string checkSql = "SELECT collection_id FROM collections WHERE user_id = @uid AND display_context = @ctx LIMIT 1;";
                using (var checkCmd = new MySqlCommand(checkSql, conn))
                {
                    checkCmd.Parameters.AddWithValue("@uid", userId);
                    checkCmd.Parameters.AddWithValue("@ctx", displayContext);
                    var result = checkCmd.ExecuteScalar();
                    if (result != null)
                    {
                        collectionId = Convert.ToInt64(result);
                    }
                }

                if (collectionId > 0)
                {
                    // 2. UPDATE existing record
                    string updateSql = @"
                        UPDATE collections 
                        SET title = @title, 
                            description = @desc, 
                            collection_type = @type, 
                            cover_image_id = @cover 
                        WHERE collection_id = @cid;";

                    using (var updateCmd = new MySqlCommand(updateSql, conn))
                    {
                        updateCmd.Parameters.AddWithValue("@cid", collectionId);
                        updateCmd.Parameters.AddWithValue("@title", title);
                        updateCmd.Parameters.AddWithValue("@desc", description ?? "");
                        updateCmd.Parameters.AddWithValue("@type", type);
                        updateCmd.Parameters.AddWithValue("@cover", coverId.HasValue && coverId.Value > 0 ? coverId.Value : (object)DBNull.Value);
                        updateCmd.ExecuteNonQuery();
                    }
                }
                else
                {
                    // 3. INSERT new record
                    string insertSql = @"
                        INSERT INTO collections (user_id, title, description, collection_type, display_context, cover_image_id, created_at) 
                        VALUES (@uid, @title, @desc, @type, @ctx, @cover, NOW());
                        SELECT LAST_INSERT_ID();";

                    using (var insertCmd = new MySqlCommand(insertSql, conn))
                    {
                        insertCmd.Parameters.AddWithValue("@uid", userId);
                        insertCmd.Parameters.AddWithValue("@title", title);
                        insertCmd.Parameters.AddWithValue("@desc", description ?? "");
                        insertCmd.Parameters.AddWithValue("@type", type);
                        insertCmd.Parameters.AddWithValue("@ctx", displayContext);
                        insertCmd.Parameters.AddWithValue("@cover", coverId.HasValue && coverId.Value > 0 ? coverId.Value : (object)DBNull.Value);
                        collectionId = Convert.ToInt64(insertCmd.ExecuteScalar());
                    }
                }
            }

            return collectionId;
        }
    }
}