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

        // --- EXISTING CODE PRESERVED BELOW ---

        public User GetUserById(int userId)
        {
            return FetchUser("SELECT * FROM `user` WHERE user_id = @val", "@val", userId);
        }

        public User GetUserByEmail(string email)
        {
            return FetchUser("SELECT * FROM `user` WHERE email = @val", "@val", email);
        }

        // Search Users (Updated to search by Display Name or Stage Name as well)
        public List<User> SearchUsers(string term)
        {
            var users = new List<User>();
            // You might want to add 'OR account_type_primary LIKE @term' here later
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

            // 2. Account Types (UPDATED: String -> Int)
            if (HasColumn(rdr, "account_type_primary") && rdr["account_type_primary"] != DBNull.Value)
                user.AccountTypePrimary = Convert.ToInt32(rdr["account_type_primary"]);

            if (HasColumn(rdr, "account_type_secondary") && rdr["account_type_secondary"] != DBNull.Value)
                user.AccountTypeSecondary = Convert.ToInt32(rdr["account_type_secondary"]);

            // 3. Genres (UPDATED: String -> Int)
            if (HasColumn(rdr, "genre_primary") && rdr["genre_primary"] != DBNull.Value)
                user.GenrePrimary = Convert.ToInt32(rdr["genre_primary"]);

            if (HasColumn(rdr, "genre_secondary") && rdr["genre_secondary"] != DBNull.Value)
                user.GenreSecondary = Convert.ToInt32(rdr["genre_secondary"]);

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