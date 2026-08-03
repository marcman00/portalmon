import { TILED_DOORS } from "./TiledOverworld.generated";
import { MapTeleportDestination } from "./OverworldMapTypes";

/**
 * The current Enrichment Center recovery point. Change only this definition
 * when the Center gets an interior map or a different return tile.
 */
export const FAINT_RECOVERY_DESTINATION: MapTeleportDestination = {
	mapId: "town",
	position: { ...TILED_DOORS[5] },
	facing: "down",
};
