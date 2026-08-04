import { TrainerDefs } from "../data/TrainerList";
import { MapActableDef, MapCollisionRect, MapNpcDef, OverworldMapDef } from "./OverworldMapTypes";

function isBlocked(position: { x: number; y: number }, collisionRects: MapCollisionRect[]): boolean
{
	return collisionRects.some(rectangle =>
		position.x >= rectangle.x
		&& position.x < rectangle.x + rectangle.width
		&& position.y >= rectangle.y
		&& position.y < rectangle.y + rectangle.height,
	);
}

/** Resolve Tiled Actables into runtime NPCs and fail fast for invalid map content. */
export function resolveMapActables(
	actables: MapActableDef[],
	collisionRects: MapCollisionRect[],
): MapNpcDef[]
{
	return actables.map((actable): MapNpcDef =>
	{
		if (actable.trainerId)
		{
			const trainer = TrainerDefs[actable.trainerId];
			if (!trainer) throw new Error(`Actable ${actable.id} references unknown trainer '${actable.trainerId}'.`);
			if (!trainer.mapIntro || !trainer.victoryMessage)
				throw new Error(`Trainer '${trainer.id}' needs mapIntro and victoryMessage before it can be placed on a map.`);
			if (!isBlocked(actable.position, collisionRects))
				throw new Error(`Trainer Actable ${actable.id} (${trainer.id}) must share a blocking map tile.`);
			return {
				id: `actable-${actable.id}`,
				name: trainer.name,
				position: actable.position,
				initialFacing: actable.facing,
				trainerId: trainer.id,
				dialogue: { speaker: trainer.name, lines: [trainer.mapIntro] },
				afterBattleDialogue: { speaker: trainer.name, lines: [trainer.victoryMessage] },
			};
		}

		if (!actable.name || !actable.message)
			throw new Error(`Actable ${actable.id} needs name and message unless it has trainerId.`);
		return {
			id: `actable-${actable.id}`,
			name: actable.name,
			position: actable.position,
			initialFacing: actable.facing,
			dialogue: { speaker: actable.name, lines: [actable.message] },
		};
	});
}

/** Trainer IDs are save-state keys, so a trainer may have one world placement. */
export function validateWorldTrainerPlacements(maps: OverworldMapDef[]): void
{
	const placements = new Map<string, string>();
	for (const map of maps)
	{
		for (const npc of map.npcs)
		{
			if (!npc.trainerId) continue;
			const previousMapId = placements.get(npc.trainerId);
			if (previousMapId)
				throw new Error(`Trainer '${npc.trainerId}' is placed in both '${previousMapId}' and '${map.id}'.`);
			placements.set(npc.trainerId, map.id);
		}
	}
}
