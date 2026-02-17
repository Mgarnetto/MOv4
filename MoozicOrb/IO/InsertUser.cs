using MySql.Data.MySqlClient;
using MoozicOrb.Models;
using System;

namespace MoozicOrb.IO
{
    public class InsertUser
    {
        public long Execute(User user)
        {
            // Updated to include new Country/State columns (Feb 2026)
            string sql = @"
                INSERT INTO `user` 
                (
                    first_name, middle_name, last_name,
                    username, email, display_name,
                    profile_pic, cover_image_url, bio,
                    is_creator, profile_layout, user_groups,
                    dob, country_id, state_id,
                    account_type_primary, account_type_secondary,
                    genre_primary, genre_secondary,
                    visibility_id,
                    booking_email, phone_main, phone_booking
                )
                VALUES 
                (
                    @fname, @mname, @lname,
                    @username, @email, @display,
                    @pic, @cover, @bio,
                    @creator, @layout, @groups,
                    @dob, @country, @state,
                    @acct1, @acct2,
                    @gen1, @gen2,
                    @vis,
                    @bookmail, @phmain, @phbook
                );
                SELECT LAST_INSERT_ID();";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    // 1. Legal Names
                    cmd.Parameters.AddWithValue("@fname", user.FirstName ?? "");
                    cmd.Parameters.AddWithValue("@mname", user.MiddleName ?? "");
                    cmd.Parameters.AddWithValue("@lname", user.LastName ?? "");

                    // 2. Identity
                    cmd.Parameters.AddWithValue("@username", user.UserName ?? "");
                    cmd.Parameters.AddWithValue("@email", user.Email ?? "");
                    cmd.Parameters.AddWithValue("@display", user.DisplayName ?? user.UserName);

                    // 3. Profile Images & Bio
                    cmd.Parameters.AddWithValue("@pic", user.ProfilePic ?? "/img/profile_default.jpg");
                    cmd.Parameters.AddWithValue("@cover", user.CoverImageUrl ?? "/img/default_cover.jpg");
                    cmd.Parameters.AddWithValue("@bio", user.Bio ?? "");

                    // 4. Flags & Settings
                    cmd.Parameters.AddWithValue("@creator", user.IsCreator ? 1 : 0);

                    // JSON Layout
                    cmd.Parameters.AddWithValue("@layout", user.ProfileLayoutJson ?? (object)DBNull.Value);

                    // Groups (Default to "9" for Standard User if empty)
                    cmd.Parameters.AddWithValue("@groups", string.IsNullOrEmpty(user.UserGroups) ? "9" : user.UserGroups);

                    // 5. NEW FIELDS (Feb 2026)

                    // Date & Location (Country/State)
                    cmd.Parameters.AddWithValue("@dob", user.Dob ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@country", user.CountryId ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@state", user.StateId ?? (object)DBNull.Value);

                    // Account Types
                    cmd.Parameters.AddWithValue("@acct1", user.AccountTypePrimary ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@acct2", user.AccountTypeSecondary ?? (object)DBNull.Value);

                    // Genres
                    cmd.Parameters.AddWithValue("@gen1", user.GenrePrimary ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@gen2", user.GenreSecondary ?? (object)DBNull.Value);

                    // Visibility (Default 0 is handled by C# model initialization, but good to be explicit)
                    cmd.Parameters.AddWithValue("@vis", user.VisibilityId);

                    // Contact Info
                    cmd.Parameters.AddWithValue("@bookmail", user.BookingEmail ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@phmain", user.PhoneMain ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@phbook", user.PhoneBooking ?? (object)DBNull.Value);

                    return Convert.ToInt64(cmd.ExecuteScalar());
                }
            }
        }
    }
}
