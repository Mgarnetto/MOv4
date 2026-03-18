using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services;
using MoozicOrb.IO;
using MySql.Data.MySqlClient;
using System;
using System.Collections.Generic;
using System.Linq;

namespace MoozicOrb.ViewComponents
{
    public class ImageCarouselViewComponent : ViewComponent
    {
        private readonly IMediaResolverService _resolver;

        public ImageCarouselViewComponent(IMediaResolverService resolver)
        {
            _resolver = resolver;
        }

        public IViewComponentResult Invoke(int userId)
        {
            var model = new VideoCarouselViewModel { IsFallback = true, Items = new List<PostDto>() };
            long collectionId = 0;

            // 1. Find Custom Collection (Using 'gallery' context)
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand("SELECT collection_id FROM collections WHERE user_id = @uid AND display_context = 'gallery' ORDER BY created_at DESC LIMIT 1", conn))
                {
                    cmd.Parameters.AddWithValue("@uid", userId);
                    var res = cmd.ExecuteScalar();
                    if (res != null && res != DBNull.Value) collectionId = Convert.ToInt64(res);
                }
            }

            // 2. Load Custom Items
            if (collectionId > 0)
            {
                var details = new GetCollectionDetails().Execute(collectionId, _resolver);
                if (details != null && details.Items != null && details.Items.Count > 0)
                {
                    model.IsFallback = false;
                    foreach (var item in details.Items.Take(10))
                    {
                        model.Items.Add(new PostDto
                        {
                            Id = item.PostId ?? item.TargetId,
                            Type = item.TargetType == 0 ? 8 : Constants.PostTypes.Image,
                            Title = item.Title ?? "Untitled",
                            ImageUrl = item.ArtUrl ?? "/img/default_cover.jpg",
                            AuthorName = item.ArtistName,
                            Price = item.Price
                        });
                    }
                }
            }

            // 3. SSR Fallback (Most Recent Images)
            if (model.Items.Count == 0)
            {
                model.IsFallback = true;
                // Param 7 is the PostType filter (Constants.PostTypes.Image)
                var posts = new GetPost().Execute(1, userId, userId, 1, 10, null, Constants.PostTypes.Image, _resolver);
                if (posts != null) model.Items.AddRange(posts);
            }

            return View(model);
        }
    }
}