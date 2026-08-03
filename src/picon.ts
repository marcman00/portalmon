/**
 * Minimal offline stand-in for the site-wide icon loader.
 * The real site resolves [data-picon] svgs via a shared icon service that
 * isn't part of this excerpt. Only two icons are used here, so they're
 * inlined directly (Material Design Icons, Apache-2.0).
 */
const ICONS: Record<string, string> = {
	"mdi:volume-high":
		"M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z",
	"mdi:volume-off":
		"M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z",
};

function renderPicons(): void
{
	document.querySelectorAll<SVGElement>("[data-picon]").forEach(el =>
	{
		if (el.dataset.piconRendered) return;
		const name = el.getAttribute("data-picon");
		const path = name ? ICONS[name] : null;
		if (!path) return;
		el.setAttribute("viewBox", "0 0 24 24");
		el.innerHTML = `<path fill="currentColor" d="${path}"></path>`;
		el.dataset.piconRendered = "true";
	});
}

document.addEventListener("DOMContentLoaded", renderPicons);
// Re-scan periodically since Knockout swaps overlay content in/out of the DOM.
setInterval(renderPicons, 500);
