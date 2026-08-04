# Generation 2 Overworld Authoring Guide

The overworld is data-driven. Each space lives in its own map file, while
`OverworldManager.ts` owns generic movement, camera, rendering, interaction,
and transitions. Layout coordinates must stay out of the manager so one
building can be edited without affecting another.

## Ownership and important files

- `OverworldMapTypes.ts` — shared map, object, collision, NPC, and warp shapes.
- `TownMap.ts` — outdoor town layout only.
- `CenterBuildingMap.ts` — center-building interior only.
- `WorldMapRegistry.ts` — registers map IDs and definitions.
- `../OverworldManager.ts` — generic movement, input, camera, drawing, actors,
  collision lookup, and map transitions.
- `../OverworldDialogue.ts` — reusable typewriter dialogue state.
- `../../Views/Home/Overworld.cshtml` — canvas HUD and dialogue markup.
- `../../Content/_overworld.scss` — overworld and dialogue presentation.
- `../../Content/Images/Overworld/` — terrain, player, and NPC images.

## Coordinates, tiles, and camera

- The logical screen is 240×160 pixels.
- One map tile is 16×16 logical pixels.
- Coordinates start at `(0,0)` in the top-left.
- `x` increases rightward and `y` increases downward.
- Player, NPC, collision, and warp positions use tile coordinates.
- Object `width`, `height`, `offsetX`, and `offsetY` use logical pixels.

The camera follows the player automatically when a map exceeds the 15×10-tile
viewport and clamps at map edges. A 15×10 interior stays fixed.

## Editing an existing map

Edit that map's module—for example `CenterBuildingMap.ts`:

```ts
export const CENTER_BUILDING_MAP: OverworldMapDef = {
	id: "center_building",
	name: "Center Building",
	width: 15,
	height: 10,
	backgroundColor: "#c9ced0",
	defaultSpawn: { x: 7, y: 8 },
	defaultFacing: "up",
	statusText: "Center Building · step onto the south door to exit",
	tileAt: (x, y) => 5,
	objects: [],
	collisionRects: [],
	collisionPoints: [],
	warps: [],
	interactions: [],
	npcs: [],
};
```

`tileAt(x, y)` returns an atlas index for every tile. It may use conditionals
for roads/walls or read from a numeric tile array in a future authored map.

## Editing the static town

The outdoor town is deliberately precomposed. The browser loads one finished
`enrichment-town.png`; it does not fetch or stitch `Tileset.png` at runtime.

Town visuals and gameplay geometry share one editable source:

- `town-layout.json` — map size, roads, buildings, ponds, trees, decorations,
  gym slots, spawn, and important points.
- `../../../../scripts/build-town-map.py` — named tileset crops and drawing
  recipes for houses, gyms, the Center, park, and technical district.
- `TownLayout.generated.ts` — generated collision/door data; do not edit it.
- `../../Content/Images/Overworld/enrichment-town.png` — generated runtime PNG.

From the repository root, regenerate and test after editing:

```powershell
python scripts/build-town-map.py
python -m unittest scripts/test_town_map.py
npm.cmd run build
```

Coordinates in `town-layout.json` are 16×16 logical tiles. Buildings with
`kind: "gym"` keep a stable `gymSlot` (`0`, `1`, or `2`), so trainer identities
can be replaced without redrawing or renaming the physical gyms.

### Tiled collision, doors, and actables

`Overworld.tmx` is the authoring source for the current overworld's gameplay
metadata. The runtime still renders the precomposed `Overworld.png`; it does
not render Tiled tiles directly. Do not edit `TiledOverworld.generated.ts` by
hand. After editing objects or obstacle tiles in Tiled, run:

```powershell
npm.cmd run map:tiled
```

This writes `TiledOverworld.generated.ts`. Every visible tile on a layer with
`walkable = false` becomes blocked; transparent placeholder tiles are ignored.
Legacy Warp objects use an integer `door` property. Map-transition Warp
objects use non-empty `map` and `spawn` properties; `spawn` identifies a safe
arrival point in the target map's `Spawns` layer. `Actables` objects require
non-empty `name` and `message` string properties. A rectangle in the `Wild`
object layer with `wild = true` creates a random-encounter zone. All such objects
must be one 16×16 tile aligned to the map grid. Door 5 currently opens the
Enrichment Center healing sequence.

`npm.cmd run build` does **not** run `map:tiled`. Run the exporter before every
build, test, or commit that follows a Tiled edit, otherwise the game will use
stale collision, door, actable, or Wild-zone data.

`Gym1.tmx` is rendered from its Tiled layers at runtime. After changing it,
run `npm.cmd run map:gym`. Both TMX importers read the same five object layers:
`Actables`, `Wild`, `Spawns`, `Portals`, and `Warp` (an empty layer is valid).
Its `Ice` layer uses `ice = true`. Portal appearance
is authored on its `Portal Visuals` tile layer, using `PortalTileset.tsx`:
blue, orange, then purple. Put the desired portal tile at each endpoint.
Objects in the `Portals` layer pair on their integer `portal` property;
layer-level `directionalExit = true` makes a player emerge one tile past the
linked portal in the same travel direction. The exporter rejects invalid pairs,
blocked exits, and ice loops on routes reachable from a configured spawn.
Portal visuals deliberately have no gameplay properties, so changing a portal's
color in Tiled never changes its linkage.

### Actables (talkable people and signs)

Everything the player can talk to is one `Actables` object in its TMX map.
Names are **not** unique — several signs are named `Sign` — so
each actable is keyed by its Tiled object ID, and `TownMap.ts` turns each one
into an `npcs` entry whose dialogue is `{ speaker: name, lines: [message] }`.
Ordinary dialogue stays in TMX; trainer mechanics and dialogue stay in the
trainer registry so they remain editable after map authoring is frozen.

For a map trainer, replace `name` and `message` with a `trainerId` property.
The ID resolves to the complete typed entry in `Scripts/data/TrainerList.ts`,
which owns the party, portraits, battle dialogue, map introduction, and
post-battle line. The map continues to own only the trainer's position and
facing. Trainer Actables must share a blocking tile and each trainer ID may be
placed on only one map.

The person and sign artwork is painted into the Tiled `Obstacle` layer, so it is
already part of `Overworld.png` and also blocks movement. Town actables
therefore carry no `spritePath`, and the renderer draws nothing extra for them.

Door 5 is also the current faint-recovery destination. Do not renumber or
remove it without updating `RecoveryDestination.ts` at the same time.

## Legacy interior terrain atlas

`prototype-tiles.png` is split as a 4×4 atlas:

| Index | Current tile |
|---:|---|
| 0 | Grass |
| 1 | Dark grass |
| 2 | Flower grass |
| 3 | Dirt path |
| 4 | Grass/path edge |
| 5 | Stone floor |
| 6 | Water |
| 7 | Water edge |
| 8 | Tree |
| 9 | Stump |
| 10 | Facility wall |
| 11 | Doorway |
| 12 | Metal roof |
| 13 | Orange-roof building |
| 14 | Facility sign |
| 15 | Boulder |

The Portalmon Center interior still uses this atlas.

To replace the terrain atlas, keep a 4×4 grid or update
`OverworldManager.drawAtlasCell`. If meanings change, update map indices and
this table. Cells 14 and 15 currently receive runtime background removal in
`prepareObjectCutouts`; update that method if those cells stop being the sign
and boulder.

## Objects and collision

Visible objects and collision are deliberately separate. An object does not
block movement until matching collision is added.

```ts
objects: [
	{
		atlasIndex: 15,
		position: { x: 6, y: 4 },
		width: 24,
		height: 24,
		offsetX: -4,
		offsetY: -8,
	},
],
collisionPoints: [
	{ x: 6, y: 4, label: "boulder" },
],
```

For a 24×24 obstacle occupying one tile, `offsetX: -4, offsetY: -8`
bottom-centers it on that tile. Keep grass-backed art off roads unless it has
been converted to a transparent cutout.

Use collision rectangles for walls and buildings:

```ts
collisionRects: [
	{ x: 4, y: 2, width: 6, height: 4, label: "building" },
],
```

Width/height count tiles. This blocks `x=4..9`, `y=2..5`. Leave door tiles out
by splitting the wall rectangle on either side of the door.

## Doors and map transitions

A warp activates after the player finishes stepping onto its tile:

```ts
warps: [
	{
		position: { x: 23, y: 8 },
		targetMapId: "gym1",
		targetSpawnId: "gym1-entrance",
	},
],
```

The warp tile must not be blocked. Put the destination one tile away from its
return warp to avoid an immediate transition loop.

To add another building/space:

1. Add its ID to `OverworldMapId` in `OverworldMapTypes.ts`.
2. Create a map module beside `CenterBuildingMap.ts`.
3. Register it in `WorldMapRegistry.ts`.
4. Add an entrance warp in the source map.
5. Add a return warp in the new map.

No controller or renderer changes should be required.

## NPCs and dialogue

NPC map data includes collision, facing, dialogue, and an optional sprite. Omit
`spritePath` when the actor is already drawn into the map background image, as
every town actable is:

```ts
npcs: [
	{
		id: "technician",
		name: "Technician",
		position: { x: 10, y: 8 },
		initialFacing: "left",
		spritePath: "/Areas/Portalmon/Content/Images/Overworld/lab-tech.png",
		dialogue: {
			speaker: "Technician",
			lines: ["First line.", "Second line."],
		},
	},
],
```

The NPC sheet is a 2×2 grid ordered down, left, right, up. Face an adjacent NPC
and press TALK/Enter/E. Movement locks until dialogue closes.

## Player sheet and animation

The generated Atlas sheet looks like a 4×4 grid but its subjects are not
uniformly centered, and one row overlaps the next. Drawing full cells caused
direction-dependent hovering and a black flake. `PLAYER_FRAME_RECTS` in
`OverworldManager.ts` contains measured opaque bounds, excludes overlap pixels,
and draws every frame from a shared bottom-center foot anchor.

A replacement player sheet must either preserve those exact frame locations or
update `PLAYER_FRAME_RECTS`. Do not restore full-cell drawing.

## Input and render readiness learning

Movement is ignored until the active map has rendered one actor-ready frame.
Map transitions reset readiness and require a new complete frame before input.
Image readiness uses `naturalWidth`, not only `Image.complete`, because a
failed/incomplete image may still report complete.

The animation loop schedules its next frame in `finally` and catches individual
render failures. A transient first-load draw problem therefore cannot
permanently stop the loop after terrain is drawn but before actors.

## Overworld interactions

The overworld is the default idle screen. Wild areas are the only source of
random encounters, and the Enrichment Center door restores the party. A
full-party faint also returns the player to Door 5 after a brief fade.

Controls:

- Move: D-pad, arrow keys, or WASD.
- Interact with NPCs and doors: `E` or Enter.
- Red handheld button: `MENU` (trainer records); it never starts dialogue.

## Verification checklist

After map or asset changes:

```powershell
npm.cmd run map:tiled    # required after a Tiled edit
npm.cmd run map:test
npm.cmd run build
npm.cmd run dev
```

Test:

- immediate movement when the overworld first appears;
- each doorway in both directions, including held/rapid input;
- collision on both sides of door openings;
- camera clamping on maps larger than 15×10;
- player and NPC visibility after every transition;
- dialogue after leaving and returning to a map;
- Door 5 Enrichment Center healing and faint recovery;
- random encounters in a Wild zone, but never outside one;
- obstacle art alignment over its terrain.
