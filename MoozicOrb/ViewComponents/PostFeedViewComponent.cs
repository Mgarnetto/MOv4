using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MoozicOrb.API.Models;
using MoozicOrb.API.Services; // <-- ADDED
using MoozicOrb.IO;
using MoozicOrb.Services;
using System.Collections.Generic;

namespace MoozicOrb.ViewComponents
{
    public class PostFeedViewComponent : ViewComponent
    {
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IMediaResolverService _resolver; // <-- ADDED

        public PostFeedViewComponent(IHttpContextAccessor httpContextAccessor, IMediaResolverService resolver)
        {
            _httpContextAccessor = httpContextAccessor;
            _resolver = resolver; // <-- ADDED
        }

        public IViewComponentResult Invoke(string contextType, string contextId, bool allowPosting = true, string inputType = "standard")
        {
            // 1. Determine Viewer ID (So we know if they Liked posts)
            int viewerId = 0;
            var context = _httpContextAccessor.HttpContext;
            if (context != null && context.Request.Headers.TryGetValue("X-Session-Id", out var sessionId))
            {
                // Using your SessionStore helper safely
                var session = SessionStore.GetSession(sessionId.ToString());
                if (session != null) viewerId = session.UserId;
            }

            // 2. Fetch Data with Viewer Context
            var postIo = new GetPost();

            // <-- FIX: Pass _resolver into the Execute method
            var posts = postIo.Execute(contextType, contextId, viewerId, 1, 20, inputType, null, _resolver);

            // 3. Build Model
            var model = new PostFeedViewModel
            {
                ContextType = contextType,
                ContextId = contextId,
                AllowPosting = allowPosting,
                InputType = inputType,
                InitialPosts = posts ?? new List<PostDto>(),
                ViewerId = viewerId
            };

            return View(model);
        }
    }
}