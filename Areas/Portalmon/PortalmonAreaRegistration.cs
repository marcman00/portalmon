using System.Web.Mvc;

namespace Epic.Infrastructure.Portal.MVC.Areas.Portalmon
{
	public class PortalmonAreaRegistration : AreaRegistration
	{
		public override string AreaName => "Portalmon";

		public override void RegisterArea(AreaRegistrationContext context)
		{
			context.MapRoute(
				"Portalmon_default",
				"Portalmon/{controller}/{action}/{id}",
				new { Controller = "Home", action = "Index", id = UrlParameter.Optional }
			);
		}
	}
}