using Microsoft.AspNetCore.Mvc;
using MoozicOrb.Extensions;

namespace MoozicOrb.Controllers
{
    public class LocationController : Controller
    {
        //public IActionResult Index()
        //{
        //    return View();
        //}

        public IActionResult StatePage(string state)
        {
            if(Request.IsSpaRequest())
            {
                return PartialView("_LocationPartial");
            }
            else
            {
                return RedirectToAction("Index", "Home");
            }
        }
    }    
}
