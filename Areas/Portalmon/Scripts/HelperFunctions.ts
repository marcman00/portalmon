// This file is a collection of generally useful functions used throughout the Portal Kombat code.

import { PortalKombatMoveDef } from "./data/MoveList";
import { PortalKombatType, TypeChart, StatusEffectDescriptions } from "./data/TypeList";

/** Waits a given amount of time before moving on */
export function wait(ms: number): Promise<void>
{
	return new Promise(resolve => setTimeout(resolve, ms));
}

/** Gets a random integer between min and max (inclusive) */
export function getRandomInt(min: number, max: number): number
{
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns the type effectiveness multiplier for a move type vs a defender type.
 * Defender type may be dual (e.g. "Performance/Security") - in that case each
 * half is evaluated independently and the results are multiplied together
 * (matching standard Pokemon dual-type behaviour).
 */
export function getTypeMultiplier(moveType: PortalKombatType, defenderType: string): number
{
	const parts = defenderType.split("/") as PortalKombatType[];
	let multiplier = 1;
	for (const part of parts)
	{
		multiplier *= TypeChart[moveType]?.[part] ?? 1;
	}
	return multiplier;
}

/** Builds an HTML tooltip string for a move, with an optional cooldown warning */
export function buildMoveTooltip(move: PortalKombatMoveDef, isBlocked?: boolean): string
{
	const lines: string[] = [];
	if (isBlocked)
		lines.push(`<b style="color:#f03030">ON COOLDOWN - Used last turn</b>`);
	lines.push(`<b>Type:</b> ${move.type}`);
	lines.push(`<b>Power:</b> ${move.power || '---'} &nbsp; <b>Accuracy:</b> ${move.hitChance}%`);
	lines.push(`<b>Target:</b> ${move.target === 'self' ? 'Self' : 'Enemy'}`);
	if (move.effect)
	{
		const desc = StatusEffectDescriptions[move.effect.effectType] || '';
		lines.push(`<b>Effect:</b> ${move.effect.effectType} (${move.effect.effectChance}% chance, ${move.effect.maxTurns}t)`);
		if (desc) lines.push(`<span style="color:#d4b8ff">${desc}</span>`);
	}
	return lines.join('<br>');
}
