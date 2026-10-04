# Overworld authoring guide

## Active maps

`WorldMapRegistry.ts` registers the active maps: the town, three gyms, and the
lab. Map-specific data belongs in Tiled sources or the corresponding map module;
`../OverworldManager.ts` implements shared movement, rendering, interactions,
and transitions.

- `Maps/Source/Overworld.tmx` owns town collision, doors, warps, encounters,
  spawns, portals, and actables. The runtime uses the precomposed
  `Content/Images/Overworld/Overworld.png` for town terrain.
- `Maps/Source/Gym1.tmx`, `Gym2.tmx`, `Gym3.tmx`, and `Lab.tmx` own both terrain
  layers and map metadata. The runtime renders their Tiled layers.
- `TownMap.ts`, `Gym*Map.ts`, and `LabMap.ts` connect generated Tiled data to
  runtime map definitions. `*generated.ts` files are exporter output; do not
  edit them by hand.

From the repository root, regenerate after source changes:

```powershell
npm run map:tiled    # after editing Overworld.tmx
npm run map:gym      # after editing a gym or Lab.tmx
npm run build
```

The town terrain image is precomposed, so changing visual tiles in
`Overworld.tmx` does not redraw `Overworld.png`. That TMX is the active source
for town gameplay metadata and collision.

## Tiled conventions

- Coordinates use 16x16 pixel tiles, starting at `(0,0)` in the top-left.
- Town collision comes from visible tiles on layers marked `walkable = false`;
  transparent placeholder tiles are ignored.
- Gym and lab collision, ice, and rendered terrain come from tile layers marked
  with `walkable = false` or `ice = true` as appropriate.
- `Actables` objects create dialogue actors. Use `name` plus `message` for
  ordinary dialogue, `name` plus `scriptId` for scripted interactions, or
  `trainerId` for a trainer. Names need not be unique; each actor is keyed by
  its Tiled object ID.
- Trainer definitions in `Scripts/data/TrainerList.ts` own their party,
  portraits, battle dialogue, map introduction, and post-battle line. Tiled
  owns the trainer's position and facing. Trainer IDs may appear only once in
  the world.
- `Spawns` objects define safe arrival tiles. A map transition warp uses
  non-empty `map` and `spawn` properties, and the target spawn ID must exist.
- Town `Warp` objects with an integer `door` property are legacy door markers.
  Door 5 is the Enrichment Center interaction and faint-recovery location; keep
  its ID unless `RecoveryDestination.ts` is updated too.
- Rectangles in the `Wild` layer define encounter zones. Gym and lab `Warp`
  rectangles expand to one trigger per covered tile.
- Paired `Portals` objects use the same integer `portal` property. The optional
  layer property `directionalExit = true` makes the player leave one tile past
  the linked portal in the direction of travel. Portal colors are set on the
  `Portal Visuals` tile layer and do not affect gameplay linkage.

The exporters reject invalid alignment, pairs, blocked exits, and missing map
destinations. Gym and lab exports also check ice routes reachable from a
configured spawn for loops.

## Adding a map

1. Add its ID to `OverworldMapId` in `OverworldMapTypes.ts`.
2. Add the Tiled source and export it with the appropriate map command.
3. Create a map module that imports the generated data and resolves its tileset
   images.
4. Register the map in `WorldMapRegistry.ts` and author its entrance and return
   warps with safe spawn points.

The registry checks that spawns and warps are not blocked and that every warp
points to an existing destination spawn.

## Movement and presentation

The logical viewport is 240x160 pixels with 16x16 tiles. The camera follows
the player on maps larger than the 15x10 tile viewport and clamps at map edges.
Movement waits until the active map has rendered a complete actor-ready frame,
including after a transition.

The player sheet has measured frame bounds in `PLAYER_FRAME_RECTS` in
`../OverworldManager.ts`. A replacement sheet must preserve those frame
locations or update the bounds. NPCs may have a `spritePath`; omit it when the
actor is already drawn into the town background. The gym and lab exporters
anchor large actables at their bottom-center interaction tile.

Controls: move with the D-pad, arrow keys, or WASD; interact with `E` or Enter.
The red handheld button opens trainer records and does not start dialogue.

## Checks

For active map changes, run the appropriate map exporter and `npm run build`.
Use `npm run dev` to check movement, warps, collision, dialogue, encounters,
healing at Door 5, and faint recovery in the browser.

The separate `town:experiment:build` and `town:experiment:test` commands apply
only to the retained `town-layout.json` experiment. That experiment does not
provide the active town map or validate the active Tiled maps.
