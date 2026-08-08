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
    npm run map:test
    npm run build

Map commands:

- map:gym exports Gym1.tmx, Gym2.tmx, Gym3.tmx, and Lab.tmx to Scripts/overworld/*.generated.ts.
- map:lab exports only Lab.tmx.
- map:tiled exports overworld collision, warp, spawn, portal, encounter, and actable metadata.
- map:test runs the static-town invariant tests.
- map:build rebuilds the alternative town-layout-generated image/data. The active town currently renders Content/Images/Overworld/Overworld.png, so this command does not replace the active town unless TownMap.ts is changed deliberately.

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

## Combat and progression

Combat uses one active creature per side and parties of up to three. Turn order is speed-based. Types are Performance, Security, Availability, and Manageable. Statuses and species-specific ultimates are data-driven.

Catching is available in eligible wild encounters, with chance based primarily on remaining enemy HP. CatchAnimator drives the throw/wiggle result sequence.

Evolution is battle-count based rather than level based. When a party member reaches its threshold, its evolution is queued into a future encounter. Evolved forms remain excluded from normal wild selection until caught.

Rest fully heals the party and permanently forfeits hard-mode victory eligibility after confirmation.

The Dex tracks seen/caught state, party membership, creature details, moves, evolution, and ultimate information. The Battle Simulator is a separate overlay and can also be exposed for local testing through the existing query-parameter path.

## Content replacement

Use CONTENT-REPLACEMENT-QUICK-REFERENCE.md for roster, trainer, dialogue, art, and starter replacement work. Map filenames mentioned there are relative to Maps/Source.

IDs are wiring. Display names and dialogue are content. Avoid renaming species IDs, trainer IDs, move IDs, ultimate IDs, TMX script IDs, map IDs, spawn IDs, or cross-map warp targets unless every reference is updated together.

## Known constraints

- Audio and much creature artwork are intentionally absent.
- OverworldManager still contains a legacy prototype-tiles fallback path, but all registered maps use either a background image or Tiled tilesets.
- Sass emits deprecation warnings for legacy imports and color helpers; the production build currently succeeds.
- The production bundle reports a chunk-size warning; it is informational.
- dist-static is generated output and may change hash names after asset/import changes.