using MoozicOrb.API.Models;
using MySql.Data.MySqlClient;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetCollectionDetails
    {
        public CollectionDto Execute(long collectionId)
        {
            CollectionDto collection = null;

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();

                // 1. Fetch Header Safely
                string sqlCol = "SELECT * FROM collections WHERE collection_id = @cid";
                using (var cmd = new MySqlCommand(sqlCol, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        if (rdr.Read())
                        {
                            collection = new CollectionDto
                            {
                                Id = rdr.GetInt64("collection_id"),
                                Title = rdr["title"].ToString(),
                                Type = rdr.GetInt32("collection_type"),
                                DisplayContext = rdr["display_context"].ToString(),
                                Items = new List<CollectionItemDto>()
                            };
                        }
                    }
                }

                if (collection == null) return null;

                // 2. Fetch raw item IDs (NO dangerous LEFT JOINS!)
                string sqlItems = "SELECT link_id, target_id, target_type FROM collection_items WHERE collection_id = @cid ORDER BY sort_order ASC";
                using (var cmd = new MySqlCommand(sqlItems, conn))
                {
                    cmd.Parameters.AddWithValue("@cid", collectionId);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            collection.Items.Add(new CollectionItemDto
                            {
                                LinkId = rdr.GetInt64("link_id"),
                                TargetId = rdr.GetInt64("target_id"),
                                TargetType = rdr.GetInt32("target_type")
                            });
                        }
                    }
                }
            }

            return collection;
        }
    }
}