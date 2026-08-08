import { OverworldMapDef, OverworldMapId } from "./OverworldMapTypes";
import { GYM1_MAP } from "./Gym1Map";
import { GYM2_MAP } from "./Gym2Map";
import { GYM3_MAP } from "./Gym3Map";
import { LAB_MAP } from "./LabMap";
import { validateWorldTrainerPlacements } from "./MapActables";
import { TOWN_MAP } from "./TownMap";

export const WORLD_MAPS: Record<OverworldMapId, OverworldMapDef> = {
	town: TOWN_MAP,
	gym1: GYM1_MAP,
	gym2: GYM2_MAP,
	gym3: GYM3_MAP,
	lab: LAB_MAP,
};

validateWorldTrainerPlacements(Object.values(WORLD_MAPS));

validateWorldMaps(WORLD_MAPS);

function validateWorldMaps(maps: Record<OverworldMapId, OverworldMapDef>): void
{
	for (const map of Object.values(maps))
	{
		for (const spawn of map.spawns)
		{
			if (isBlocked(map, spawn.position))
				throw new Error(`Spawn '${spawn.id}' is blocked in map '${map.id}'.`);
		}
		for (const warp of map.warps)
		{
			if (isBlocked(map, warp.position))
				throw new Error(`Warp in map '${map.id}' is blocked at ${warp.position.x},${warp.position.y}.`);
			const targetMap = maps[warp.targetMapId];
			if (!targetMap?.spawns.some(spawn => spawn.id === warp.targetSpawnId))
				throw new Error(`Warp in map '${map.id}' references missing spawn '${warp.targetSpawnId}' in '${warp.targetMapId}'.`);
		}
	}
}

function isBlocked(map: OverworldMapDef, point: { x: number; y: number }): boolean
{
	return map.collisionPoints.some(collision => collision.x === point.x && collision.y === point.y)
		|| map.collisionRects.some(rectangle =>
			point.x >= rectangle.x
			&& point.x < rectangle.x + rectangle.width
			&& point.y >= rectangle.y
			&& point.y < rectangle.y + rectangle.height,
		);
}
