using MySql.Data.MySqlClient;
using System.Collections.Generic;

namespace MoozicOrb.IO
{
    public class GetFollowers
    {
        public List<int> Execute(int userId)
        {
            var followers = new List<int>();
            // Assuming a 'user_follows' table exists: follower_id, target_user_id
            string sql = "SELECT follower_id FROM user_follows WHERE target_user_id = @uid";

            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    using (var r = cmd.ExecuteReader())
                    {
                        while (r.Read()) followers.Add(r.GetInt32(0));
                    }
                }
            }
            return followers;
        }
    }

    public class InsertFollow
    {
        public bool Execute(int followerId, int targetUserId)
        {
            if (followerId == targetUserId) return false; // Cannot follow self

            string sql = "INSERT INTO user_follows (follower_id, target_user_id, created_at) VALUES (@fid, @tid, NOW())";

            try
            {
                using (var conn = new MySqlConnection(DBConn1.ConnectionString))
                {
                    conn.Open();
                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@fid", followerId);
                        cmd.Parameters.AddWithValue("@tid", targetUserId);
                        return cmd.ExecuteNonQuery() > 0;
                    }
                }
            }
            catch { return false; } // Likely duplicate entry if no unique constraint, or DB error
        }
    }

    public class DeleteFollow
    {
        public bool Execute(int followerId, int targetUserId)
        {
            string sql = "DELETE FROM user_follows WHERE follower_id = @fid AND target_user_id = @tid";

            try
            {
                using (var conn = new MySqlConnection(DBConn1.ConnectionString))
                {
                    conn.Open();
                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@fid", followerId);
                        cmd.Parameters.AddWithValue("@tid", targetUserId);
                        return cmd.ExecuteNonQuery() > 0;
                    }
                }
            }
            catch { return false; }
        }
    }

    public class IsFollowing
    {
        public bool Execute(int followerId, int targetUserId)
        {
            // If checking self, usually false or irrelevant, but let's return false
            if (followerId == targetUserId) return false;

            string sql = "SELECT COUNT(1) FROM user_follows WHERE follower_id = @fid AND target_user_id = @tid";

            try
            {
                using (var conn = new MySqlConnection(DBConn1.ConnectionString))
                {
                    conn.Open();
                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@fid", followerId);
                        cmd.Parameters.AddWithValue("@tid", targetUserId);
                        long count = (long)cmd.ExecuteScalar();
                        return count > 0;
                    }
                }
            }
            catch { return false; }
        }
    }

    public class GetFollowCounts
    {
        public (int Followers, int Following) Execute(int userId)
        {
            int followers = 0;
            int following = 0;

            string sql = @"
                SELECT 
                    (SELECT COUNT(1) FROM user_follows WHERE target_user_id = @uid) as Followers,
                    (SELECT COUNT(1) FROM user_follows WHERE follower_id = @uid) as Following
            ";

            try
            {
                using (var conn = new MySqlConnection(DBConn1.ConnectionString))
                {
                    conn.Open();
                    using (var cmd = new MySqlCommand(sql, conn))
                    {
                        cmd.Parameters.AddWithValue("@uid", userId);
                        using (var r = cmd.ExecuteReader())
                        {
                            if (r.Read())
                            {
                                followers = r.GetInt32(0);
                                following = r.GetInt32(1);
                            }
                        }
                    }
                }
            }
            catch { }

            return (followers, following);
        }
    }
}