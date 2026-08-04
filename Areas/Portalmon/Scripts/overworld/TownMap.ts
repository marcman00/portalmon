import { OverworldMapDef } from "./OverworldMapTypes";
import { resolveMapActables } from "./MapActables";
import { TILED_ACTABLES, TILED_COLLISION_RECTS, TILED_DOORS, TILED_PORTALS, TILED_SPAWNS, TILED_WARPS, TILED_WILD_ZONES } from "./TiledOverworld.generated";

const MAP_WIDTH = 56;
const MAP_HEIGHT = 39;

export const TOWN_MAP: OverworldMapDef = {
	id: "town",
	name: "Overworld",
	width: MAP_WIDTH,
	height: MAP_HEIGHT,
	backgroundColor: "#58bca6",
	backgroundImagePath: "/Areas/Portalmon/Content/Images/Overworld/Overworld.png",
	defaultSpawn: { x: 28, y: 30 },
	defaultFacing: "up",
	statusText: "Overworld",
	objects: [],
	collisionRects: TILED_COLLISION_RECTS,
	collisionPoints: [],
	encounterZones: TILED_WILD_ZONES,
	iceTiles: [],
	portals: TILED_PORTALS,
	spawns: TILED_SPAWNS,
	warps: TILED_WARPS,
	interactions: [
		{ position: TILED_DOORS[5], kind: "center" },
	],
	// People and signs are painted into the Tiled Obstacle layer, so the runtime
	// only supplies their dialogue and trainer behavior.
	npcs: resolveMapActables(TILED_ACTABLES, TILED_COLLISION_RECTS),
};
