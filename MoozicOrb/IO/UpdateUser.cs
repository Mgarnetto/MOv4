using MySql.Data.MySqlClient;
using MoozicOrb.Models;
using System;

namespace MoozicOrb.IO
{
    public class UpdateUser
    {
        // --- NEW: Full Profile Update (Feb 2026) ---
        // Call this from your SettingsController when saving the "Edit Profile" form.
        public bool UpdateExtendedProfile(User user)
        {
            string sql = @"
                UPDATE `user` 
                SET 
                    dob = @dob,
                    location_id = @loc,
                    
                    account_type_primary = @acct1,
                    account_type_secondary = @acct2,
                    
                    genre_primary = @gen1,
                    genre_secondary = @gen2,
                    
                    booking_email = @bookmail,
                    phone_main = @phmain,
                    phone_booking = @phbook,
                    
                    bio = @bio,
                    visibility_id = @vis
                WHERE user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    // IDs
                    cmd.Parameters.AddWithValue("@uid", user.UserId);

                    // Location & Date
                    cmd.Parameters.AddWithValue("@dob", user.Dob ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@loc", user.LocationId ?? (object)DBNull.Value);

                    // Account Roles
                    cmd.Parameters.AddWithValue("@acct1", user.AccountTypePrimary ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@acct2", user.AccountTypeSecondary ?? (object)DBNull.Value);

                    // Genres
                    cmd.Parameters.AddWithValue("@gen1", user.GenrePrimary ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@gen2", user.GenreSecondary ?? (object)DBNull.Value);

                    // Contact
                    cmd.Parameters.AddWithValue("@bookmail", user.BookingEmail ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@phmain", user.PhoneMain ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@phbook", user.PhoneBooking ?? (object)DBNull.Value);

                    // Misc
                    cmd.Parameters.AddWithValue("@bio", user.Bio ?? "");
                    cmd.Parameters.AddWithValue("@vis", user.VisibilityId);

                    return cmd.ExecuteNonQuery() > 0;
                }
            }
        }

        // --- SPECIFIC SECTION UPDATES ---

        // 1. Updated PAGE Settings (Updated to accept Nullable Ints for Roles/Genres)
        public bool UpdatePageSettings(int userId, string bio, string coverImage, string bookingEmail, string layoutJson,
                                       string phoneBooking, int? acctPrimary, int? acctSecondary, int? genrePrimary, int? genreSecondary)
        {
            string sql = @"
                UPDATE `user` 
                SET bio = @bio, 
                    cover_image_url = @cover,
                    booking_email = @book_email,
                    profile_layout = @layout,
                    phone_booking = @phone_book,
                    account_type_primary = @acct1,
                    account_type_secondary = @acct2,
                    genre_primary = @gen1,
                    genre_secondary = @gen2
                WHERE user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@bio", bio ?? "");
                    cmd.Parameters.AddWithValue("@cover", coverImage ?? "");
                    cmd.Parameters.AddWithValue("@book_email", bookingEmail ?? "");
                    cmd.Parameters.AddWithValue("@layout", string.IsNullOrEmpty(layoutJson) ? "[\"posts\",\"music\",\"store\"]" : layoutJson);

                    // Additions (Handle Nullable types)
                    cmd.Parameters.AddWithValue("@phone_book", phoneBooking ?? (object)DBNull.Value);

                    cmd.Parameters.AddWithValue("@acct1", (object)acctPrimary ?? DBNull.Value);
                    cmd.Parameters.AddWithValue("@acct2", (object)acctSecondary ?? DBNull.Value);

                    cmd.Parameters.AddWithValue("@gen1", (object)genrePrimary ?? DBNull.Value);
                    cmd.Parameters.AddWithValue("@gen2", (object)genreSecondary ?? DBNull.Value);

                    cmd.Parameters.AddWithValue("@uid", userId);

                    return cmd.ExecuteNonQuery() > 0;
                }
            }
        }

        // 2. New ACCOUNT Settings (Handles DisplayName + Personal Info)
        public bool UpdateAccountSettings(int userId, string displayName, DateTime? dob, int? locationId, string phoneMain, int visibilityId)
        {
            string sql = @"
                UPDATE `user` 
                SET display_name = @name,
                    dob = @dob,
                    location_id = @loc,
                    phone_main = @phone_main,
                    visibility_id = @vis
                WHERE user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@name", displayName);
                    cmd.Parameters.AddWithValue("@dob", dob ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@loc", locationId ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@phone_main", phoneMain ?? (object)DBNull.Value);
                    cmd.Parameters.AddWithValue("@vis", visibilityId);

                    cmd.Parameters.AddWithValue("@uid", userId);
                    return cmd.ExecuteNonQuery() > 0;
                }
            }
        }

        // Update Profile Picture
        public bool UpdateProfilePic(int userId, string picUrl)
        {
            string sql = "UPDATE `user` SET profile_pic = @pic WHERE user_id = @uid";
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@pic", picUrl);
                    cmd.Parameters.AddWithValue("@uid", userId);
                    return cmd.ExecuteNonQuery() > 0;
                }
            }
        }

        // Update Display Name (Legacy helper)
        public bool UpdateDisplayName(int userId, string displayName)
        {
            string sql = "UPDATE `user` SET display_name = @name WHERE user_id = @uid";
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@name", displayName);
                    cmd.Parameters.AddWithValue("@uid", userId);
                    return cmd.ExecuteNonQuery() > 0;
                }
            }
        }
    }
}