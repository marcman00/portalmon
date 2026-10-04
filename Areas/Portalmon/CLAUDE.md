# Portalmon

Portalmon is a Portal/Epic-themed creature battler implemented as an ASP.NET MVC Area. The game uses Knockout, TypeScript, SCSS, canvas-rendered maps, and localStorage persistence.

The Area is the source of truth for game code and game-owned data. Files at the repository root support the standalone Vite development harness or repository tooling; Portalmon runtime modules must not import game assets from the root.

## Repository boundary

Everything needed by the production Area belongs under Areas/Portalmon:

- Controllers and Area registration: Controllers/, PortalmonAreaRegistration.cs
- Razor views: Views/
- TypeScript runtime and static game definitions: Scripts/
- SCSS and runtime media: Content/
- Editable Tiled maps and tileset descriptors: Maps/Source/
- Retained, inactive map experiments: Maps/Source/Legacy/

The local Vite harness lives outside the Area:

- src/ supplies site globals and imports the real Area entry point.
- scripts/build-index.mjs converts the Razor partials into local index.html.
- package.json, vite.config.js, index.html, and dist-static/ exist for local development.
- scripts/ contains map exporters and tests. Their game inputs and outputs are inside the Area.

Creature front/back artwork and audio are intentionally incomplete in this checkout. Missing audio is tolerated by SoundManager. Do not treat those known content gaps as a map or build failure.

## Run and verify

From the repository root:

    npm install
    npm run dev

The predev and prebuild hooks regenerate index.html from Views/Home. Do not hand-edit index.html.

Use these checks after changing game code, maps, or assets:

    npm run map:gym
    npm run map:tiled
    npm run build

Map commands:

- map:gym exports Gym1.tmx, Gym2.tmx, Gym3.tmx, and Lab.tmx to Scripts/overworld/*.generated.ts.
- map:lab exports only Lab.tmx.
- map:tiled exports overworld collision, warp, spawn, portal, encounter, and actable metadata.
- town:experiment:test checks the retained, inactive town-layout experiment; it does not test active Tiled maps.
- town:experiment:build rebuilds that experiment's image/data. The active town currently renders Content/Images/Overworld/Overworld.png.

Use the `town:experiment:*` commands only when editing the retained `town-layout.json` experiment.

Generated TypeScript is committed. Always regenerate it after changing its TMX source.

## Stack and host assumptions

- Knockout owns the UI. PortalmonController is the root view model, and Razor partials use data-bind and Knockout comment bindings.
- TypeScript is bundled by the host build. The standalone harness uses Vite/esbuild and does not provide a separate type-checking gate.
- SCSS begins at Content/styles.scss and is scoped under #portalmon.
- The production host supplies jQuery, Knockout, Bootstrap, the compiled dist partial, the icon loader, and shared binding handlers.
- Save state is client-only localStorage through PortalmonCache and PortalKombatGymState.

## Current player flow

1. The player powers on the handheld and sees the logo splash.
2. A new save wakes in the lab.
3. Three lab portals offer normling, cpfnib, or ressie. The lab exit remains locked until one is selected.
4. The player enters the town, explores wild zones, catches creatures, and enters three physical gyms.
5. The gym leaders are Lordis in Gym 1, Gargis in Gym 2, and Coach in Gym 3.
6. Defeating all gym leaders enables the GLaDOS championship evaluation in the lab.
7. Defeating GLaDOS reveals the Rey secret battle and the postgame flow.

The old Welcome, StarterSelect, and StarterConfirm Razor screens no longer exist. Starter selection is an in-world lab interaction handled by PortalmonController and Lab.tmx.

## Runtime architecture

Scripts/PortalmonController.ts is the root coordinator. It owns screen state, power-on/lab wake flow, encounter transitions, save/cache state, evolution scheduling, battery behavior, and connections between the managers.

Major managers:

- OverworldManager.ts: canvas rendering, movement, camera, collision, portals, warps, wild zones, actables, map transitions, and input gating.
- OverworldDialogue.ts: reusable dialogue, choices, and typewriter state.
- _CombatManager.ts: turn orchestration, damage, statuses, swapping, catches, and battle results.
- combat/ChargeSystem.ts: ultimate charge bookkeeping.
- combat/UltimateExecutor.ts: ultimate execution and special effects.
- _GymBattleManager.ts: map trainer fights, championship/secret progression, badges, and victory hooks.
- _DexManager.ts: seen/caught state, party selection, details, and tooltips.
- _SimManager.ts: simulator selection and battle launch.
- SoundManager.ts, BattleTransition.ts, CatchAnimator.ts, and UltAnimator.ts: presentation subsystems.

Static definitions live in Scripts/data:

- CreatureList.ts
- MoveList.ts
- TrainerList.ts
- TypeList.ts
- UltimateList.ts

Runtime creature instances are represented by Scripts/models/PortalKombatCreature.ts.

## Map architecture

The registered world contains five maps:

- town: precomposed Overworld.png plus metadata generated from Overworld.tmx
- gym1: Ice Gym, rendered from generated Tiled layers
- gym2: Sand Gym, rendered from generated Tiled layers
- gym3: Trivia Gym, rendered from generated Tiled layers
- lab: Aperture Simulation Lab, rendered from generated Tiled layers

WorldMapRegistry.ts registers and validates every map. It rejects blocked spawns and warps that target a missing map spawn. MapActables.ts resolves authored signs, scripted actors, and trainers and validates trainer placement.

Active editable sources:

- Maps/Source/Overworld.tmx
- Maps/Source/Gym1.tmx
- Maps/Source/Gym2.tmx
- Maps/Source/Gym3.tmx
- Maps/Source/Lab.tmx
- Maps/Source/*.tsx

Runtime tilesets:

- Content/Images/Overworld/Tilesets/Tileset.png
- Content/Images/Overworld/Tilesets/indoortileset.png
- Content/Images/Overworld/Tilesets/portal-tiles.png
- Content/Images/Overworld/Tilesets/npcs-compact-16.png
- Content/Images/Overworld/Tilesets/glados-sprite.png

The TSX files refer to those Area-owned runtime images. Runtime map wrappers also import them from inside the Area so the standalone bundle includes them. Do not restore imports such as ../../../../Tileset.png.

Generated files:

- TiledOverworld.generated.ts
- Gym1.generated.ts
- Gym2.generated.ts
- Gym3.generated.ts
- Lab.generated.ts

Map-specific coordinates and behavior belong in TMX data or Scripts/overworld modules, not in OverworldManager.ts. See Scripts/overworld/README.md for object-layer conventions and portal/collision rules.

Large visual actables are anchored at their bottom-center interaction tile by build-tiled-gym.py. One-tile actables retain their authored tile. GLaDOS in Lab.tmx relies on this behavior.

## Frame profiling

Scripts/PerfProbe.ts is an opt-in profiler for the overworld render loop. It is
inert unless enabled, and nothing else may depend on it.

    ?perf=1      collect samples, report on demand
    ?perf=hud    collect samples and show the on-screen overlay
    ?perf=debug  overlay plus the canvas dataset mirror
    localStorage.setItem("portalmon:perf", "1")   persists across navigations

The canvas dataset mirror stays off in the first two modes. It writes four
attributes per frame during movement, which every MutationObserver on the host
page then runs against, so leaving it on while profiling would provoke the effect
being measured.

Read results with `portalmonPerf.report()` in the console; `portalmonPerf.reset()`
clears the sample window and `portalmonPerf.copy()` returns the JSON.

It exists because the game runs in two very different hosts: the standalone Vite
harness, whose page contains almost nothing else, and the production site, where
it shares a document with a full application. The same game code can feel very
different in the two, so the report separates the causes:

- `drawMs` high on one host only means environment-sensitive rasterization.
  Compare `canvasUpscale`, `devicePixelRatio`, and `canvasPaintedSize`, which the
  host page's surrounding CSS decides.
- `drawMs` equal but `postFrameMs` high means the browser's own per-frame work on
  the surrounding page is spending the frame budget. That is style recalculation,
  layout, and paint for the whole document, none of which is charged to `drawMs`.
  `postFrameMs` is a MessageChannel round trip, so it only sees the main thread.
  Raster, compositing, the GPU process, and present all happen after it resolves
  and are invisible to it.
- `drawMs` and `postFrameMs` both low while `frameIntervalMs` stays bad means the
  main thread is idle and the bottleneck is downstream of it. That is raster or
  GPU cost, or the renderer not being scheduled at all because another process on
  the machine is competing. Neither is measurable from inside the page: use a
  DevTools Performance trace, which has the raster and GPU tracks, and check
  `chrome://gpu` for software compositing. `longTasks.containers` only names
  main-thread offenders and will be quiet in this case.
- `frameIntervalMs.min` is the display's refresh ceiling. A `p50` at twice the
  `min` is a half-rate vsync lock, not jank, and a tight spread between `p50` and
  `p95` confirms it: real jank is a wide distribution.

The environment block also decides whether a comparison is even valid.
`hardwareConcurrency`, `deviceMemory`, and `devicePixelRatio` differing means the
two reports came from two machines, and no conclusion about the two hosts can be
drawn until the same machine runs both.

Never profile over Remote Desktop. An RDP session has no hardware compositing and
presents on a fixed cadence, so the capture describes the remoting channel and
not the page. Its fingerprint is unmistakable: `frameIntervalMs.min`, `p50`, and
`p95` within about a millisecond of each other around 31 ms, `drawMs` and
`postFrameMs` together using a couple of percent of that budget, `reducedMotion`
true, and a `devicePixelRatio` that does not match the physical display. Nothing
in the page moves those numbers, including the CSS. Capture at the console.
- Both healthy but movement still feels bad means input latency or the idle path.
  Check `inputLatencyMs`, `droppedInputs`, and `idleFrameRatio`. `droppedInputs`
  counts presses the movement gate refused outright, which produce no frame at
  all and therefore never show up in the timing numbers.

`idleFrameRatio` is the fraction of loop iterations that fell back to the slow
poll instead of re-arming on requestAnimationFrame. It should be 0 while the
overworld is on screen. Anything higher means `isOverworldScreenActive` is
returning false, or the canvas is not resolving, and movement is running on a
200 ms timer rather than at display rate.

Run it on both hosts and compare the two reports rather than reasoning about the
shell CSS, which is shared and therefore cannot by itself explain a difference.

## Combat and progression

Combat uses one active creature per side and parties of up to three. Turn order is speed-based. Types are Performance, Security, Availability, and Manageable. Statuses and species-specific ultimates are data-driven.

Catching is available in eligible wild encounters, with chance based primarily on remaining enemy HP. CatchAnimator drives the throw/wiggle result sequence.

Evolution is battle-count based rather than level based. When a party member reaches its threshold, its evolution is queued into a future encounter. Evolved forms remain excluded from normal wild selection until caught.

Winning a wild battle heals nothing; damage persists between encounters. The only free heal is containment: successfully catching a species that is already in the party fully restores that member. Clearing a gym fully restores the party as a progression checkpoint. Rest fully heals the party and permanently forfeits hard-mode victory eligibility after confirmation, and the Enrichment Center door and faint recovery both restore to full.

The Dex tracks seen/caught state, party membership, creature details, moves, evolution, and ultimate information. The Battle Simulator is a separate overlay and can also be exposed for local testing through the existing query-parameter path.

## Content replacement

Use CONTENT-REPLACEMENT-QUICK-REFERENCE.md for roster, trainer, dialogue, art, and starter replacement work. Map filenames mentioned there are relative to Maps/Source.

IDs are wiring. Display names and dialogue are content. Avoid renaming species IDs, trainer IDs, move IDs, ultimate IDs, TMX script IDs, map IDs, spawn IDs, or cross-map warp targets unless every reference is updated together.

## Known constraints

- Audio and much creature artwork are intentionally absent.
- Every registered map must supply either `backgroundImagePath` or `tileLayers` plus `tilesets`. There is no other terrain path.
- Sass emits deprecation warnings for legacy imports and color helpers; the production build currently succeeds.
- The production bundle reports a chunk-size warning; it is informational.
- dist-static is generated output and may change hash names after asset/import changes.
