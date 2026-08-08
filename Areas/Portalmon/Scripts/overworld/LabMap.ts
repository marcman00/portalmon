import { OverworldMapDef } from "./OverworldMapTypes";
import indoorTilesetImagePath from "../../Content/Images/Overworld/Tilesets/indoortileset.png";
import portalTilesetImagePath from "../../Content/Images/Overworld/Tilesets/portal-tiles.png";
import gladosTilesetImagePath from "../../Content/Images/Overworld/Tilesets/glados-sprite.png";
import { resolveMapActables } from "./MapActables";
import {
	LAB_ACTABLES,
	LAB_COLLISION_RECTS,
	LAB_HEIGHT,
	LAB_ICE_TILES,
	LAB_PORTALS,
	LAB_SPAWNS,
	LAB_TILE_LAYERS,
	LAB_TILESETS,
	LAB_WARPS,
	LAB_WILD_ZONES,
	LAB_WIDTH,
} from "./Lab.generated";

const LAB_TILESET_IMAGES: Record<string, string> = {
	"/indoortileset.png": indoorTilesetImagePath,
	"/portal-tiles.png": portalTilesetImagePath,
	"/glados-sprite.png": gladosTilesetImagePath,
};

export const LAB_MAP: OverworldMapDef = {
	id: "lab",
	name: "Aperture Simulation Lab",
	width: LAB_WIDTH,
	height: LAB_HEIGHT,
	backgroundColor: "#17163f",
	defaultSpawn: { x: 9, y: 6 },
	defaultFacing: "up",
	statusText: "Simulation Lab",
	tilesets: LAB_TILESETS.map(tileset => ({
		...tileset,
		imagePath: LAB_TILESET_IMAGES[tileset.imagePath] ?? tileset.imagePath,
	})),
	tileLayers: LAB_TILE_LAYERS,
	objects: [],
	collisionRects: LAB_COLLISION_RECTS,
	collisionPoints: [],
	encounterZones: LAB_WILD_ZONES,
	iceTiles: LAB_ICE_TILES,
	portals: LAB_PORTALS,
	spawns: LAB_SPAWNS,
	warps: LAB_WARPS,
	interactions: [],
	npcs: resolveMapActables(LAB_ACTABLES, LAB_COLLISION_RECTS),
};
