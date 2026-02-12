using System;
using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class InsertGroupMessage
    {
        public InsertGroupMessage() { }

        public long Insert(long groupId, int senderId, string messageText)
        {
            // Standardizing the query
            string query = @"
                INSERT INTO group_messages
                    (group_id, sender_id, message_text, message_deleted, timestamp)
                VALUES
                    (@groupId, @senderId, @messageText, 0, @timestamp);
                SELECT LAST_INSERT_ID();";

            using var connection = new MySqlConnection(DBConn1.ConnectionString);
            connection.Open();

            using var command = new MySqlCommand(query, connection);
            command.Parameters.AddWithValue("@groupId", groupId);
            command.Parameters.AddWithValue("@senderId", senderId);
            command.Parameters.AddWithValue("@messageText", messageText);

            // Using UtcNow and being explicit about the DateTime kind
            var now = DateTime.UtcNow;
            command.Parameters.AddWithValue("@timestamp", now);

            object result = command.ExecuteScalar();
            return (result != null) ? Convert.ToInt64(result) : 0;
        }
    }
}
