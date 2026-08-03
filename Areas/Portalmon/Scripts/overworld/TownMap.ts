import { MapNpcDef, OverworldMapDef } from "./OverworldMapTypes";
import { TILED_ACTABLES, TILED_COLLISION_RECTS, TILED_DOORS, TILED_SPAWNS, TILED_WARPS, TILED_WILD_ZONES } from "./TiledOverworld.generated";

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
	portals: [],
	spawns: TILED_SPAWNS,
	warps: TILED_WARPS,
	interactions: [
		{ position: TILED_DOORS[5], kind: "center" },
	],
	// People and signs are painted into the Tiled Obstacle layer, so they are
	// already part of Overworld.png; the runtime only supplies their dialogue.
	npcs: TILED_ACTABLES.map((actable): MapNpcDef => ({
		id: `actable-${actable.id}`,
		name: actable.name,
		position: actable.position,
		initialFacing: "down",
		dialogue: { speaker: actable.name, lines: [actable.message] },
	})),
};
