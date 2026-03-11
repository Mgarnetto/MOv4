using MySql.Data.MySqlClient;

namespace MoozicOrb.IO
{
    public class UpdateVideoTitle
    {
        public void Execute(long mediaId, string title)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                string sql = "UPDATE media_video SET title = @title WHERE video_id = @id";
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@title", title);
                    cmd.Parameters.AddWithValue("@id", mediaId);
                    cmd.ExecuteNonQuery();
                }
            }
        }
    }
}