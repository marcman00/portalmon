import { OverworldMapDef } from "./OverworldMapTypes";
import gymTilesetImagePath from "../../Content/Images/Overworld/Tilesets/indoortileset.png";
import pokemonTilesetImagePath from "../../Content/Images/Overworld/Tilesets/Tileset.png";
import npcTilesetImagePath from "../../Content/Images/Overworld/Tilesets/npcs-compact-16.png";
import portalTilesetImagePath from "../../Content/Images/Overworld/Tilesets/portal-tiles.png";
import { resolveMapActables } from "./MapActables";
import {
	GYM1_ACTABLES,
	GYM1_COLLISION_RECTS,
	GYM1_HEIGHT,
	GYM1_ICE_TILES,
	GYM1_PORTALS,
	GYM1_SPAWNS,
	GYM1_TILE_LAYERS,
	GYM1_TILESETS,
	GYM1_WARPS,
	GYM1_WILD_ZONES,
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
	statusText: "Ice Gym - keep moving on ice",
	tilesets: GYM1_TILESETS.map(tileset => ({
		...tileset,
		imagePath: tileset.imagePath === "/indoortileset.png"
			? gymTilesetImagePath
			: tileset.imagePath === "/Tileset.png"
				? pokemonTilesetImagePath
				: tileset.imagePath === "/npcs-compact-16.png"
					? npcTilesetImagePath
					: portalTilesetImagePath,
	})),
	tileLayers: GYM1_TILE_LAYERS,
	collisionRects: GYM1_COLLISION_RECTS,
	collisionPoints: [],
	encounterZones: GYM1_WILD_ZONES,
	iceTiles: GYM1_ICE_TILES,
	portals: GYM1_PORTALS,
	spawns: GYM1_SPAWNS,
	warps: GYM1_WARPS,
	interactions: [],
	npcs: resolveMapActables(GYM1_ACTABLES, GYM1_COLLISION_RECTS),
};
