import { PortalKombatType, StatusEffect } from "./TypeList";
import { StatusEffectDef } from "./MoveList";

// ============================================================
// CHARGE ARCHETYPES
// ============================================================

export type ChargeArchetype = "Brawler" | "Endurance" | "Tactician" | "Momentum" | "Chaos";

// ============================================================
// ULTIMATE ANIMATION CATEGORIES
// ============================================================

export type UltAnimCategory =
	| "single-hit"      // One big impact (Black Swan Event, Cache Hit)
	| "multi-hit"       // Rapid repeated strikes (Parallel Deployment, fsync)
	| "bench-spread"    // Hits active + bench (Pushed to Prod, Architecture Review)
	| "buff-heal"       // Party heal/buff (Green Across the Board)
	| "defensive"       // Shield/reflect (Castle Doctrine)
	| "status-control"  // Debuff/info (SELECT * FROM enemy, Sev 1)
	| "comedy";         // Special unique (Audit Season, Blue Screen of Death, Solved in 1)

// ============================================================
// ULTIMATE SPECIAL EFFECTS
// Each gets a handler in the combat engine.
// ============================================================

export type UltSpecial =
	| { kind: "auto_miss_next"; condition: StatusEffect }
	| { kind: "guaranteed_if_status"; status: StatusEffect; bonusEffect?: StatusEffectDef }
	| { kind: "consume_status_heal"; status: StatusEffect; healAmount: number }
	| { kind: "double_hits_if_status"; status: StatusEffect }
	| { kind: "bonus_per_hit_if_status"; status: StatusEffect; bonusPower: number }
	| { kind: "execute_threshold"; threshold: number; fallbackPower: number }
	| { kind: "miss_refund_charge" }
	| { kind: "miss_stack_accuracy"; increment: number }
	| { kind: "damage_reflect"; percent: number; turns: number }
	| { kind: "steal_all_buffs" }
	| { kind: "reduce_enemy_charge"; amount: number }
	| { kind: "escalating_hits"; powers: number[] }
	| { kind: "random_targets"; count: number }
	| { kind: "per_hit_status_chance"; chance: number; effect: StatusEffectDef }
	| { kind: "reveal_bench" }
	| { kind: "min_damage_if_status"; status: StatusEffect; minPower: number }
	;

export type UltSynergyBonus =
	| { kind: "accuracy_boost"; hitChance: number }
	| { kind: "extra_hits"; count: number }
	| { kind: "heal_self"; amount: number }
	| { kind: "extra_status"; effect: StatusEffectDef }
	| { kind: "extend_dot"; extraTurns: number }
	;

// ============================================================
// ULTIMATE DEFINITION
// ============================================================

export interface UltimateDef
{
	ultId: string;
	name: string;
	type: PortalKombatType;
	power: number;
	hits: number;
	hitChance: number;
	chargeCost: number;
	target: "enemy" | "self" | "all-enemy" | "all-ally";
	animCategory: UltAnimCategory;
	flavorText: string;
	soundFile?: string;

	effect?: StatusEffectDef;
	special?: UltSpecial;
	benchDamage?: { power: number };
	selfDamage?: number;
	selfHeal?: number;
	partyHeal?: number;

	benchSynergy?: {
		speciesId: string;
		bonus: UltSynergyBonus;
	};
}

// ============================================================
// ULTIMATE LIBRARY — All 30+ creature ultimates from the Bible
// ============================================================

export const UltimateLibrary: Record<string, UltimateDef> = {

	// ═══════════════════════════════════════════════════════════
	// STARTERS
	// ═══════════════════════════════════════════════════════════

	"false_positive": {
		ultId: "false_positive", name: "False Positive",
		type: "Performance", power: 36, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Normling screams about a spike, everyone panics, but the false positive was real this time.",
		special: { kind: "auto_miss_next", condition: "Optimized" },
	},

	"pushed_to_dev": {
		ultId: "pushed_to_dev", name: "Pushed to Dev",
		type: "Security", power: 16, hits: 3, hitChance: 100, chargeCost: 3,
		target: "enemy", animCategory: "bench-spread",
		flavorText: "You drafted it, applied it, and pushed it... to dev. Not prod. Yet.",
		benchDamage: { power: 12 },
	},

	"green_across_the_board": {
		ultId: "green_across_the_board", name: "Green Across the Board",
		type: "Availability", power: 0, hits: 0, hitChance: 100, chargeCost: 4,
		target: "all-ally", animCategory: "buff-heal",
		flavorText: "Ressie checked every box, validated every setting, and the whole board is green.",
		partyHeal: 25,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
	},

	"yellow_upgrade": {
		ultId: "yellow_upgrade", name: "Yellow Upgrade",
		type: "Performance", power: 30, hits: 1, hitChance: 85, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Please just do an AMI dry run.",
		special: { kind: "guaranteed_if_status", status: "LockOn", bonusEffect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 } },
	},

	// ═══════════════════════════════════════════════════════════
	// EVOLUTIONS
	// ═══════════════════════════════════════════════════════════

	"black_swan_event": {
		ultId: "black_swan_event", name: "Black Swan Event",
		type: "Performance", power: 45, hits: 1, hitChance: 85, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "The statistical impossibility. The event that shouldn't exist just destroyed you.",
		special: { kind: "guaranteed_if_status", status: "LockOn", bonusEffect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 } },
	},

	"red_upgrade": {
		ultId: "red_upgrade", name: "Red Upgrade",
		type: "Performance", power: 30, hits: 2, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "Your customer won't add hardware. You are now on Tyson's naughty list.",
		special: { kind: "guaranteed_if_status", status: "LockOn", bonusEffect: { effectType: "Disrupted", maxTurns: 2, effectPower: 0, effectChance: 80 } },
	},

	"pushed_to_prod": {
		ultId: "pushed_to_prod", name: "Pushed to Prod",
		type: "Security", power: 22, hits: 3, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "bench-spread",
		flavorText: "\"I just got Pushed to Prod\" will be the most repeated sentence on April Fools day.",
		benchDamage: { power: 16 },
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
	},

	"castle_doctrine": {
		ultId: "castle_doctrine", name: "Castle Doctrine",
		type: "Availability", power: 32, hits: 1, hitChance: 100, chargeCost: 5,
		target: "enemy", animCategory: "defensive",
		flavorText: "The drawbridge is up. The archers are ready. Your move.",
		special: { kind: "damage_reflect", percent: 50, turns: 2 },
		partyHeal: 12,
	},

	"blameless_post_mortem": {
		ultId: "blameless_post_mortem", name: "Blameless Post-Mortem",
		type: "Availability", power: 35, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Root cause identified. Resolution: violence.",
		special: { kind: "consume_status_heal", status: "Contaminated", healAmount: 25 },
	},

	"parallel_deployment": {
		ultId: "parallel_deployment", name: "Parallel Deployment",
		type: "Performance", power: 16, hits: 4, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "Four tails, four teams, four deployments, four problems.",
		special: { kind: "min_damage_if_status", status: "Optimized", minPower: 20 },
	},

	"resistance_is_futile": {
		ultId: "resistance_is_futile", name: "Resistance Is Futile",
		type: "Security", power: 30, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "status-control",
		flavorText: "Everything you built up? It's Swanborg's now.",
		special: { kind: "steal_all_buffs" },
		benchSynergy: { speciesId: "gaier", bonus: { kind: "heal_self", amount: 25 } },
	},

	"reply_all": {
		ultId: "reply_all", name: "Reply All",
		type: "Security", power: 18, hits: 3, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "Someone Reply All'd it to the entire company. Three echoes off every mountain.",
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
		benchSynergy: { speciesId: "yik", bonus: { kind: "extra_status", effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 } } },
	},

	// ═══════════════════════════════════════════════════════════
	// WILD CREATURES
	// ═══════════════════════════════════════════════════════════

	"all_monitors_red": {
		ultId: "all_monitors_red", name: "All Monitors Red",
		type: "Security", power: 26, hits: 2, hitChance: 100, chargeCost: 3,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "Every monitor. Every metric. Red.",
		// If enemy has ANY negative status: hits 3x instead of 2x
		special: { kind: "double_hits_if_status", status: "Throttled" }, // checks any negative
	},

	"plaid_alert": {
		ultId: "plaid_alert", name: "Plaid Alert",
		type: "Availability", power: 60, hits: 1, hitChance: 55, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "They've gone to plaid!",
		soundFile: "hyper_beam_1.2s.mp3",
		special: { kind: "guaranteed_if_status", status: "LockOn" },
	},

	"select_from_enemy": {
		ultId: "select_from_enemy", name: "SELECT * FROM enemy",
		type: "Manageable", power: 28, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "status-control",
		flavorText: "SELECT hp, charge, fear_level FROM enemy_team WHERE surviving = true",
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 60 },
		special: { kind: "reveal_bench" },
	},

	"sev_1": {
		ultId: "sev_1", name: "Sev 1",
		type: "Availability", power: 28, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "status-control",
		flavorText: "A Sev 1 incident takes down the system AND the on-call engineer.",
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 10, effectChance: 100 },
		selfDamage: 12,
	},

	"over_capacity": {
		ultId: "over_capacity", name: "Over Capacity",
		type: "Performance", power: 22, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "The capacity assessment came back — you're over capacity.",
		special: { kind: "double_hits_if_status", status: "Optimized" },
	},

	"dr_cutover": {
		ultId: "dr_cutover", name: "DR Cutover",
		type: "Availability", power: 13, hits: 5, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "The disaster recovery cutover is live — every standby bee activates.",
		special: { kind: "per_hit_status_chance", chance: 35, effect: { effectType: "Throttled", maxTurns: 1, effectPower: -15, effectChance: 100 } },
	},

	"oom_killer": {
		ultId: "oom_killer", name: "OOM Killer",
		type: "Performance", power: 0, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "When memory's gone, a process dies. Period.",
		special: { kind: "execute_threshold", threshold: 35, fallbackPower: 25 },
	},

	"phase_one": {
		ultId: "phase_one", name: "Phase One",
		type: "Security", power: 16, hits: 1, hitChance: 100, chargeCost: 3,
		target: "enemy", animCategory: "status-control",
		flavorText: "Just a duckling. With one weird eye. Nothing to worry about.",
		// Steals 1 random positive status; if none, applies Throttled
		special: { kind: "steal_all_buffs" }, // simplified: steals 1 for Gaier
	},

	"true_up": {
		ultId: "true_up", name: "True-Up",
		type: "Security", power: 32, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "The VMware true-up — everyone discovers they owe more than expected.",
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 },
		selfDamage: 15,
	},

	"leaked_to_all_staff": {
		ultId: "leaked_to_all_staff", name: "Leaked to All-Staff",
		type: "Security", power: 20, hits: 1, hitChance: 100, chargeCost: 3,
		target: "enemy", animCategory: "status-control",
		flavorText: "The anonymous post went company-wide. Management saw it. HR saw it. Everyone saw it.",
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 },
		benchSynergy: { speciesId: "yodel", bonus: { kind: "extend_dot", extraTurns: 1 } },
	},

	"fsync": {
		ultId: "fsync", name: "fsync",
		type: "Performance", power: 10, hits: 6, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "The Unix command that forces all buffered writes to disk.",
		special: { kind: "bonus_per_hit_if_status", status: "Cascading", bonusPower: 5 },
	},

	"cache_hit": {
		ultId: "cache_hit", name: "Cache Hit",
		type: "Performance", power: 30, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Data was in cache, instant delivery. The most satisfying thing in database performance.",
		selfHeal: 30, // heals Fyrd for 100% of damage dealt
	},

	"force_flush": {
		ultId: "force_flush", name: "Force Flush",
		type: "Performance", power: 38, hits: 1, hitChance: 90, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Every dirty buffer purged at once.",
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 10, effectChance: 100 },
	},

	"regression_test": {
		ultId: "regression_test", name: "Regression Test",
		type: "Performance", power: 10, hits: 3, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "It tests for regressions... by regressing your HP to zero.",
		special: { kind: "escalating_hits", powers: [10, 15, 20] },
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 },
	},

	// ═══════════════════════════════════════════════════════════
	// JOKE CREATURES
	// ═══════════════════════════════════════════════════════════

	"audit_season": {
		ultId: "audit_season", name: "Audit Season",
		type: "Manageable", power: 1, hits: 50, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "comedy",
		flavorText: "Death by a thousand paper cuts. Each one meaningless, collectively devastating.",
		special: { kind: "per_hit_status_chance", chance: 10, effect: { effectType: "Throttled", maxTurns: 1, effectPower: -15, effectChance: 100 } },
	},

	"blue_screen_of_death": {
		ultId: "blue_screen_of_death", name: "Blue Screen of Death",
		type: "Manageable", power: 50, hits: 1, hitChance: 40, chargeCost: 3,
		target: "enemy", animCategory: "comedy",
		flavorText: "It crashes, it fails, it reconnects, and somehow eventually it works.",
		special: { kind: "miss_refund_charge" },
	},

	"auto_renew": {
		ultId: "auto_renew", name: "Auto-Renew",
		type: "Availability", power: 20, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "status-control",
		flavorText: "You thought you were done with this fossil but it's BACK.",
		special: { kind: "reduce_enemy_charge", amount: 2 },
	},

	// ═══════════════════════════════════════════════════════════
	// LEGENDARIES — Cloud Duo
	// ═══════════════════════════════════════════════════════════

	"subscription_tier_enterprise": {
		ultId: "subscription_tier_enterprise", name: "Subscription Tier: Enterprise",
		type: "Security", power: 30, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "buff-heal",
		flavorText: "You're paying enterprise pricing and getting enterprise results.",
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 100 },
		partyHeal: 15,
	},

	"multi_region_failover": {
		ultId: "multi_region_failover", name: "Multi-Region Failover",
		type: "Security", power: 23, hits: 3, hitChance: 85, chargeCost: 5,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "Three heads, three regions, three problems. All yours. BONUS: if Azurite is on your bench, this attack never misses.",
		benchSynergy: { speciesId: "azurite", bonus: { kind: "accuracy_boost", hitChance: 100 } },
	},

	"us_east_1_is_down": {
		ultId: "us_east_1_is_down", name: "us-east-1 Is Down",
		type: "Performance", power: 30, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "bench-spread",
		flavorText: "When us-east-1 goes down, EVERYTHING goes down — half the internet breaks.",
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
		benchDamage: { power: 15 },
		special: { kind: "double_hits_if_status", status: "Optimized" },
	},

	"reserved_instance_3yr": {
		ultId: "reserved_instance_3yr", name: "Reserved Instance (3-Year)",
		type: "Performance", power: 55, hits: 1, hitChance: 75, chargeCost: 5,
		target: "enemy", animCategory: "single-hit",
		flavorText: "You committed fully and the savings are massive.",
		effect: { effectType: "Contaminated", maxTurns: 3, effectPower: 8, effectChance: 100 },
		benchSynergy: { speciesId: "amazonite", bonus: { kind: "extra_status", effect: { effectType: "Contaminated", maxTurns: 3, effectPower: 8, effectChance: 100 } } },
	},

	// ═══════════════════════════════════════════════════════════
	// LEGENDARIES — Other
	// ═══════════════════════════════════════════════════════════

	"architecture_review": {
		ultId: "architecture_review", name: "Architecture Review",
		type: "Performance", power: 18, hits: 3, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "bench-spread",
		flavorText: "Three Dougs review your entire stack and nobody escapes the feedback.",
		special: { kind: "random_targets", count: 3 },
	},

	"solved_in_1": {
		ultId: "solved_in_1", name: "Solved in 1",
		type: "Manageable", power: 40, hits: 1, hitChance: 50, chargeCost: 3,
		target: "enemy", animCategory: "comedy",
		flavorText: "Sometimes you nail it first try, sometimes it takes a few. But when it hits?",
		special: { kind: "miss_stack_accuracy", increment: 25 },
	},

	// ═══════════════════════════════════════════════════════════
	// GEN 1 POKEMON ULTIMATES (GLaDOS imports)
	// ═══════════════════════════════════════════════════════════

	"solar_beam": {
		ultId: "solar_beam", name: "Solar Beam",
		type: "Availability", power: 40, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Concentrated solar energy from another dimension's sun.",
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 },
	},

	"hydro_cannon": {
		ultId: "hydro_cannon", name: "Hydro Cannon",
		type: "Security", power: 22, hits: 3, hitChance: 90, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "Full-pressure triple blast from both cannons.",
	},

	"blast_burn": {
		ultId: "blast_burn", name: "Blast Burn",
		type: "Performance", power: 55, hits: 1, hitChance: 80, chargeCost: 5,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Charizard's ultimate fire attack. Consider this GLaDOS's escalation to management.",
	},

	"safe_harbor": {
		ultId: "safe_harbor", name: "Safe Harbor",
		type: "Availability", power: 32, hits: 1, hitChance: 100, chargeCost: 5,
		target: "enemy", animCategory: "defensive",
		flavorText: "Immutable snapshot confirmed. Ransomware bounces off. Your move.",
		special: { kind: "damage_reflect", percent: 50, turns: 2 },
	},


	// ═══════════════════════════════════════════════════════════
	// WAVE 2 — New creatures
	// ═══════════════════════════════════════════════════════════

	"subscription_model": {
		ultId: "subscription_model", name: "Subscription Model",
		type: "Security", power: 45, hits: 1, hitChance: 45, chargeCost: 3,
		target: "enemy", animCategory: "comedy",
		flavorText: "The subscription auto-renewed. The invoice is enormous. You can\'t cancel.",
		special: { kind: "miss_refund_charge" },
	},

	"power_ha_crash": {
		ultId: "power_ha_crash", name: "Power HA Crash",
		type: "Availability", power: 40, hits: 1, hitChance: 50, chargeCost: 3,
		target: "enemy", animCategory: "comedy",
		flavorText: "The Power HA cluster crashed. But it\'ll come back. It always comes back.",
		special: { kind: "miss_refund_charge" },
	},

	"latency_injection": {
		ultId: "latency_injection", name: "Latency Injection",
		type: "Performance", power: 30, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "status-control",
		flavorText: "Injects 500ms of latency into every I/O path. The enemy feels every millisecond.",
		effect: { effectType: "Throttled", maxTurns: 3, effectPower: -30, effectChance: 100 },
	},

	"halt_writes": {
		ultId: "halt_writes", name: "Halt Writes",
		type: "Performance", power: 40, hits: 1, hitChance: 90, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "All write I/O halted. The buffers are frozen. Nothing is getting through.",
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
	},

	"cyclone_kick_240s": {
		ultId: "cyclone_kick_240s", name: "240s Cyclone Kick",
		type: "Performance", power: 12, hits: 4, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "240 seconds of pure write frenzy. The disk never stops spinning.",
		special: { kind: "bonus_per_hit_if_status", status: "Contaminated", bonusPower: 6 },
	},

	"herd_mentality": {
		ultId: "herd_mentality", name: "Herd Mentality",
		type: "Security", power: 26, hits: 1, hitChance: 100, chargeCost: 3,
		target: "enemy", animCategory: "status-control",
		flavorText: "The herd has spoken. Everyone piles on. Anonymous, relentless. BONUS: if Yodel is on your bench, contamination lasts longer.",
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 },
		benchSynergy: { speciesId: "yodel", bonus: { kind: "extend_dot", extraTurns: 1 } },
	},

	"gossip_vortex": {
		ultId: "gossip_vortex", name: "Gossip Vortex",
		type: "Security", power: 18, hits: 3, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "The monthly all-staff leak is live. Every reply, reaction, and whispered side-thread turns into public damage. BONUS: if Yik is on your bench, it also contaminates the target.",
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
		benchSynergy: { speciesId: "yik", bonus: { kind: "extra_status", effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 } } },
	},

	"dynamo_punch": {
		ultId: "dynamo_punch", name: "Dynamo Punch",
		type: "Performance", power: 40, hits: 1, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "single-hit",
		flavorText: "DynamoDB on-demand. Unlimited throughput. Unlimited pain.",
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
	},

	"nitro_charge": {
		ultId: "nitro_charge", name: "Nitro Charge",
		type: "Performance", power: 0, hits: 1, hitChance: 100, chargeCost: 5,
		target: "enemy", animCategory: "single-hit",
		flavorText: "Nitro-accelerated ARM cores calculate your exact remaining HP. It\'s not enough. BONUS: if Amazonite is on your bench, Gravitonite restores HP.",
		special: { kind: "execute_threshold", threshold: 50, fallbackPower: 33 },
		benchSynergy: { speciesId: "amazonite", bonus: { kind: "heal_self", amount: 25 } },
	},

	"generate_pain": {
		ultId: "generate_pain", name: "Generate Pain",
		type: "Performance", power: 12, hits: 3, hitChance: 100, chargeCost: 4,
		target: "enemy", animCategory: "multi-hit",
		flavorText: "Each run hurts more than the last.",
		special: { kind: "escalating_hits", powers: [12, 18, 24] },
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 },
	},

};

export function getUltimateSoundFile(ult: UltimateDef): string | undefined
{
	if (ult.soundFile) return ult.soundFile;

	switch (ult.ultId)
	{
		case "solar_beam":
			return "aeroblast_1.2s.mp3";
		case "solved_in_1":
			return "transform.mp3";
		default:
			break;
	}

	switch (ult.animCategory)
	{
		case "single-hit":
			return "doom_desire_1.0s.mp3";
		case "multi-hit":
			return "volt_tackle_1.2s.mp3";
		case "bench-spread":
			return "eruption_1.2s.mp3";
		case "buff-heal":
			return "safeguard_1.2s.mp3";
		case "defensive":
			return "iron_defense_1.2s.mp3";
		case "status-control":
		case "comedy":
			return "psycho_boost_1.2s.mp3";
		default:
			return undefined;
	}
}