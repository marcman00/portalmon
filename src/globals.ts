// Self-contained on purpose: ES module evaluation runs each import's own
// top-level code to completion before moving to the next sibling import, so
// as long as this module is imported first in main.ts, window.$/window.ko
// are guaranteed set before PortalmonController.ts (which expects them as
// ambient globals) is ever evaluated.
import $ from "jquery";
import ko from "knockout";

(window as any).$ = $;
(window as any).jQuery = $;
(window as any).ko = ko;
