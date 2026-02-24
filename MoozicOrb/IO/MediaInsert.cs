using MySql.Data.MySqlClient;
using System;

namespace MoozicOrb.IO
{
    public class InsertAudio
    {
        public long Execute(int userId, string title, string filePath, string snippetPath, int duration,
                            int storageProvider = 1, int visibility = 0, decimal price = 0.00m)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                // FIXED: 'duration_sec' and 'file_path'
                string sql = @"INSERT INTO media_audio 
                               (user_id, title, file_path, snippet_path, duration_sec, storage_provider, visibility, price) 
                               VALUES 
                               (@uid, @title, @path, @snippet, @duration, @storage, @vis, @price);
                               SELECT LAST_INSERT_ID();";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@title", title);
                    cmd.Parameters.AddWithValue("@path", filePath);
                    cmd.Parameters.AddWithValue("@snippet", snippetPath);
                    cmd.Parameters.AddWithValue("@duration", duration);
                    cmd.Parameters.AddWithValue("@storage", storageProvider);
                    cmd.Parameters.AddWithValue("@vis", visibility);
                    cmd.Parameters.AddWithValue("@price", price);

                    return Convert.ToInt64(cmd.ExecuteScalar());
                }
            }
        }
    }

    public class InsertVideo
    {
        public long Execute(int userId, string title, string filePath, string thumbnailPath, int duration, int width, int height,
                            int storageProvider = 1, int visibility = 0, decimal price = 0.00m)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                // FIXED: 'duration_sec', 'thumb_path', and 'file_path'
                string sql = @"INSERT INTO media_video 
                               (user_id, title, file_path, thumb_path, duration_sec, width, height, storage_provider, visibility, price) 
                               VALUES 
                               (@uid, @title, @path, @thumb, @duration, @w, @h, @storage, @vis, @price);
                               SELECT LAST_INSERT_ID();";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@title", title);
                    cmd.Parameters.AddWithValue("@path", filePath);
                    cmd.Parameters.AddWithValue("@thumb", thumbnailPath);
                    cmd.Parameters.AddWithValue("@duration", duration);
                    cmd.Parameters.AddWithValue("@w", width);
                    cmd.Parameters.AddWithValue("@h", height);
                    cmd.Parameters.AddWithValue("@storage", storageProvider);
                    cmd.Parameters.AddWithValue("@vis", visibility);
                    cmd.Parameters.AddWithValue("@price", price);

                    return Convert.ToInt64(cmd.ExecuteScalar());
                }
            }
        }
    }

    public class InsertImage
    {
        public long Execute(int userId, string title, string filePath, int width, int height,
                            int storageProvider = 1, int visibility = 0, decimal price = 0.00m)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                // FIXED: 'file_path'
                string sql = @"INSERT INTO media_images 
                               (user_id, title, file_path, width, height, storage_provider, visibility, price) 
                               VALUES 
                               (@uid, @title, @path, @w, @h, @storage, @vis, @price);
                               SELECT LAST_INSERT_ID();";

                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    cmd.Parameters.AddWithValue("@title", title);
                    cmd.Parameters.AddWithValue("@path", filePath);
                    cmd.Parameters.AddWithValue("@w", width);
                    cmd.Parameters.AddWithValue("@h", height);
                    cmd.Parameters.AddWithValue("@storage", storageProvider);
                    cmd.Parameters.AddWithValue("@vis", visibility);
                    cmd.Parameters.AddWithValue("@price", price);

                    return Convert.ToInt64(cmd.ExecuteScalar());
                }
            }
        }
    }
}