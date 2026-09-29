using Microsoft.AspNetCore.Mvc;
using MoozicOrb.IO;
using MoozicOrb.Models;

namespace MoozicOrb.API.Controllers
{
    public class ContentSortController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }

        
    }
}
