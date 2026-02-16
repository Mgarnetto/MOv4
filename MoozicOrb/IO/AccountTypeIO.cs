using MySql.Data.MySqlClient;
using MoozicOrb.Models;
using System.Collections.Generic;
using System;

namespace MoozicOrb.IO
{
    public class AccountTypeIO
    {
        // Get the full list of roles for dropdowns (Cached or Direct)
        public List<AccountType> GetAllRoles()
        {
            var list = new List<AccountType>();
            string sql = "SELECT id, name FROM account_types ORDER BY name ASC";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        list.Add(new AccountType
                        {
                            Id = reader.GetInt32("id"),
                            Name = reader.GetString("name")
                        });
                    }
                }
            }
            return list;
        }

        // Update a specific user's roles (Standalone update)
        public bool UpdateUserRoles(int userId, string primaryRole, string secondaryRole)
        {
            string sql = @"
                UPDATE `user` 
                SET account_type_primary = @prim, 
                    account_type_secondary = @sec 
                WHERE user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@prim", primaryRole ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@sec", secondaryRole ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@uid", userId);

                    cmd.ExecuteNonQuery();
                    return true;
                }
            }
        }
    }
}