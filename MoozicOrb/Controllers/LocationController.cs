using Microsoft.AspNetCore.Mvc;
using MoozicOrb.IO;
using System.Collections.Generic;

namespace MoozicOrb.Controllers
{
    // We add specific routes so JS can find it easily
    public class LocationController : Controller
    {
        private readonly LocationIO _locationIo;

        public LocationController()
        {
            _locationIo = new LocationIO();
        }

        // API Endpoint: /api/locations/states/1 (where 1 is US)
        [HttpGet("api/locations/states/{countryId}")]
        public IActionResult GetStates(int countryId)
        {
            var states = _locationIo.GetStates(countryId);
            return Ok(states);
        }
    }
}