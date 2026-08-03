import { OverworldMapDef, OverworldMapId } from "./OverworldMapTypes";
import { TOWN_MAP } from "./TownMap";

export const WORLD_MAPS: Record<OverworldMapId, OverworldMapDef> = {
	town: TOWN_MAP,
};
