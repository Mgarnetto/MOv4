using MySql.Data.MySqlClient;
using MoozicOrb.Models;
using System.Collections.Generic;
using System;

namespace MoozicOrb.IO
{
    public class LocationIO
    {
        // 1. Get Countries (Items with NO parent)
        public List<Location> GetCountries()
        {
            var list = new List<Location>();
            string sql = "SELECT id, parent_id, name, code FROM locations WHERE parent_id IS NULL ORDER BY name ASC";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(MapLocation(reader));
                    }
                }
            }
            return list;
        }

        // 2. Get States (Items belonging to a specific Country ID)
        public List<Location> GetStates(int countryId)
        {
            var list = new List<Location>();
            string sql = "SELECT id, parent_id, name, code FROM locations WHERE parent_id = @pid ORDER BY name ASC";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@pid", countryId);
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            list.Add(MapLocation(reader));
                        }
                    }
                }
            }
            return list;
        }

        /// <summary>
        /// Retrieves a state location from the database by its code.
        /// </summary>
        /// <param name="stateCode">The code of the state to retrieve.</param>
        /// <returns>The <see cref="Location"/> object if found; otherwise, null.</returns>
        public Location GetState(string StateCode)
        {

            string stateCode;

            string[] str = StateCode.Split('-');

            if (str.Length > 0)
                {
                stateCode = str[1];
            }
            else
            {
                stateCode = StateCode;
            }

            Location location = null;
            string sql = "SELECT id, parent_id, name, code FROM locations WHERE code = @code LIMIT 1";
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@code", stateCode);
                    using (var reader = cmd.ExecuteReader())
                    {
                        if (reader.Read())
                        {
                            location = MapLocation(reader);
                        }
                    }
                }
            }
            return location;
        }

        // Helper: Maps database row to C# Object
        private Location MapLocation(MySqlDataReader reader)
        {
            return new Location
            {
                Id = reader.GetInt32("id"),
                // Check for NULL in database before reading integer
                ParentId = reader.IsDBNull(reader.GetOrdinal("parent_id")) ? (int?)null : reader.GetInt32("parent_id"),
                Name = reader.GetString("name"),
                Code = reader.IsDBNull(reader.GetOrdinal("code")) ? null : reader.GetString("code")
            };
        }
    }
}