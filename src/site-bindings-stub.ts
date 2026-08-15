/**
 * Local stand-in for two Knockout binding handlers the real site provides
 * globally (a Bootstrap-tooltip wrapper and a click-event-propagation guard).
 * Not part of the Portalmon excerpt - without these, Encounter/Dex/Battles
 * throw immediately since Knockout errors on an unregistered binding handler.
 * No-ops are fine here: they only affect tooltip popups and click bubbling,
 * not game logic.
 */
ko.bindingHandlers["bsTooltip"] = { init() {} };
ko.bindingHandlers["clickBubble"] = { init() {} };
