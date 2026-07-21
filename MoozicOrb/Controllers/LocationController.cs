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

        public IActionResult StatePage()
        {

            int a = 1;
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
