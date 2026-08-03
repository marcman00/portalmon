// Regenerates index.html from the Areas/Portalmon Razor views.
// Portalmon's real site renders these server-side via @Html.Partial; here we
// inline them once at build time since there's no ASP.NET host locally.
// Re-run (npm run gen:html) any time the .cshtml files change.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const viewsHome = path.join(root, "Areas/Portalmon/Views/Home");

const read = name => readFileSync(path.join(viewsHome, name), "utf8").replace(/^﻿/, "");

const PARTIAL_RE = /@Html\.Partial\("~\/Areas\/Portalmon\/Views\/Home\/([A-Za-z]+\.cshtml)"\)/g;

// Resolves @Html.Partial includes recursively (a partial including another
// partial), not just one level deep. Capped so a circular include fails loudly
// instead of hanging.
function inlinePartials(html)
{
	const MAX_PASSES = 20;
	for (let pass = 0; pass < MAX_PASSES; pass++)
	{
		if (!PARTIAL_RE.test(html)) return html;
		html = html.replace(PARTIAL_RE, (_match, file) => read(file));
	}
	throw new Error(`inlinePartials: still resolving @Html.Partial includes after ${MAX_PASSES} passes — possible circular partial reference.`);
}

let indexBody = read("Index.cshtml");
indexBody = inlinePartials(indexBody);
// Drop the compiled-bundle include from the real site — we supply our own
// script tag via /src/main.ts below.
indexBody = indexBody.replace(/@Html\.Partial\("~\/dist\/Portalmon\.cshtml"\)\s*/, "");

const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Portalmon (local)</title>
</head>
<body>
	<div id="portalmon-page">
${indexBody}
	</div>
	<script type="module" src="/src/main.ts"></script>
</body>
</html>
`;

writeFileSync(path.join(root, "index.html"), html, "utf8");
console.log("Generated index.html");
