using Microsoft.AspNetCore.Mvc;
using MoozicOrb.Extensions;
using MoozicOrb.IO;
using MoozicOrb.Models;
using System.Text;

namespace MoozicOrb.Controllers
{
    public class LocationController : Controller
    {
        //public IActionResult Index()
        //{
        //    return View();
        //}

        public IActionResult StatePage(string id)
        {            
            String[] st = id.Split('-');
            string sid = "";
            
            if (st.Length > 0) 
                sid = st[^1];

            sid.ToUpper();

            Location state = new LocationIO().GetState(sid);
            Location country = new LocationIO().GetCountryByCode(1);

            string statename = state.Name;
            string countryname = country.Name;

            if (Request.IsSpaRequest())
            {
                ViewBag.Title = statename + " Page";
                ViewBag.Country = countryname;

                return PartialView("_locationstuff");
            }
            else
            {
                return RedirectToAction("Index", "Home");
            }
        }
    }    
}
