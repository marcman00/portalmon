using System.Web.Mvc;

namespace Epic.Infrastructure.Portal.MVC.Areas.Portalmon.Controllers
{
	public class HomeController : Controller
	{
		/// <summary>
		/// Routing for Portalmon
		/// </summary>
		/// <returns></returns>
		public ActionResult Index(int id = 0)
		{
			return View(id);
		}
	}
}