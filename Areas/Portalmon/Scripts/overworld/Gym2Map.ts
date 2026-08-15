import { OverworldMapDef } from "./OverworldMapTypes";
import gymTilesetImagePath from "../../Content/Images/Overworld/Tilesets/indoortileset.png";
import pokemonTilesetImagePath from "../../Content/Images/Overworld/Tilesets/Tileset.png";
import npcTilesetImagePath from "../../Content/Images/Overworld/Tilesets/npcs-compact-16.png";
import portalTilesetImagePath from "../../Content/Images/Overworld/Tilesets/portal-tiles.png";
import { resolveMapActables } from "./MapActables";
import {
	GYM2_ACTABLES,
	GYM2_COLLISION_RECTS,
	GYM2_HEIGHT,
	GYM2_ICE_TILES,
	GYM2_PORTALS,
	GYM2_SPAWNS,
	GYM2_TILE_LAYERS,
	GYM2_TILESETS,
	GYM2_WARPS,
	GYM2_WILD_ZONES,
	GYM2_WIDTH,
} from "./Gym2.generated";

export const GYM2_MAP: OverworldMapDef = {
	id: "gym2",
	name: "Sand Gym",
	width: GYM2_WIDTH,
	height: GYM2_HEIGHT,
	backgroundColor: "#33230c",
	defaultSpawn: { x: 6, y: 38 },
	defaultFacing: "down",
	statusText: "Sand Gym - stay on the path",
	tilesets: GYM2_TILESETS.map(tileset => ({
		...tileset,
		imagePath: tileset.imagePath === "/indoortileset.png"
			? gymTilesetImagePath
			: tileset.imagePath === "/Tileset.png"
				? pokemonTilesetImagePath
				: tileset.imagePath === "/npcs-compact-16.png"
					? npcTilesetImagePath
					: portalTilesetImagePath,
	})),
	tileLayers: GYM2_TILE_LAYERS,
	collisionRects: GYM2_COLLISION_RECTS,
	collisionPoints: [],
	encounterZones: GYM2_WILD_ZONES,
	iceTiles: GYM2_ICE_TILES,
	portals: GYM2_PORTALS,
	spawns: GYM2_SPAWNS,
	warps: GYM2_WARPS,
	interactions: [],
	npcs: resolveMapActables(GYM2_ACTABLES, GYM2_COLLISION_RECTS),
};
