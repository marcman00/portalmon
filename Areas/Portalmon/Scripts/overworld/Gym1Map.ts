import { OverworldMapDef } from "./OverworldMapTypes";
import gymTilesetImagePath from "../../../../indoortileset.png";
import {
	GYM1_COLLISION_RECTS,
	GYM1_HEIGHT,
	GYM1_ICE_TILES,
	GYM1_PORTALS,
	GYM1_SPAWNS,
	GYM1_TILE_LAYERS,
	GYM1_TILESET,
	GYM1_WARPS,
	GYM1_WIDTH,
} from "./Gym1.generated";

export const GYM1_MAP: OverworldMapDef = {
	id: "gym1",
	name: "Ice Gym",
	width: GYM1_WIDTH,
	height: GYM1_HEIGHT,
	backgroundColor: "#051526",
	defaultSpawn: { x: 8, y: 38 },
	defaultFacing: "up",
	statusText: "Ice Gym · keep moving on ice",
	tileset: { ...GYM1_TILESET, imagePath: gymTilesetImagePath },
	tileLayers: GYM1_TILE_LAYERS,
	objects: [],
	collisionRects: GYM1_COLLISION_RECTS,
	collisionPoints: [],
	encounterZones: [],
	iceTiles: GYM1_ICE_TILES,
	portals: GYM1_PORTALS,
	spawns: GYM1_SPAWNS,
	warps: GYM1_WARPS,
	interactions: [],
	npcs: [],
};
