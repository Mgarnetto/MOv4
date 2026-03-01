using Microsoft.AspNetCore.Mvc;
using MoozicOrb.IO;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MySql.Data.MySqlClient;
using System;
using System.Threading.Tasks;

namespace MoozicOrb.ViewComponents
{
    public class DiscographyViewComponent : ViewComponent
    {
        private readonly IMediaResolverService _resolver;

        public DiscographyViewComponent(IMediaResolverService resolver)
        {
            _resolver = resolver;
        }

        public async Task<IViewComponentResult> InvokeAsync(int userId, bool isCurrentUser)
        {
            var model = new DiscographyViewModel
            {
                UserId = userId,
                IsCurrentUser = isCurrentUser
            };

            long carouselCollectionId = 0;

            // 1. Quick check to see if they have a Featured Carousel set up
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                string sql = "SELECT collection_id FROM collections WHERE user_id = @uid AND collection_type = 6 AND display_context = 'ProfileCarousel' LIMIT 1";
                using (var cmd = new MySqlCommand(sql, conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    var result = cmd.ExecuteScalar();
                    if (result != null && result != DBNull.Value)
                    {
                        carouselCollectionId = Convert.ToInt64(result);
                    }
                }
            }

            // 2. Hydrate the correct collection using your IO classes
            if (carouselCollectionId > 0)
            {
                // Fetch the carousel data first
                var potentialCarousel = new GetCollectionDetails().Execute(carouselCollectionId, _resolver);

                // THE FIX: Explicitly check if the carousel actually contains items before committing to it
                if (potentialCarousel != null && potentialCarousel.Items != null && potentialCarousel.Items.Count > 0)
                {
                    model.IsCarousel = true;
                    model.FeaturedCollection = potentialCarousel;
                }
                else
                {
                    // The carousel exists but is empty. Trigger the fallback logic.
                    model.IsCarousel = false;
                    model.FallbackCollection = new GetUserAudioCollection().Execute(userId, _resolver);
                }
            }
            else
            {
                // No carousel was ever created. Trigger the fallback logic.
                model.IsCarousel = false;
                model.FallbackCollection = new GetUserAudioCollection().Execute(userId, _resolver);
            }

            return View(model);
        }
    }

    public class DiscographyViewModel
    {
        public int UserId { get; set; }
        public bool IsCurrentUser { get; set; }
        public bool IsCarousel { get; set; }

        public ApiCollectionDto FeaturedCollection { get; set; }
        public ApiCollectionDto FallbackCollection { get; set; }
    }
}