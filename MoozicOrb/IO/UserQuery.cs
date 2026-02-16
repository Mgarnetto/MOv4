using MySql.Data.MySqlClient;
using MoozicOrb.Models;
using System;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class UserQuery
    {
        // --- ADDED: IO Helpers for Dropdowns ---
        private readonly AccountTypeIO _roleIo;
        private readonly GenreIO _genreIo;

        public UserQuery()
        {
            _roleIo = new AccountTypeIO();
            _genreIo = new GenreIO();
        }

        // --- ADDED: Passthrough Methods ---
        public List<AccountType> GetAccountTypes()
        {
            return _roleIo.GetAllRoles();
        }

        public List<Genre> GetGenres()
        {
            return _genreIo.GetAllGenres();
        }

        // --- MAIN QUERIES (Updated with JOINS) ---

        public User GetUserById(int userId)
        {
            // Join account_types and genres to get the names for display
            string sql = @"
                SELECT u.*, 
                       at1.name as at1_name, 
                       at2.name as at2_name,
                       g1.name as g1_name, 
                       g2.name as g2_name
                FROM `user` u
                LEFT JOIN account_types at1 ON u.account_type_primary = at1.id
                LEFT JOIN account_types at2 ON u.account_type_secondary = at2.id
                LEFT JOIN genres g1 ON u.genre_primary = g1.id
                LEFT JOIN genres g2 ON u.genre_secondary = g2.id
                WHERE u.user_id = @val";

            return FetchUser(sql, "@val", userId);
        }

        public User GetUserByEmail(string email)
        {
            string sql = @"
                SELECT u.*, 
                       at1.name as at1_name, 
                       at2.name as at2_name,
                       g1.name as g1_name, 
                       g2.name as g2_name
                FROM `user` u
                LEFT JOIN account_types at1 ON u.account_type_primary = at1.id
                LEFT JOIN account_types at2 ON u.account_type_secondary = at2.id
                LEFT JOIN genres g1 ON u.genre_primary = g1.id
                LEFT JOIN genres g2 ON u.genre_secondary = g2.id
                WHERE u.email = @val";

            return FetchUser(sql, "@val", email);
        }

        // Search Users (Updated to search by Display Name or Stage Name as well)
        public List<User> SearchUsers(string term)
        {
            var users = new List<User>();
            // Note: Search results might not need the full JOINs unless you display roles in the search dropdown
            string sql = @"
                SELECT * FROM `user` 
                WHERE username LIKE @term 
                   OR display_name LIKE @term 
                   OR email LIKE @term
                LIMIT 20";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@term", "%" + term + "%");
                    using (var rdr = cmd.ExecuteReader())
                    {
                        while (rdr.Read())
                        {
                            users.Add(MapUser(rdr));
                        }
                    }
                }
            }
            return users;
        }

        private User FetchUser(string sql, string paramName, object paramValue)
        {
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue(paramName, paramValue);
                    using (var rdr = cmd.ExecuteReader())
                    {
                        if (rdr.Read()) return MapUser(rdr);
                    }
                }
            }
            return null;
        }

        private User MapUser(MySqlDataReader rdr)
        {
            var user = new User
            {
                UserId = rdr.GetInt32("user_id"),
                FirstName = rdr["first_name"].ToString(),
                MiddleName = rdr["middle_name"].ToString(),
                LastName = rdr["last_name"].ToString(),
                UserName = rdr["username"].ToString(),
                Email = rdr["email"] == DBNull.Value ? "" : rdr["email"].ToString(),
                DisplayName = HasColumn(rdr, "display_name") ? rdr["display_name"].ToString() : rdr["username"].ToString(),
                ProfilePic = rdr["profile_pic"] == DBNull.Value ? "/img/default.png" : rdr["profile_pic"].ToString(),
                CoverImageUrl = HasColumn(rdr, "cover_image_url") ? rdr["cover_image_url"].ToString() : "",
                Bio = HasColumn(rdr, "bio") ? rdr["bio"].ToString() : "",
                IsCreator = HasColumn(rdr, "is_creator") && (Convert.ToInt32(rdr["is_creator"]) == 1),
                ProfileLayoutJson = HasColumn(rdr, "profile_layout") ? rdr["profile_layout"].ToString() : "[]",
                UserGroups = rdr["user_groups"].ToString()
            };

            // --- MAPPING NEW FIELDS (Feb 2026) ---

            // 1. Date & Location
            if (HasColumn(rdr, "dob") && rdr["dob"] != DBNull.Value)
                user.Dob = Convert.ToDateTime(rdr["dob"]);

            if (HasColumn(rdr, "location_id") && rdr["location_id"] != DBNull.Value)
                user.LocationId = Convert.ToInt32(rdr["location_id"]);

            // 2. Account Types (Map IDs AND Names)
            if (HasColumn(rdr, "account_type_primary") && rdr["account_type_primary"] != DBNull.Value)
                user.AccountTypePrimary = Convert.ToInt32(rdr["account_type_primary"]);

            if (HasColumn(rdr, "account_type_secondary") && rdr["account_type_secondary"] != DBNull.Value)
                user.AccountTypeSecondary = Convert.ToInt32(rdr["account_type_secondary"]);

            // Map Names from Joins (if present)
            if (HasColumn(rdr, "at1_name") && rdr["at1_name"] != DBNull.Value)
                user.AccountTypePrimaryName = rdr["at1_name"].ToString();

            if (HasColumn(rdr, "at2_name") && rdr["at2_name"] != DBNull.Value)
                user.AccountTypeSecondaryName = rdr["at2_name"].ToString();

            // 3. Genres (Map IDs AND Names)
            if (HasColumn(rdr, "genre_primary") && rdr["genre_primary"] != DBNull.Value)
                user.GenrePrimary = Convert.ToInt32(rdr["genre_primary"]);

            if (HasColumn(rdr, "genre_secondary") && rdr["genre_secondary"] != DBNull.Value)
                user.GenreSecondary = Convert.ToInt32(rdr["genre_secondary"]);

            // Map Names from Joins (if present)
            if (HasColumn(rdr, "g1_name") && rdr["g1_name"] != DBNull.Value)
                user.GenrePrimaryName = rdr["g1_name"].ToString();

            if (HasColumn(rdr, "g2_name") && rdr["g2_name"] != DBNull.Value)
                user.GenreSecondaryName = rdr["g2_name"].ToString();

            // 4. Visibility & Contact
            if (HasColumn(rdr, "visibility_id") && rdr["visibility_id"] != DBNull.Value)
                user.VisibilityId = Convert.ToInt32(rdr["visibility_id"]);

            if (HasColumn(rdr, "booking_email") && rdr["booking_email"] != DBNull.Value)
                user.BookingEmail = rdr["booking_email"].ToString();

            if (HasColumn(rdr, "phone_main") && rdr["phone_main"] != DBNull.Value)
                user.PhoneMain = rdr["phone_main"].ToString();

            if (HasColumn(rdr, "phone_booking") && rdr["phone_booking"] != DBNull.Value)
                user.PhoneBooking = rdr["phone_booking"].ToString();

            return user;
        }

        private bool HasColumn(MySqlDataReader rdr, string columnName)
        {
            for (int i = 0; i < rdr.FieldCount; i++)
            {
                if (rdr.GetName(i).Equals(columnName, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }
    }
}