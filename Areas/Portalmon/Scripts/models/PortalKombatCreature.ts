import { SpeciesId } from "../data/CreatureList";
import { PortalKombatMoveDef, StatusEffectDef } from "../data/MoveList";
import { StatusEffectDescriptions } from "../data/TypeList";
import { ChargeArchetype } from "../data/UltimateList";

/**
 * Runtime (battle) creature wrapper bound to front-end with knockout
 * Immutable data comes from CreatureDex + MoveLibrary;
 */
export class PortalKombatCreature
{
	/** Runtime identity (unique per party slot / battle). */
	public id: string; // kept for backwards compatibility with existing bindings
	public instanceId: string;
	public speciesId: SpeciesId;

	// Derived (from SpeciesDef)
	public name: string;
	public type: string;
	public creatureDescription?: string;
	public portraitImage?: string;
	public behindImage?: string;
	public battleSpriteScale: number;
	public flipEnemy: boolean;
	public flipPlayer: boolean;

	/* core stats */
	public hpMax: number;
	public atk: number;
	public def: number;
	public spd: number;

	// Mutable (instance state)
	public hpCurrent: KnockoutObservable<number>;

	/**
	 * Full status definitions with turn counters.
	 * Note: CreatureInstance uses `{ kind: StatusEffectDef; turnsLeft: number }`.
	 */
	public statusEffects: KnockoutObservableArray<{ effect: StatusEffectDef; turnsLeft: KnockoutObservable<number> }>;

	/**
	 * Convenience for UI display with tooltip descriptions.
	 */
	public statuses: KnockoutComputed<{ label: string; description: string }[]>;

	public moves: KnockoutObservableArray<PortalKombatMoveDef>;

	public isFainted: KnockoutComputed<boolean>;
	public hpPercent: KnockoutComputed<number>;

	/* charge system */
	public charge: KnockoutObservable<number>;
	public maxCharge: number;
	public chargeArchetype: ChargeArchetype;
	public ultReady: KnockoutComputed<boolean>;
	public chargePercent: KnockoutComputed<number>;
	public ultAccuracyBonus: number; // for Prodle's miss-stack mechanic
	public reflectTurns: KnockoutObservable<number>; // Castle Doctrine damage reflect

	constructor(init: {
		instanceId: string;
		speciesId: SpeciesId;
		name: string;
		typeLabel: string;
		creatureDescription?: string;
		portraitImage?: string;
		behindImage?: string;
		battleSpriteScale?: number;
		flipEnemy?: boolean;
		flipPlayer?: boolean;
		hpMax: number;
		hpCurrent?: number;
		atk: number;
		def: number;
		spd: number;
		moves: PortalKombatMoveDef[];
		statuses?: { kind: StatusEffectDef; turnsLeft: number }[];
		maxCharge?: number;
		chargeArchetype?: ChargeArchetype;
	})
	{
		this.id = init.instanceId;
		this.instanceId = init.instanceId;
		this.speciesId = init.speciesId;

		this.name = init.name;
		this.type = init.typeLabel;
		this.creatureDescription = init.creatureDescription;
		this.portraitImage = init.portraitImage || "/Areas/Portalmon/Content/Images/Portalmon/MissingNo.png";

		this.behindImage = init.behindImage || "/Areas/Portalmon/Content/Images/Portalmon/MissingNo.png";
		this.battleSpriteScale = init.battleSpriteScale ?? 1;
		this.flipEnemy = init.flipEnemy ?? false;
		this.flipPlayer = init.flipPlayer ?? false;
		this.hpMax = init.hpMax;
		this.hpCurrent = ko.observable(init.hpCurrent ?? init.hpMax);
		this.atk = init.atk;
		this.def = init.def;
		this.spd = init.spd;

		this.moves = ko.observableArray(init.moves);

		this.statusEffects = ko.observableArray(
			(init.statuses ?? []).map(s => ({ effect: s.kind, turnsLeft: ko.observable(s.turnsLeft) }))
		);

		this.statuses = ko.pureComputed(() =>
			this.statusEffects().map(se => ({
				label: `${se.effect.effectType} (${se.turnsLeft()})`,
				description: StatusEffectDescriptions[se.effect.effectType] || se.effect.effectType,
			}))
		);

		// Charge system
		this.maxCharge = init.maxCharge ?? 3;
		this.chargeArchetype = init.chargeArchetype ?? "Brawler";
		this.charge = ko.observable(0);
		this.ultAccuracyBonus = 0;
		this.reflectTurns = ko.observable(0);
		this.ultReady = ko.pureComputed(() => this.charge() >= this.maxCharge);
		this.chargePercent = ko.pureComputed(() =>
		{
			if (this.maxCharge <= 0) return 0;
			return Math.min(100, Math.round((this.charge() / this.maxCharge) * 100));
		});

		this.isFainted = ko.pureComputed(() => this.hpCurrent() <= 0);
		this.hpPercent = ko.pureComputed(() =>
		{
			const pct = (this.hpCurrent() / Math.max(1, this.hpMax)) * 100;
			return Math.max(0, Math.min(100, Math.round(pct)));
		});
	}

}
