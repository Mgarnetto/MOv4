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
    public class VideoCarouselViewComponent : ViewComponent
    {
        private readonly IMediaResolverService _resolver;

        public VideoCarouselViewComponent(IMediaResolverService resolver)
        {
            _resolver = resolver;
        }

        public IViewComponentResult Invoke(int userId)
        {
            var model = new VideoCarouselViewModel { IsFallback = true, Items = new List<PostDto>() };
            long collectionId = 0;

            // 1. Find Custom Collection
            using (var conn = new MySqlConnection(DBConn1.ConnectionString))
            {
                conn.Open();
                using (var cmd = new MySqlCommand("SELECT collection_id FROM collections WHERE user_id = @uid AND display_context = 'video' ORDER BY created_at DESC LIMIT 1", conn))
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
                    var postIo = new GetPost();
                    foreach (var item in details.Items.Take(10)) // Cap at 10 items
                    {
                        var post = postIo.Execute(item.TargetId, userId, _resolver);
                        if (post != null) model.Items.Add(post);
                    }
                }
            }

            // 3. SSR Fallback (Most Recent Videos)
            if (model.Items.Count == 0)
            {
                model.IsFallback = true;
                // Fetch recent videos: contextType 1, contextId userId, mediaType 2
                var posts = new GetPost().Execute(1, userId, userId, 1, 5, null, 2, _resolver);
                if (posts != null) model.Items.AddRange(posts);
            }

            return View(model);
        }
    }
}

namespace MoozicOrb.API.Models
{
    public class VideoCarouselViewModel
    {
        public bool IsFallback { get; set; }
        public List<PostDto> Items { get; set; }
    }
}