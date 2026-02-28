using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class UpdateAudioTitle
    {
        public void Execute(long audioId, string newTitle)
        {
            if (string.IsNullOrWhiteSpace(newTitle)) return;

            string sql = "UPDATE media_audio SET title = @title WHERE audio_id = @id";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@title", newTitle);
                    cmd.Parameters.AddWithValue("@id", audioId);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}