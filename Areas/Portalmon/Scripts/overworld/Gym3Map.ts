import { OverworldMapDef } from "./OverworldMapTypes";
import gymTilesetImagePath from "../../../../indoortileset.png";
import pokemonTilesetImagePath from "../../../../Tileset.png";
import npcTilesetImagePath from "../../../../npcs-compact-16.png";
import portalTilesetImagePath from "../../../../portal-tiles.png";
import { resolveMapActables } from "./MapActables";
import {
	GYM3_ACTABLES,
	GYM3_COLLISION_RECTS,
	GYM3_HEIGHT,
	GYM3_ICE_TILES,
	GYM3_PORTALS,
	GYM3_SPAWNS,
	GYM3_TILE_LAYERS,
	GYM3_TILESETS,
	GYM3_WARPS,
	GYM3_WILD_ZONES,
	GYM3_WIDTH,
} from "./Gym3.generated";

export const GYM3_MAP: OverworldMapDef = {
	id: "gym3",
	name: "Trivia Gym",
	width: GYM3_WIDTH,
	height: GYM3_HEIGHT,
	backgroundColor: "#241630",
	defaultSpawn: { x: 17, y: 38 },
	defaultFacing: "down",
	statusText: "Trivia Gym Â· choose wisely",
	tilesets: GYM3_TILESETS.map(tileset => ({
		...tileset,
		imagePath: tileset.imagePath === "/indoortileset.png"
			? gymTilesetImagePath
			: tileset.imagePath === "/Tileset.png"
				? pokemonTilesetImagePath
				: tileset.imagePath === "/npcs-compact-16.png"
					? npcTilesetImagePath
					: portalTilesetImagePath,
	})),
	tileLayers: GYM3_TILE_LAYERS,
	objects: [],
	collisionRects: GYM3_COLLISION_RECTS,
	collisionPoints: [],
	encounterZones: GYM3_WILD_ZONES,
	iceTiles: GYM3_ICE_TILES,
	portals: GYM3_PORTALS,
	spawns: GYM3_SPAWNS,
	warps: GYM3_WARPS,
	interactions: [],
	npcs: resolveMapActables(GYM3_ACTABLES, GYM3_COLLISION_RECTS),
};
