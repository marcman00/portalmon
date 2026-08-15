import { PortalKombatCreature } from "../models/PortalKombatCreature";
import { PortalKombatMoveDef } from "../data/MoveList";
import { UltimateDef } from "../data/UltimateList";

export type ChargeReason = "passive" | "dealt-damage" | "took-damage" | "used-setup" | "stayed-in";
export type ActingChargeReason = "dealt-damage" | "used-setup" | "stayed-in";
type ChargeLogMode = "always" | "ready-only";

/**
 * All ULT-charge-meter bookkeeping for one battle: passive ticks, archetype
 * bonuses, bench charging (half rate), swap penalties, and ult spend.
 * Pulled out of CombatManager as its own unit - the only thing it needs from
 * the battle it's charging for is somewhere to write log lines.
 */
export class ChargeSystem
{
	private playerTurnCount: number = 0;
	private enemyTurnCount: number = 0;

	constructor(private addLog: (line: string) => void) { }

	/** Reset at the start of every new battle (wild, gym, or sim). */
	public resetTurnCounters(): void
	{
		this.playerTurnCount = 0;
		this.enemyTurnCount = 0;
	}

	/** Reasons a creature's charge might increment */
	public tickCharge(creature: PortalKombatCreature, reason: ChargeReason, logMode: ChargeLogMode = "always"): number
	{
		if (creature.charge() >= creature.maxCharge) return 0;
		if (creature.isFainted()) return 0;

		let gain = 0;
		let sourceLabel = "";

		if (reason === "passive")
		{
			gain = 1;
			sourceLabel = "Passive";
		}
		else
		{
			switch (creature.chargeArchetype)
			{
				case "Brawler":   if (reason === "dealt-damage") { gain = 1; sourceLabel = "Brawler"; } break;
				case "Endurance": if (reason === "took-damage") { gain = 1; sourceLabel = "Endurance"; } break;
				case "Tactician": if (reason === "used-setup") { gain = 1; sourceLabel = "Tactician"; } break;
				case "Momentum":  if (reason === "stayed-in") { gain = 1; sourceLabel = "Momentum"; } break;
				case "Chaos":     { gain = 1; sourceLabel = "Chaos"; } break;
			}
		}

		if (gain <= 0) return 0;

		const previous = creature.charge();
		const next = Math.min(creature.maxCharge, previous + gain);
		const actualGain = next - previous;
		if (actualGain <= 0) return 0;

		creature.charge(next);
		const reachedReady = previous < creature.maxCharge && next >= creature.maxCharge;
		if (logMode === "always" || (logMode === "ready-only" && reachedReady))
		{
			const readySuffix = reachedReady ? " READY" : "";
			this.addLog(`${creature.name} ULT +${actualGain} [${sourceLabel}] (${next}/${creature.maxCharge})${readySuffix}.`);
		}

		return actualGain;
	}

	public applyStartTurnCharge(side: "player" | "enemy", attacker: PortalKombatCreature, party: PortalKombatCreature[]): void
	{
		const sideTurnNumber = side === "player"
			? ++this.playerTurnCount
			: ++this.enemyTurnCount;

		this.tickCharge(attacker, "passive");
		this.tickBenchCharge(party, attacker, sideTurnNumber);
	}

	/** Tick passive charge for bench creatures (half rate: +1 every other turn) */
	private tickBenchCharge(party: PortalKombatCreature[], active: PortalKombatCreature, turnNumber: number): void
	{
		for (const member of party)
		{
			if (member.id === active.id) continue;
			if (member.isFainted()) continue;
			// Half rate: charge every other turn
			if (turnNumber % 2 === 0)
			{
				this.tickCharge(member, "passive", "ready-only");
			}
		}
	}

	/** Apply charge penalty when swapping out */
	public penalizeSwapCharge(creature: PortalKombatCreature): void
	{
		const previous = creature.charge();
		const next = Math.max(0, previous - 1);
		if (previous === next) return;
		creature.charge(next);
		this.addLog(`${creature.name} ULT -${previous - next} [Swap] (${next}/${creature.maxCharge}).`);
	}

	public spendUltCharge(creature: PortalKombatCreature, cost: number, ultName: string): void
	{
		const previous = creature.charge();
		const next = Math.max(0, previous - cost);
		creature.charge(next);
		this.addLog(`${creature.name} ULT -${previous - next} [${ultName}] (${next}/${creature.maxCharge}).`);
	}

	public getMoveChargeReason(move: PortalKombatMoveDef, dealtDamage: boolean): ActingChargeReason
	{
		if (dealtDamage) return "dealt-damage";
		if (move.target === "self") return "used-setup";
		return "stayed-in";
	}

	public getUltimateChargeReason(ult: UltimateDef, didDealDamage: boolean): ActingChargeReason
	{
		if (didDealDamage) return "dealt-damage";
		if (ult.target === "self" || ult.target === "all-ally" || ult.power === 0) return "used-setup";
		return "stayed-in";
	}
}
