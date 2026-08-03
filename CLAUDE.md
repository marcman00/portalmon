# Portalmon

A joke Pokemon-battler mashup themed around Epic/Portal (GLaDOS runs the "Enrichment Center"
testing facility, creatures are named after dev/IT concepts, gym leaders are internal
personas). Streamlined ruleset: no levels, no items, no XP grind — just catch, fight, evolve.

This checkout is a standalone local extraction of one Area (`Areas/Portalmon`) from a larger
ASP.NET MVC site, wired up to run on its own with Vite. Files outside that folder (`src/`,
`index.html`, `scripts/`, `vite.config.js`, `package.json`) are local-only scaffolding that
doesn't exist on the real site; the production site provides those equivalents (ASP.NET
routing/layout, jQuery/Knockout/Bootstrap bundles, a compiled `~/dist/Portalmon.cshtml`
script include, and a global icon loader for `[data-picon]` svgs, plus the `bsTooltip` /
`clickBubble` Knockout binding handlers stubbed out in `src/site-bindings-stub.ts`) itself.

`Areas/Portalmon` has since had a cleanup pass done on it locally (bug fixes, dead-code
removal, and splitting `styles.scss` / `_CombatManager.ts` into smaller files under
`Content/_*.scss` and `Scripts/combat/`) — see git history / commit messages for what
changed. **Any of those changes still need to be copied back to the production checkout**;
this local copy and the real site's `Areas/Portalmon` are not currently in sync.

## Running locally

```
npm install
npm run dev
```

`predev` regenerates `index.html` from the `.cshtml` views automatically. If you edit any
`Areas/Portalmon/Views/Home/*.cshtml` file, rerun `npm run gen:html` (or just restart `dev`)
to pick up the changes — `index.html` is generated, not hand-edited.

Sound files under `Areas/Portalmon/Content/Sound/` are not present in this checkout (not
committed). Missing tracks fail silently (caught in `SoundManager.ts`) — no need to add them
to run the app.

## Stack

- **Knockout.js** — the entire UI is one big view model (`PortalmonController`), bound via
  `data-bind` attributes and `<!-- ko if/foreach -->` comment bindings in the `.cshtml`
  views. No React/Vue, no build-time templating beyond Razor's `@Html.Partial` (which this
  checkout inlines at build time since there's no ASP.NET host — see `scripts/build-index.mjs`).
- **TypeScript**, compiled/bundled by Vite (esbuild) with no type-checking gate — the real
  site presumably type-checks in its own build, this checkout does not enforce it.
- **SCSS** (`Content/styles.scss`), all scoped under `#portalmon`.
- jQuery is used for exactly one thing: the `$(() => {...})` DOMContentLoaded wrapper in
  `PortalmonController.ts`.
- All game/save state lives in `localStorage` (`PortalmonCache`, `PortalKombatGymState`) —
  there is no server-side persistence.

## Game structure

**Entry point:** `Scripts/PortalmonController.ts` — one class (`PortalmonController`) holds
essentially all UI state as Knockout observables, plus a `PortalmonCache` class that
serializes to `localStorage`. `ko.applyBindings` targets `#portalmon` in
`Views/Home/Index.cshtml`, which renders a fake Game Boy shell (`.gba-shell`) with a screen
that swaps between onboarding, idle/portal, battle, and overlay states.

**Boot sequence:** power-off screen (click) → logo splash (~5s, plays `on.wav`) → first-time
players see the GLaDOS welcome screen → starter select (3 starters: normling / cpfnib /
ressie) → starter confirm → idle screen. Returning players skip straight to idle with
background music.

**Idle screen:** two "portals" (blue/orange) each showing a random encounterable species;
clicking one plays a vortex/iris battle transition (`BattleTransition.ts`) into a wild
encounter. A battery meter (`batteryPercent`) caps encounters (10 per full charge, drains
only 9am–5pm, recharges over time) — GLaDOS taunts you with a random message when it hits 0.

**Combat** (`_CombatManager.ts`): turn-based, speed-order-resolved, one active creature per
side (up to 3-creature party, swappable mid-battle at the cost of a turn). Moves have type
effectiveness (`data/TypeList.ts`, 4 types: Performance / Security / Availability /
Manageable, some creatures dual-typed), status effects (Contaminated, SelfHealing, Throttled,
Optimized, LockOn, Disrupted, Cascading), and a per-creature charge meter that unlocks a
species-specific **Ultimate** move (`data/UltimateList.ts`, `UltAnimator.ts` for the flashy
screen-effect animations) with a charge "archetype" (Brawler/Endurance/Tactician/Momentum/
Chaos) governing how it fills. Two pieces of this split out of `_CombatManager.ts` into
`Scripts/combat/`: `ChargeSystem.ts` (all charge-meter bookkeeping) and
`UltimateExecutor.ts` (resolves one ultimate activation — hit loop, specials, synergy).
Both are plain injected-callback modules, not full managers — `_CombatManager.ts` still owns
turn orchestration, damage calc, and status-effect processing.

**Catching:** wild (non-gym, non-sim) encounters can be contained instead of defeated —
catch chance is inverse to the enemy's remaining HP%. `CatchAnimator.ts` drives the
throw/wiggle/absorb sequence.

**Evolution:** no levels — instead, each party member accumulates a battle count (wins or
catches while it was in the active party); at 3 battles its evolved form (if any) gets queued
into `pendingEvolutions` and is guaranteed to appear as one of the two portal options next.
Evolved forms otherwise never appear in the wild until caught once.

**Gym battles** (`_GymBattleManager.ts` + `Views/Home/Battles.cshtml`): 4 fixed trainer
fights against pre-set parties (not random) — 3 gym leaders (Coach/Availability, Lordis/
Security, Gargis/Performance-Security) unlockable any time, then a Championship (Rey) once
all 3 are beaten, then a hidden Secret battle (GLaDOS herself) once the Championship is beaten.
Beating the Championship shows a victory screen; beating GLaDOS triggers a full credits
sequence and unlocks the Battle Simulator (`_SimManager.ts` + `Views/Home/Sim.cshtml`, also
reachable early via a `?sim` query param for dev testing).

**Dex** (`_DexManager.ts` + `Views/Home/Dex.cshtml`): tracks seen vs. caught per species,
party management (drag-free toggle, max 3), and a detail panel with front/rear sprite toggle,
type/evolution info, and move/ultimate tooltips.

**Hard mode:** using Rest (full-party heal, gated behind a one-time confirmation warning
because it's irreversible-feeling) permanently forfeits eligibility for a "hard mode victory"
badge on the championship win screen.

**Cosmetic:** 5 selectable Game Boy shell skins (purple/aqua/pikachu/mooroo/isaac), persisted
to cache, switched via a little slider control on the shell's bottom edge.

**Generation 2 overworld prototype:** the idle screen now defaults to a canvas-rendered,
tile-snapped town with a scrolling camera, an Atlas player sprite, an interactive NPC,
typewriter dialogue, and separate data-driven modules for outdoor/interior maps. The center
building is enterable through a warp tile and has its own layout/collision/exit. Map-specific
coordinates belong under `Scripts/overworld/`, never in `OverworldManager.ts`. See
`Scripts/overworld/README.md` for the complete map, obstacle, door, NPC, asset, input-readiness,
and verification guide.

The outdoor town is a precomposed 56×40-tile PNG, not a runtime tilemap. Edit
`Scripts/overworld/town-layout.json`, then run `npm run map:build`; that regenerates both
`Content/Images/Overworld/enrichment-town.png` and `TownLayout.generated.ts`. Stable gym slots
keep the three physical gym buildings independent from whichever leaders occupy them later.

**Easter egg:** a hidden keyboard sequence (hashed/obfuscated in `PortalmonController.ts`,
bottom of the file) instantly unlocks the full dex — dev/demo shortcut, not a documented
feature.

## Key files

- `Scripts/PortalmonController.ts` — root view model, onboarding flow, battery, portal
  rolling, evolution checks, cache shape
- `Scripts/_CombatManager.ts` — battle engine: turn orchestration, damage calc, status-effect
  processing, gym-party sequencing. Charge bookkeeping and ultimate resolution live in
  `Scripts/combat/` (see above) and are injected in, not inherited.
- `Scripts/combat/ChargeSystem.ts`, `Scripts/combat/UltimateExecutor.ts` — charge-meter
  mechanics and ultimate-activation resolution, split out of `_CombatManager.ts`
- `Scripts/_DexManager.ts`, `_GymBattleManager.ts`, `_SimManager.ts` — the three overlay
  view models
- `Scripts/data/*.ts` — all static game data (creatures, moves, types, trainers, ultimates);
  editing balance/content happens here, not in the managers
- `Scripts/OverworldManager.ts`, `Scripts/OverworldDialogue.ts` — generic Generation 2
  movement/camera/rendering/map-transition runtime and reusable speech state
- `Scripts/overworld/OverworldMapTypes.ts`, `WorldMapRegistry.ts`, `TownMap.ts`,
  `CenterBuildingMap.ts` — shared map schema/registry and one isolated module per space
- `Scripts/overworld/README.md` — required authoring and handoff guide for maps, terrain atlas
  indices, obstacles/collision, doors, NPCs, player-frame bounds, rapid-input safety, and tests
- `Views/Home/Overworld.cshtml`, `Content/_overworld.scss` — overworld HUD/dialogue markup
  and presentation
- `Scripts/models/PortalKombatCreature.ts` — runtime (per-battle) creature instance wrapper
- `Content/styles.scss` — aggregator that `@import`s the partials in `Content/_*.scss` (shell
  chrome, combat panel, dex tab, victory screen, etc.) in source order. Split for
  navigability only — compiles to byte-identical CSS, and the real site still `@import`s this
  file the same way it always did (see the note at the top of `_variables.scss`).
- `Views/Home/*.cshtml` — one partial per screen/overlay, Knockout-bound markup only (no
  server logic beyond the `@Html.Partial` includes)
