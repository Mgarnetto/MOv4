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

        // FIX: Changed string parameters to int and long, and inputType to int
        // CHANGED parameters to int and long
        public IViewComponentResult Invoke(int contextType, long contextId, bool allowPosting = true, int inputType = 1)
        {
            int viewerId = 0;
            var context = _httpContextAccessor.HttpContext;
            if (context != null && context.Request.Headers.TryGetValue("X-Session-Id", out var sessionId))
            {
                var session = SessionStore.GetSession(sessionId.ToString());
                if (session != null) viewerId = session.UserId;
            }

            var postIo = new GetPost();

            // Passing exact integers to the IO class
            var posts = postIo.Execute(contextType, contextId, viewerId, 1, 20, inputType, null, _resolver);

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