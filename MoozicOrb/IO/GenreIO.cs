using MySql.Data.MySqlClient;
using MoozicOrb.Models;
using System.Collections.Generic;
using System;

namespace MoozicOrb.IO
{
    public class GenreIO
    {
        // 1. Get All System Genres (for Dropdowns/Filtering)
        public List<Genre> GetAllGenres()
        {
            var list = new List<Genre>();
            string sql = "SELECT id, name FROM genres ORDER BY name ASC";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new Genre
                        {
                            Id = reader.GetInt32("id"),
                            Name = reader.GetString("name")
                        });
                    }
                }
            }
            return list;
        }
    }
}
