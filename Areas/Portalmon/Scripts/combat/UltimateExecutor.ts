import { PortalKombatCreature } from "../models/PortalKombatCreature";
import { PortalKombatMoveDef } from "../data/MoveList";
import { UltimateDef } from "../data/UltimateList";
import { getRandomInt, getTypeMultiplier, wait } from "../HelperFunctions";
import { ChargeReason } from "./ChargeSystem";

export interface UltimateExecutionSummary
{
	didDealDamage: boolean;
}

/** The handful of CombatManager operations executeUltimate needs back. */
export interface UltimateExecutorDeps
{
	addLog: (line: string) => void;
	applyStatus: (creature: PortalKombatCreature, effect: PortalKombatMoveDef["effect"]) => void;
	getEffectiveStats: (creature: PortalKombatCreature) => { atk: number; def: number; spd: number };
	tickCharge: (creature: PortalKombatCreature, reason: ChargeReason) => number;
	enemySpriteState: (state?: string) => string | void;
}

/**
 * Resolves a single ultimate-move activation: synergy/special-effect
 * modifiers, the hit loop (damage, misses, status procs), and all the
 * per-ult special-case branches. Pulled out of CombatManager because it's
 * the single largest self-contained block in the file — its only ties back
 * into the battle are the small set of callbacks in UltimateExecutorDeps.
 */
export async function executeUltimate(
	deps: UltimateExecutorDeps,
	attacker: PortalKombatCreature,
	defender: PortalKombatCreature,
	ult: UltimateDef,
	attackerParty: PortalKombatCreature[],
	defenderParty: PortalKombatCreature[],
): Promise<UltimateExecutionSummary>
{
	const { addLog, applyStatus, getEffectiveStats, tickCharge, enemySpriteState } = deps;

	let synergyActive = false;
	if (ult.benchSynergy)
	{
		synergyActive = attackerParty.some(p => p.id !== attacker.id && p.speciesId === ult.benchSynergy!.speciesId && !p.isFainted());
		if (synergyActive) addLog(`Bench synergy active!`);
	}

	let hits = ult.hits;
	let power = ult.power;
	let hitChance = ult.hitChance;
	const damagedTargets = new Map<string, PortalKombatCreature>();

	if (synergyActive && ult.benchSynergy)
	{
		const b = ult.benchSynergy.bonus;
		if (b.kind === "accuracy_boost") hitChance = b.hitChance;
		if (b.kind === "extra_hits") hits += b.count;
		if (b.kind === "heal_self") { attacker.hpCurrent(Math.min(attacker.hpMax, attacker.hpCurrent() + b.amount)); addLog(`${attacker.name} healed ${b.amount} HP from synergy!`); }
	}

	if (ult.special)
	{
		if (ult.special.kind === "guaranteed_if_status" && attacker.statusEffects().some(se => se.effect.effectType === (ult.special as any).status)) hitChance = 100;
		if (ult.special.kind === "double_hits_if_status" && (attacker.statusEffects().some(se => se.effect.effectType === (ult.special as any).status) || defender.statusEffects().some(se => ["Throttled","Contaminated","Disrupted"].includes(se.effect.effectType)))) hits += 1;
		if (ult.special.kind === "execute_threshold")
		{
			if (defender.hpPercent() <= (ult.special as any).threshold)
			{
				defender.hpCurrent(0);
				damagedTargets.set(defender.id, defender);
				tickCharge(defender, "took-damage");
				addLog(`${defender.name} was instantly decommissioned!`);
				return { didDealDamage: true };
			}
			else power = (ult.special as any).fallbackPower;
		}
	}

	// random_targets: hit count comes from special.count, not ult.hits
	if (ult.special?.kind === "random_targets")
		hits = (ult.special as any).count;

	hitChance = Math.min(100, hitChance + attacker.ultAccuracyBonus);

	// Build target pool for random_targets (Architecture Review)
	const targetPool = ult.special?.kind === "random_targets"
		? defenderParty.filter(p => !p.isFainted())
		: [defender];

	let totalDmg = 0;
	for (let i = 0; i < hits; i++)
	{
		// Pick target: random from pool if random_targets, otherwise active defender
		const hitTarget = targetPool.length > 0
			? targetPool[Math.floor(Math.random() * targetPool.length)]
			: defender;
		let hitPower = ult.special?.kind === "escalating_hits" ? ((ult.special as any).powers[i] ?? power) : power;
		if (ult.special?.kind === "min_damage_if_status" && attacker.statusEffects().some(se => se.effect.effectType === (ult.special as any).status)) hitPower = Math.max(hitPower, (ult.special as any).minPower);
		if (ult.special?.kind === "bonus_per_hit_if_status" && attacker.statusEffects().some(se => se.effect.effectType === (ult.special as any).status)) hitPower += (ult.special as any).bonusPower;

		if (getRandomInt(1, 100) > hitChance) {
			addLog(`${attacker.name}\'s attack missed!`);
			if (ult.special?.kind === "miss_refund_charge")
			{
				attacker.charge(attacker.maxCharge);
				addLog(`${attacker.name} recovered its full ULT charge.`);
			}
			if (ult.special?.kind === "miss_stack_accuracy") attacker.ultAccuracyBonus += (ult.special as any).increment;
			continue;
		}

		if (hitPower > 0)
		{
			const { atk } = getEffectiveStats(attacker);
			const { def } = getEffectiveStats(hitTarget);
			const dmg = Math.max(1, Math.round(((hitPower + atk) - def + Math.floor(Math.random() * 5) - 2) * getTypeMultiplier(ult.type, hitTarget.type)));
			hitTarget.hpCurrent(Math.max(0, hitTarget.hpCurrent() - dmg));
			damagedTargets.set(hitTarget.id, hitTarget);
			totalDmg += dmg;
			if (hits <= 6) addLog(`Hit ${i + 1}: ${dmg} damage.`);

			// Damage reflect (Castle Doctrine) — applies to ult hits too
			if (hitTarget.reflectTurns() > 0)
			{
				const pct = (hitTarget as any)._reflectPercent ?? 0.5;
				const reflected = Math.round(dmg * pct);
				attacker.hpCurrent(Math.max(0, attacker.hpCurrent() - reflected));
				addLog(`${attacker.name} took ${reflected} reflected damage!`);
			}
		}

		if (ult.special?.kind === "per_hit_status_chance" && getRandomInt(1, 100) <= (ult.special as any).chance)
			applyStatus(hitTarget, (ult.special as any).effect);

		if (hits <= 6) { enemySpriteState("hit"); await wait(Math.max(60, 150 - i * 15)); enemySpriteState("idle"); }
		else if (i % 5 === 0) { enemySpriteState("hit"); await wait(40); enemySpriteState("idle"); }

		if (hitTarget.isFainted())
		{
			// Remove fainted target from pool
			const idx = targetPool.indexOf(hitTarget);
			if (idx >= 0) targetPool.splice(idx, 1);
			if (targetPool.length === 0) break;
		}
	}

	if (hits > 1) addLog(`Total: ${totalDmg} damage across ${hits} hits.`);

	if (ult.benchDamage)
	{
		for (const bp of defenderParty)
		{
			if (bp.id === defender.id || bp.isFainted()) continue;
			bp.hpCurrent(Math.max(0, bp.hpCurrent() - ult.benchDamage.power));
			damagedTargets.set(bp.id, bp);
			addLog(`${bp.name} took ${ult.benchDamage.power} bench damage!`);
		}
	}
	if (ult.selfDamage) { attacker.hpCurrent(Math.max(0, attacker.hpCurrent() - ult.selfDamage)); addLog(`${attacker.name} took ${ult.selfDamage} recoil.`); }
	if (ult.selfHeal) { const h = Math.min(ult.selfHeal, attacker.hpMax - attacker.hpCurrent()); attacker.hpCurrent(attacker.hpCurrent() + h); if (h > 0) addLog(`${attacker.name} healed ${h} HP.`); }
	if (ult.partyHeal) { for (const m of attackerParty) { if (m.isFainted()) continue; const h = Math.min(ult.partyHeal, m.hpMax - m.hpCurrent()); m.hpCurrent(m.hpCurrent() + h); if (h > 0) addLog(`${m.name} healed ${h} HP.`); } }
	if (ult.effect) { if (ult.target === "enemy" || ult.target === "all-enemy") applyStatus(defender, ult.effect); else applyStatus(attacker, ult.effect); addLog(`${ult.effect.effectType} applied!`); }

	for (const damaged of damagedTargets.values())
		tickCharge(damaged, "took-damage");

	if (ult.special)
	{
		if (ult.special.kind === "auto_miss_next" && attacker.statusEffects().some(se => se.effect.effectType === (ult.special as any).condition)) applyStatus(defender, { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 });
		if (ult.special.kind === "guaranteed_if_status" && (ult.special as any).bonusEffect && attacker.statusEffects().some(se => se.effect.effectType === (ult.special as any).status)) applyStatus(defender, (ult.special as any).bonusEffect);
		if (ult.special.kind === "steal_all_buffs") { const stolen = defender.statusEffects().filter(se => ["Optimized","LockOn","SelfHealing","Cascading"].includes(se.effect.effectType)); for (const se of stolen) { applyStatus(attacker, { ...se.effect, effectChance: 100 }); defender.statusEffects.remove(se); addLog(`Stole ${se.effect.effectType}!`); } if (stolen.length === 0) applyStatus(defender, { effectType: "Throttled", maxTurns: 2, effectPower: 0, effectChance: 100 }); }
		if (ult.special.kind === "damage_reflect") { attacker.reflectTurns((ult.special as any).turns); (attacker as any)._reflectPercent = (ult.special as any).percent / 100; addLog(`${attacker.name} reflecting ${(ult.special as any).percent}% damage for ${(ult.special as any).turns} turns!`); }
		if (ult.special.kind === "reduce_enemy_charge") { defender.charge(Math.max(0, defender.charge() - (ult.special as any).amount)); addLog(`${defender.name}\'s charge reduced!`); }
		if (ult.special.kind === "reveal_bench") { for (const bp of defenderParty) addLog(`Intel: ${bp.name} HP ${bp.hpCurrent()}/${bp.hpMax} Charge ${bp.charge()}/${bp.maxCharge}`); }
		if (ult.special.kind === "consume_status_heal") { const t = defender.statusEffects().find(se => se.effect.effectType === (ult.special as any).status); if (t) { defender.statusEffects.remove(t); attacker.hpCurrent(Math.min(attacker.hpMax, attacker.hpCurrent() + (ult.special as any).healAmount)); addLog(`Consumed status, healed ${(ult.special as any).healAmount} HP!`); } }
	}

	if (synergyActive && ult.benchSynergy?.bonus.kind === "extra_status") applyStatus(defender, (ult.benchSynergy.bonus as any).effect);
	if (synergyActive && ult.benchSynergy?.bonus.kind === "extend_dot") { const dot = defender.statusEffects().find(se => se.effect.effectType === "Contaminated"); if (dot) dot.turnsLeft(dot.turnsLeft() + (ult.benchSynergy!.bonus as any).extraTurns); }
	if (totalDmg > 0 && attacker.ultAccuracyBonus > 0) attacker.ultAccuracyBonus = 0;
	return { didDealDamage: damagedTargets.size > 0 };
}
