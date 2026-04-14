using Microsoft.AspNetCore.Mvc;
using MoozicOrb.IO;
using MoozicOrb.Models;

namespace MoozicOrb.ViewComponents
{
    public class ListGenresViewComponent : ViewComponent
    {
        public IViewComponentResult Invoke()
        {
            var genres = new List<Genre>();

            genres = new GenreIO().GetAllGenres();

            return View(genres);
        }
    }
}
