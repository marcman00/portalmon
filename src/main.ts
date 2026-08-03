// Local dev bootstrap — wires up the globals the Portalmon excerpt expects
// (a site-wide `ko` / `$`, bootstrap CSS/JS, and the icon loader), then
// hands off to the real entry point unmodified.
import "./globals";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

import "./main.css";
import "./picon";
import "./site-bindings-stub";

import "../Areas/Portalmon/Content/styles.scss";
import "../Areas/Portalmon/Scripts/PortalmonController";
