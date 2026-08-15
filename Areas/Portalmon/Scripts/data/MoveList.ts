import { PortalKombatType, StatusEffect } from "./TypeList";

export type MoveId = string;

export interface PortalKombatMoveDef
{
	moveId: MoveId;
	name: string;
	type: PortalKombatType;
	power: number;           // 0 = no direct damage (utility), 10-15 reliable, 18-25 heavy
	effect?: StatusEffectDef;
	target: "self" | "enemy";
	hitChance: number;       // 0..100 (100 = always hits)
}

export interface StatusEffectDef
{
	effectType: StatusEffect;  // must match a key in StatusEffectDescriptions (TypeList.ts)
	maxTurns: number;          // how many turns the effect lasts
	effectPower: number;       // heal or damage per turn (0 = no tick, used for stat-only effects)
	effectChance: number;      // 0..100 chance to apply when the move hits
}

// ============================================================
// MOVE LIBRARY
//
// To add a new move:
//   1. Add an entry below with a unique key matching the `moveId` field
//   2. Choose a type from PortalKombatType (see TypeList.ts)
//   3. Set power (0 for utility, 10-15 reliable, 18-25 heavy)
//   4. Set target: "enemy" for attacks/debuffs, "self" for buffs/heals
//   5. Set hitChance (100 = always hits; lower for high-power moves)
//   6. Optionally add an effect (see StatusEffectDef above)
//   7. Reference the moveId in a creature's moveIds array (CreatureList.ts)
//
// DESIGN NOTES:
//   - Battles last ~4 turns; reliable mid-power moves anchor most kits
//   - Creatures have exactly 3 moves and cannot repeat the same move twice in a row,
//     so kits with two attacks let you alternate while still applying pressure
//   - effectPower is the per-turn tick value (damage for Contaminated, heal for SelfHealing;
//     set to 0 for stat-only effects like Throttled, Optimized, LockOn, Disrupted, Cascading)
// ============================================================
export const MoveLibrary: Record<MoveId, PortalKombatMoveDef> = {

	// -- NORMLING / NORMKING --------------------------------------------------
	// Normling: reliable scanner with a big spike and a self-buff
	// Normking: trades the spike for a more powerful hit and a LockOn setup move

	"threshold_alert": {
		moveId: "threshold_alert", name: "Threshold Alert",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		// Fires off a standard alert when a metric crosses a threshold. Reliable chip damage.
	},
	"spike_warning": {
		moveId: "spike_warning", name: "Spike Warning",
		type: "Performance", power: 22, target: "enemy", hitChance: 80,
		// A sudden metric spike - hits hard but may be a false positive (misses occasionally).
	},
	"normalize": {
		moveId: "normalize", name: "Normalize",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Returns to baseline operating conditions - peak efficiency restored.
	},
	"critical_threshold": {
		moveId: "critical_threshold", name: "Critical Threshold",
		type: "Performance", power: 26, target: "enemy", hitChance: 75,
		// Normking's signature: a catastrophic breach. Punishing if it lands.
	},
	"lock_on_report": {
		moveId: "lock_on_report", name: "Lock-On Report",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "LockOn", maxTurns: 2, effectPower: 0, effectChance: 100 },
		// Normking compiles a targeted report - next moves are surgical.
	},

	// -- CPFNIB ---------------------------------------------------------------
	// Defensive debuffer - throttles enemies and applies Disruption via config changes.
	// Two turns of setup (config_lock + ami_apply) followed by a solid mercator_draft hit.

	"config_lock": {
		moveId: "config_lock", name: "Config Lock",
		type: "Security", power: 12, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 60 },
		// Locks down the enemy's configuration - 60% chance to Throttle their stats.
	},
	"mercator_draft": {
		moveId: "mercator_draft", name: "Mercator Draft",
		type: "Security", power: 16, target: "enemy", hitChance: 100,
		// Mercator pushes a config change directly - a clean, reliable mid-power strike.
	},
	"ami_apply": {
		moveId: "ami_apply", name: "AMI Apply",
		type: "Security", power: 10, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
		// Applies a disruptive config update - 10 chip and enemy's next move fires at 40% accuracy.
	},

	// -- MERCATADOR -----------------------------------------------------------
	// Evolved CPFNib - still slow and defensive, but now hits like a truck.
	// Keeps mercator_draft as a callback; config_purge sets up Cascading for force_apply.
	// Loop: config_purge (self-Cascading) -> force_apply (1.75x boosted) -> mercator_draft -> repeat

	"config_purge": {
		moveId: "config_purge", name: "Config Purge",
		type: "Security", power: 12, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
		// Wipes enemy configuration entirely. Always Disrupts - their next move fires at 40% accuracy.
	},
	"force_apply": {
		moveId: "force_apply", name: "Force Apply",
		type: "Security", power: 22, target: "enemy", hitChance: 85,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 40 },
		// Mercatador pushes the config change through without review - heavy damage, 40% chance to Throttle.
	},

	// -- RESSIE ---------------------------------------------------------------
	// Tanky healer - low attack, but very hard to put down.
	// Two steady attack moves (can always alternate) plus a sustain heal.

	"essential_review": {
		moveId: "essential_review", name: "Essential Review",
		type: "Availability", power: 14, target: "enemy", hitChance: 100,
		// Methodically checks each critical requirement - steady, unexciting damage.
	},
	"validate_settings": {
		moveId: "validate_settings", name: "Validate Settings",
		type: "Availability", power: 16, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 30 },
		// Confirms everything is correct - forces a correction. 30% chance to Disrupt the enemy's next move.
	},
	"self_assess": {
		moveId: "self_assess", name: "Self Assess",
		type: "Availability", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "SelfHealing", maxTurns: 2, effectPower: 10, effectChance: 100 },
		// Ressie reviews itself - identifies and begins repairing its own issues for 2 turns.
	},

	// -- REDPING --------------------------------------------------------------
	// Fast Security sweeper - gets LockOn from red_alert, then pings fast.
	// Disrupts enemy timing with system_flag to force a wasted move.

	"red_alert": {
		moveId: "red_alert", name: "Red Alert",
		type: "Security", power: -6, target: "self", hitChance: 100,
		effect: { effectType: "LockOn", maxTurns: 2, effectPower: 0, effectChance: 100 },
		// Something's wrong - Redping sharpens focus and heals 6 HP. Guarantees next 2 attacks connect.
	},
	"ping_wave": {
		moveId: "ping_wave", name: "Ping Wave",
		type: "Security", power: 20, target: "enemy", hitChance: 100,
		// A rapid burst of pings - Redping's bread and butter attack. Hits harder now that red_alert is a cooldown.
	},
	"system_flag": {
		moveId: "system_flag", name: "System Flag",
		type: "Security", power: 10, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 100 },
		// Flags the enemy as a critical problem - 10 chip and their next move fires at 40% accuracy.
	},

	// -- REDALERT -------------------------------------------------------------
	// Availability escalation kit - Yellow Alert locks the target for a long
	// incident window, then Orange/Red/Plaid cash that in for bigger damage.

	"yellow_alert": {
		moveId: "yellow_alert", name: "Yellow Alert",
		type: "Availability", power: -8, target: "self", hitChance: 100,
		effect: { effectType: "LockOn", maxTurns: 4, effectPower: 10, effectChance: 100 },
		// The dashboards are blinking. Heals 8 HP, guarantees hits and boosts atk for 4 turns.
	},
	"orange_alert": {
		moveId: "orange_alert", name: "Orange Alert",
		type: "Availability", power: 22, target: "enemy", hitChance: 85,
		// The issue is confirmed. Reliable after Yellow Alert, uncertain when fired cold.
	},
	"red_alert_evo": {
		moveId: "red_alert_evo", name: "Red Alert",
		type: "Availability", power: 30, target: "enemy", hitChance: 65,
		// Full outage escalation. Extremely dangerous once the target is locked.
	},

	// -- QUERION --------------------------------------------------------------
	// Manageable utility creature - debuffs enemy stats and sets up LockOn.
	// Works like a support that controls the enemy before landing a focused strike.

	"data_pull": {
		moveId: "data_pull", name: "Data Pull",
		type: "Manageable", power: 18, target: "enemy", hitChance: 100,
		// Pulls data from every connected system and weaponizes it - Querion's primary offensive output.
	},
	"filter_query": {
		moveId: "filter_query", name: "Filter Query",
		type: "Manageable", power: 8, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 3, effectPower: -20, effectChance: 100 },
		// Filters out the enemy's capabilities - chip damage and guaranteed 3-turn Throttle.
	},
	"sort_by_threat": {
		moveId: "sort_by_threat", name: "Sort By Threat",
		type: "Manageable", power: -6, target: "self", hitChance: 100,
		effect: { effectType: "LockOn", maxTurns: 2, effectPower: 0, effectChance: 100 },
		// Re-sorts the query by highest threat - heals 6 HP and guarantees the next 2 attacks connect.
	},

	// -- OWTAGE ---------------------------------------------------------------
	// Disruptive tank - spreads Contamination like a cascading outage.
	// High-risk opener with cascade_failure, then incident_report + emergency_patch to sustain.

	"cascade_failure": {
		moveId: "cascade_failure", name: "Cascade Failure",
		type: "Availability", power: 20, target: "enemy", hitChance: 85,
		effect: { effectType: "Contaminated", maxTurns: 3, effectPower: 10, effectChance: 70 },
		// A total system outage cascades outward - heavy damage with a 70% chance to Contaminate.
	},
	"incident_report": {
		moveId: "incident_report", name: "Incident Report",
		type: "Availability", power: 14, target: "enemy", hitChance: 100,
		// Owtage files an incident report - ironically, as damage.
	},
	"emergency_patch": {
		moveId: "emergency_patch", name: "Emergency Patch",
		type: "Availability", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "SelfHealing", maxTurns: 2, effectPower: 12, effectChance: 100 },
		// The on-call team rushes a patch - Owtage recovers some HP for 2 turns.
	},

	// -- HOOTOPSY ----------------------------------------------------------
	// Evolved precision striker - scans first for LockOn, then unleashes a devastating report.
	// Pattern: outage_scan -> full_report (with LockOn bonus) -> post_mortem for DoT

	"outage_scan": {
		moveId: "outage_scan", name: "Outage Scan",
		type: "Availability", power: -6, target: "self", hitChance: 100,
		effect: { effectType: "LockOn", maxTurns: 2, effectPower: 0, effectChance: 100 },
		// Hootopsy sweeps for the outage signature - heals 6 HP and guarantees the next 2 attacks connect.
	},
	"post_mortem": {
		moveId: "post_mortem", name: "Post Mortem",
		type: "Availability", power: 18, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 10, effectChance: 50 },
		// The incident writeup reveals lingering damage - 50% chance to Contaminate the wound.
	},
	"full_report": {
		moveId: "full_report", name: "Full Report",
		type: "Availability", power: 24, target: "enemy", hitChance: 80,
		// A comprehensive outage report lands with brutal force. Slightly lower accuracy for the payoff.
	},

	// -- PCAW -----------------------------------------------------------------
	// Performance planner - buffs up and hits for increasing effect.
	// Run parallel_review on setup turns; sandwich with capacity_check and hardware_request.

	"capacity_check": {
		moveId: "capacity_check", name: "Capacity Check",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		// Measures how much load the enemy can take - then applies it.
	},
	"parallel_review": {
		moveId: "parallel_review", name: "Parallel Review",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Running all team reviews in parallel - efficiency multiplied.
	},
	"hardware_request": {
		moveId: "hardware_request", name: "Hardware Request",
		type: "Performance", power: 18, target: "enemy", hitChance: 100,
		// Justifying new hardware with a very direct demonstration of why it's needed.
	},

	// -- PURRALLEL -----------------------------------------------------------
	// Evolved heavy hitter - the planning paid off. Goes all the way.
	// full_capacity is a stronger 3-turn Optimized; then hardware_upgrade finishes the fight.

	"capacity_exceeded": {
		moveId: "capacity_exceeded", name: "Capacity Exceeded",
		type: "Performance", power: 22, target: "enemy", hitChance: 85,
		// The system is past its limit - an overloaded punch with a slight chance to miss.
	},
	"hardware_upgrade": {
		moveId: "hardware_upgrade", name: "Hardware Upgrade",
		type: "Performance", power: 26, target: "enemy", hitChance: 75,
		// New hardware arrives - a massive performance uplift delivered directly to the enemy's face.
	},
	"full_capacity": {
		moveId: "full_capacity", name: "Full Capacity",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 3, effectPower: 15, effectChance: 100 },
		// Every resource engaged - Purrallel is fully Optimized for 3 turns.
	},

	// -- BEECYERVIEW ----------------------------------------------------------
	// Best-practice tank/support - survives through HA failover healing.
	// compliance_check passively Throttles enemies who aren't following best practices.

	"best_practice_audit": {
		moveId: "best_practice_audit", name: "Best Practice Audit",
		type: "Availability", power: 14, target: "enemy", hitChance: 100,
		// Auditing the enemy for best-practice failures. Finds several. Reports them physically.
	},
	"compliance_check": {
		moveId: "compliance_check", name: "Compliance Check",
		type: "Availability", power: 14, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 50 },
		// Is the enemy DR-ready? Probably not. 50% chance to Throttle the non-compliant.
	},
	"ha_failover": {
		moveId: "ha_failover", name: "HA Failover",
		type: "Availability", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "SelfHealing", maxTurns: 2, effectPower: 10, effectChance: 100 },
		// Failover to the HA standby - a shorter sustained heal burst. This is what Beecyerview is here for.
	},

	// -- MEMLET ---------------------------------------------------------------
	// Risky Performance attacker - great sizing grants Optimized; overcommit is high-risk/reward.

	"memory_alloc": {
		moveId: "memory_alloc", name: "Memory Alloc",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		// Allocates memory precisely where it hurts. A clean, reliable attack.
	},
	"overcommit": {
		moveId: "overcommit", name: "Overcommit",
		type: "Performance", power: 22, target: "enemy", hitChance: 75,
		// Promises more memory than exists - sometimes it works out great, sometimes it doesn't.
	},
	"size_estimate": {
		moveId: "size_estimate", name: "Size Estimate",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Running gref and hardware math - Memlet arrives at the correct allocation for peak output.
	},

	// -- ORAKLE ---------------------------------------------------------------
	// Intentionally weak joke creature. Low power, questionable accuracy. Sometimes tries.

	"ponder": {
		moveId: "ponder", name: "Ponder",
		type: "Manageable", power: 8, target: "enemy", hitChance: 65,
		// Orakle considers its options at length. Takes a while. Might land.
	},
	"vague_prophecy": {
		moveId: "vague_prophecy", name: "Vague Prophecy",
		type: "Manageable", power: 10, target: "enemy", hitChance: 75,
		// Technically it predicted this moment. Whether that helps is unclear.
	},
	"misfire": {
		moveId: "misfire", name: "Misfire",
		type: "Manageable", power: 14, target: "enemy", hitChance: 50,
		// Orakle's strongest move. Coin flip. Named with great self-awareness.
	},

	// -- PRODLE ---------------------------------------------------------------
	// Manageable puzzle creature - methodically narrows down the answer.
	// process_of_elimination guarantees a Throttle; yellow_tile Disrupts; green_tile closes it out.

	"yellow_tile": {
		moveId: "yellow_tile", name: "Yellow Tile",
		type: "Manageable", power: 12, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 50 },
		// Right letter, wrong position - close but disorienting. 50% chance to Disrupt.
	},
	"green_tile": {
		moveId: "green_tile", name: "Green Tile",
		type: "Manageable", power: 20, target: "enemy", hitChance: 100,
		// Prodle nails the letter. Direct, satisfying, no miss chance.
	},
	"process_of_elimination": {
		moveId: "process_of_elimination", name: "Process of Elimination",
		type: "Manageable", power: 8, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 100 },
		// Prodle has logically determined what the enemy can no longer do. Chip + guaranteed Throttle.
	},

	// -- DOUGTRIO -------------------------------------------------------------
	// Legendary - elite coder and cloud expert. Punishes mistakes, optimizes everything.
	// rubber_duck_debug finds bugs (Contaminate); cloud_optimize buffs up; tech_consult closes.

	"rubber_duck_debug": {
		moveId: "rubber_duck_debug", name: "Rubber Duck Debug",
		type: "Performance", power: 16, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 40 },
		// Explaining the problem out loud reveals a critical bug in the enemy's code - 40% to Contaminate.
	},
	"cloud_optimize": {
		moveId: "cloud_optimize", name: "Cloud Optimize",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 3, effectPower: 15, effectChance: 100 },
		// Doug applies 15 years of cloud expertise to himself. 3-turn Optimized. Of course it works.
	},
	"tech_consult": {
		moveId: "tech_consult", name: "Tech Consult",
		type: "Performance", power: 24, target: "enemy", hitChance: 90,
		// Doug reviews the enemy's architecture. The feedback is... pointed.
	},

	// -- AZURITE (Cloud Legendary - Azure) ----------------------------
	// IaaS tank - reliable mid-power hit, guaranteed Throttle, and a risky heavy strike.
	// VNet Fence locks the enemy down; Ultra Disk Hurl chips reliably; IOPS Burst closes.

	"ultra_disk_hurl": {
		moveId: "ultra_disk_hurl", name: "Ultra Disk Hurl",
		type: "Security", power: 16, target: "enemy", hitChance: 100,
		// Premium tier. Premium damage. A Managed Disk thrown as a projectile.
	},
	"vnet_fence": {
		moveId: "vnet_fence", name: "VNet Fence",
		type: "Security", power: 8, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 100 },
		// Network isolation - 8 chip and guaranteed Throttle. Nothing gets through the virtual fence.
	},
	"iops_burst": {
		moveId: "iops_burst", name: "IOPS Burst",
		type: "Security", power: 22, target: "enemy", hitChance: 80,
		// Burns through the entire provisioned IOPS budget in one hit. Might overshoot, definitely hurts.
	},


	// -- GEN 1 POKEMON (GLaDOS cross-dimensional imports) --------------
	// These creatures were imported from POKEMON_GEN_1.DB.

	"vine_whip": {
		moveId: "vine_whip", name: "Vine Whip",
		type: "Availability", power: 14, target: "enemy", hitChance: 100,
		// Classic grass move. Reliable chip from Venusaur.
	},
	"sleep_powder": {
		moveId: "sleep_powder", name: "Sleep Powder",
		type: "Availability", power: 0, target: "enemy", hitChance: 90,
		effect: { effectType: "Throttled", maxTurns: 3, effectPower: -20, effectChance: 100 },
		// Puts the enemy to sleep - modeled as a long Throttle. 90% hit (Venusaur has practice).
	},
	"leech_seed": {
		moveId: "leech_seed", name: "Leech Seed",
		type: "Availability", power: 0, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 3, effectPower: 8, effectChance: 100 },
		// Drains HP each turn. Venusaur's signature control.
	},
	"water_pulse": {
		moveId: "water_pulse", name: "Water Pulse",
		type: "Security", power: 16, target: "enemy", hitChance: 100,
		// Pressurized water blast from Blastoise's cannons.
	},
	"iron_defense": {
		moveId: "iron_defense", name: "Iron Defense",
		type: "Security", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 3, effectPower: 15, effectChance: 100 },
		// Blastoise retreats into shell. Massive DEF boost.
	},
	"hydro_pump": {
		moveId: "hydro_pump", name: "Hydro Pump",
		type: "Security", power: 24, target: "enemy", hitChance: 80,
		// Full-power dual cannon blast. High risk, high reward.
	},
	"flamethrower": {
		moveId: "flamethrower", name: "Flamethrower",
		type: "Performance", power: 18, target: "enemy", hitChance: 100,
		// Charizard's bread and butter. Reliable fire damage.
	},
	"dragon_dance": {
		moveId: "dragon_dance", name: "Dragon Dance",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Charizard powers up with draconic energy.
	},
	"fire_blast": {
		moveId: "fire_blast", name: "Fire Blast",
		type: "Performance", power: 26, target: "enemy", hitChance: 75,
		// Charizard's nuke. Devastating if it lands.
	},

	// -- BROADMAWL (Joke - self-sabotaging Broadcom attacker) ------------
	// vMotion still works. The licensing is what hurts. Bundle Tax + License Squeeze
	// punish the enemy AND Broadmawl - true to form.

	"vmotion": {
		moveId: "vmotion", name: "vMotion",
		type: "Security", power: 16, target: "enemy", hitChance: 100,
		// The core tech still works. A clean, reliable migration of pain.
	},
	"license_squeeze": {
		moveId: "license_squeeze", name: "License Squeeze",
		type: "Security", power: 22, target: "enemy", hitChance: 85,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 100 },
		// Devastating constriction. Guaranteed Contamination. The licensing hurts everyone.
	},
	"bundle_tax": {
		moveId: "bundle_tax", name: "Bundle Tax",
		type: "Security", power: 0, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 80 },
		// Mandatory licensing bundle. 80% Throttle. The bundle hurts everyone.
	},

	// -- FOSSLAIX (Joke - unkillable legacy fossil) ----------------------
	// Nobody remembers who deployed it. Legacy Hold locks enemies in a 3-turn contract.
	// Power Cycle heals - turn it off and on again. Always works.

	"legacy_hold": {
		moveId: "legacy_hold", name: "Legacy Hold",
		type: "Availability", power: 0, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 100 },
		// The contract hasn\'t expired. You\'re locked in. 2-turn Throttle.
	},
	"mainframe_slam": {
		moveId: "mainframe_slam", name: "Mainframe Slam",
		type: "Availability", power: 20, target: "enemy", hitChance: 90,
		// Full weight of a 30-year-old mainframe. Slow, heavy, and surprisingly hard to avoid.
	},
	"power_cycle": {
		moveId: "power_cycle", name: "Power Cycle",
		type: "Availability", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "SelfHealing", maxTurns: 2, effectPower: 8, effectChance: 100 },
		// Turn it off and on again. Always works. The system lives on.
	},

	// -- FYRD (Defensive reader - read I/O daemon) -----------------------
	// Blue oni, tai chi stance. Reads data and absorbs it into buffer cache.
	// Buffer Absorb sustains; Seek Strike disrupts enemy I/O.

	"disk_read": {
		moveId: "disk_read", name: "Disk Read",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		// Pulls data from enemy storage and weaponizes it.
	},
	"buffer_absorb": {
		moveId: "buffer_absorb", name: "Buffer Absorb",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "SelfHealing", maxTurns: 2, effectPower: 10, effectChance: 100 },
		// Absorbs data into global buffer cache. Heals as read completes.
	},
	"seek_strike": {
		moveId: "seek_strike", name: "Seek Strike",
		type: "Performance", power: 18, target: "enemy", hitChance: 90,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 40 },
		// Precision read-head seek. 40% Disrupts enemy I/O.
	},

	// -- FYWR (Aggressive writer - write I/O daemon) ---------------------
	// Red oni, karate stance. Writes 8K blocks with fury.
	// Write Burst primes Cascading; Flush Strike delivers the payload.

	"block_write": {
		moveId: "block_write", name: "Block Write",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		// Slams an 8K block onto target. Reliable, consistent, hot.
	},
	"write_burst": {
		moveId: "write_burst", name: "Write Burst",
		type: "Performance", power: 10, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 50 },
		// Frenzied writes slam into the enemy. 50% chance to leave contaminating heat damage behind.
	},
	"flush_strike": {
		moveId: "flush_strike", name: "Flush Strike",
		type: "Performance", power: 24, target: "enemy", hitChance: 85,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 50 },
		// All dirty buffers flush at once. 50% thermal Contamination. Hits harder without setup needed.
	},

	// -- GOCKENSMITH (Scientific benchmarker - precision I/O tester) -----
	// Wiry gecko in goggles. Runs synthetic I/O workloads and ramp tests.
	// Ramp Run primes Cascading; Even Stripe delivers max throughput.

	"datagen": {
		moveId: "datagen", name: "Datagen",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 6, effectChance: 40 },
		// Synthetic I/O workload dumped on target. 40% data overflow Contaminates.
	},
	"ramp_run": {
		moveId: "ramp_run", name: "Ramp Run",
		type: "Performance", power: 8, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 6, effectChance: 40 },
		// Ramping I/O load hammers the enemy subsystem. 40% chance of overflow contamination.
	},
	"even_stripe": {
		moveId: "even_stripe", name: "Even Stripe",
		type: "Performance", power: 22, target: "enemy", hitChance: 90,
		// Perfectly balanced I/O across all LUNs. Naturally high throughput - no warmup needed.
	},

	// -- PIXELWRAITH (Joke - unreliable Citrix speedster) ----------------
	// Glitching ghost with screen-tear artifacts. Fast but everything misses.
	// Session Drop is powerful but only lands 60%. Reconnect is the only reliable move.

	"session_drop": {
		moveId: "session_drop", name: "Session Drop",
		type: "Manageable", power: 18, target: "enemy", hitChance: 60,
		// Full payload. Connection drops 40% of the time. Classic Citrix.
	},
	"screen_tear": {
		moveId: "screen_tear", name: "Screen Tear",
		type: "Manageable", power: 14, target: "enemy", hitChance: 75,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 50 },
		// Glitch artifact rips through enemy vision. 50% Disrupt. IF it lands.
	},
	"reconnect": {
		moveId: "reconnect", name: "Reconnect",
		type: "Manageable", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Drops and reestablishes session. The only move that always works.
	},

	// -- WRIDAEMON (Relentless writer - fiery write daemon) --------------
	// Fiery red imp with glowing horns. 8K blocks all day every day.
	// Cycle Burst primes Cascading; Thermal Spike delivers burn + Contamination.

	"block_flush": {
		moveId: "block_flush", name: "Block Flush",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		// Slams a completed 8K block into the enemy. Reliable, relentless.
	},
	"thermal_spike": {
		moveId: "thermal_spike", name: "Thermal Spike",
		type: "Performance", power: 26, target: "enemy", hitChance: 80,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 8, effectChance: 50 },
		// I/O overheats under sustained pressure. 50% chance burning Contaminates - write queue backing up.
	},
	"cycle_burst": {
		moveId: "cycle_burst", name: "Cycle Burst",
		type: "Performance", power: 10, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 50 },
		// Erratic write burst destabilizes enemy I/O scheduling. 50% chance to Disrupt their next move.
	},

	// -- YIK (Anonymous gossip - doomscrolling yak) ----------------------
	// Hunched yak on phone. Posts anonymously and downvotes.
	// Incognito Mode buffs; Downvote guarantees a short Throttle.

	"anonymous_post": {
		moveId: "anonymous_post", name: "Anonymous Post",
		type: "Security", power: 14, target: "enemy", hitChance: 100,
		// Posts something devastating. No one knows who wrote it. Everyone saw it.
	},
	"incognito_mode": {
		moveId: "incognito_mode", name: "Incognito Mode",
		type: "Security", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Can\'t be tracked, can\'t be stopped. Optimized for 2 turns.
	},
	"downvote": {
		moveId: "downvote", name: "Downvote",
		type: "Security", power: 10, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 100 },
		// The community has spoken. 2-turn Throttle as reputation craters.
	},

	// -- YODEL (Evolution of Yik - anonymous broadcaster) ----------------
	// Standing bipedal yak in alpine costume. Yodels across mountains.
	// Masquerade sets up LockOn; Yodel Blast delivers burst + Disruption.

	"echo_chamber": {
		moveId: "echo_chamber", name: "Echo Chamber",
		type: "Security", power: 18, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 2, effectPower: 6, effectChance: 40 },
		// Take so loud it echoes off every mountain. 40% viral Contamination.
	},
	"masquerade": {
		moveId: "masquerade", name: "Masquerade",
		type: "Security", power: -6, target: "self", hitChance: 100,
		effect: { effectType: "LockOn", maxTurns: 2, effectPower: 0, effectChance: 100 },
		// Adjusts masquerade mask - heals 6 HP and guarantees the next 2 attacks connect.
	},
	"yodel_blast": {
		moveId: "yodel_blast", name: "Yodel Blast",
		type: "Security", power: 22, target: "enemy", hitChance: 85,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 50 },
		// Full-throated alpine yodel. 50% Disrupted from sheer volume.
	},


	// -- FORTRESS (Evolution of Ressie - castle-bearing world turtle) ----
	// Full defensive infrastructure. Lockdown shuts enemies down,
	// Kernel Crush delivers offense, Bastion Wall sustains with healing.

	"lockdown": {
		moveId: "lockdown", name: "Lockdown",
		type: "Availability", power: 10, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 100 },
		// Raises the drawbridge, drops the portcullis. 10 chip and guaranteed 2-turn Throttle.
	},
	"kernel_crush": {
		moveId: "kernel_crush", name: "Kernel Crush",
		type: "Availability", power: 20, target: "enemy", hitChance: 100,
		// Every kernel parameter tuned to perfection, delivered to the enemy.
	},
	"bastion_wall": {
		moveId: "bastion_wall", name: "Bastion Wall",
		type: "Availability", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "SelfHealing", maxTurns: 3, effectPower: 12, effectChance: 100 },
		// Full defensive infrastructure activated. Walls reinforced, services restarted.
	},


	// -- GAIER (Defensive setup - Borg duckling) ---------------------------
	// Fluffy yellow duckling with one red mechanical eye. Quietly assimilates.
	// Assimilate Throttles; Adapt Protocol self-buffs. Duckling Peck is "normal".

	"assimilate": {
		moveId: "assimilate", name: "Assimilate",
		type: "Security", power: 12, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 50 },
		// Absorbs a piece of the enemy\'s system. 50% chance they feel the drag.
	},
	"duckling_peck": {
		moveId: "duckling_peck", name: "Duckling Peck",
		type: "Security", power: 14, target: "enemy", hitChance: 100,
		// A totally normal duck. That pecks with a slightly metallic bill.
	},
	"adapt_protocol": {
		moveId: "adapt_protocol", name: "Adapt Protocol",
		type: "Security", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Systems quietly self-optimize. The assimilation is working.
	},

	// -- SWANBORG (Evolution of Gaier - Borg swan) -------------------------
	// Majestic white swan with Borg plating. Resistance is futile.
	// Collective Strike hits hard + Throttle; Optical Scan locks on; Elegant Override disrupts.

	"collective_strike": {
		moveId: "collective_strike", name: "Collective Strike",
		type: "Security", power: 22, target: "enemy", hitChance: 85,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 60 },
		// Full force of the collective through the cybernetic wing. 60% Throttle.
	},
	"optical_scan": {
		moveId: "optical_scan", name: "Optical Scan",
		type: "Security", power: -6, target: "self", hitChance: 100,
		effect: { effectType: "LockOn", maxTurns: 2, effectPower: 0, effectChance: 100 },
		// Red optical sensor locks on - heals 6 HP and guarantees the next 2 attacks connect.
	},
	"elegant_override": {
		moveId: "elegant_override", name: "Elegant Override",
		type: "Security", power: 18, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 40 },
		// Graceful cybernetic wing sweep rewrites the enemy\'s next command. 40% Disrupted.
	},

	// -- AMAZONITE (Legendary - AWS stone lion) -----------------------------
	// Smooth teal stone golem. IaaS attacker - fast, burst-oriented.
	// EC2 Burst chips; S3 Dump hits hard; VPC Lockdown buffs.

	"ec2_burst": {
		moveId: "ec2_burst", name: "EC2 Burst",
		type: "Performance", power: 14, target: "enemy", hitChance: 100,
		// Spins up a burst instance. T3 unlimited, baby.
	},
	"s3_dump": {
		moveId: "s3_dump", name: "S3 Dump",
		type: "Performance", power: 18, target: "enemy", hitChance: 90,
		// Dumps an entire S3 bucket. Eventual consistency means it occasionally misses.
	},
	"vpc_lockdown": {
		moveId: "vpc_lockdown", name: "VPC Lockdown",
		type: "Performance", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "Optimized", maxTurns: 2, effectPower: 20, effectChance: 100 },
		// Hardens VPC security groups and route tables.
	},

	// -- COBALTITE (Legendary Evo of Azurite - three-headed crystal cerberus) --
	// Ampere Override primes Cascading; Egress Toll chips + Contaminates;
	// VM Limit Crush is the nuke.

	"ampere_override": {
		moveId: "ampere_override", name: "Ampere Override",
		type: "Security", power: 12, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 3, effectPower: 8, effectChance: 60 },
		// Overloads enemy circuits with ARM core voltage. 60% chance to Contaminate for 3 turns.
	},
	"egress_toll": {
		moveId: "egress_toll", name: "Egress Toll",
		type: "Security", power: 14, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 3, effectPower: 8, effectChance: 60 },
		// Routes traffic out - the bills start adding up. 60% Contamination.
	},
	"vm_limit_crush": {
		moveId: "vm_limit_crush", name: "VM Limit Crush",
		type: "Security", power: 26, target: "enemy", hitChance: 80,
		// All three heads exceed vCPU quota simultaneously. No warmup required.
	},

	// -- GRAVITONITE (Legendary Evo of Amazonite - three-headed stone hydra) --
	// Graviton Crunch primes Cascading; Egress Drain chips + Contaminates;
	// Provisioned IOPS is the nuke.

	"graviton_crunch": {
		moveId: "graviton_crunch", name: "Graviton Crunch",
		type: "Performance", power: 12, target: "enemy", hitChance: 100,
		effect: { effectType: "Disrupted", maxTurns: 1, effectPower: 0, effectChance: 70 },
		// All three heads crush with Graviton force. 70% chance to Disrupt - enemy staggers before the follow-up.
	},
	"egress_drain": {
		moveId: "egress_drain", name: "Egress Drain",
		type: "Performance", power: 16, target: "enemy", hitChance: 100,
		effect: { effectType: "Contaminated", maxTurns: 3, effectPower: 8, effectChance: 60 },
		// Data pours out - someone gotta pay per GB. 60% Contamination.
	},
	"provisioned_iops": {
		moveId: "provisioned_iops", name: "Provisioned IOPS",
		type: "Performance", power: 28, target: "enemy", hitChance: 85,
		// 64,000 IOPS. All three heads. Delivered at once. No warmup required.
	},


	// -- ICEBOX (Data protection tank - immutable cold storage) ---------
	// Maximum ransomware defense. On-Demand RO locks the enemy down,
	// Interface Disconnect air-gaps for healing, Limited R/W chips away.

	"on_demand_ro": {
		moveId: "on_demand_ro", name: "On-Demand RO",
		type: "Availability", power: 10, target: "enemy", hitChance: 100,
		effect: { effectType: "Throttled", maxTurns: 2, effectPower: -20, effectChance: 100 },
		// Switches the enemy to read-only. 10 chip and guaranteed 2-turn Throttle. No writes allowed.
	},
	"interface_disconnect": {
		moveId: "interface_disconnect", name: "Interface Disconnect",
		type: "Availability", power: 0, target: "self", hitChance: 100,
		effect: { effectType: "SelfHealing", maxTurns: 3, effectPower: 10, effectChance: 100 },
		// Air-gaps from the network. Nothing gets in. Heals for 3 turns.
	},
	"limited_rw": {
		moveId: "limited_rw", name: "Limited R/W",
		type: "Availability", power: 16, target: "enemy", hitChance: 100,
		// Grants just enough write access to do some damage. Emphasis on "limited."
	},

};

// ============================================================
// MOVE SOUND MAPPINGS
// Keep this compact and keyed by moveId so rename churn in display
// names does not silently break audio.
// ============================================================

export function getMoveSoundFile(moveId: MoveId): string | undefined
{
	switch (moveId)
	{
		case "critical_threshold":
			return "aeroblast_1.2s.mp3";

		case "capacity_exceeded":
		case "cascade_strike":
		case "even_stripe":
		case "flamethrower":
		case "full_report":
		case "green_tile":
		case "hardware_request":
		case "hydro_pump":
		case "iops_burst":
		case "kernel_crush":
		case "mainframe_slam":
		case "misfire":
		case "overcommit":
		case "s3_dump":
		case "spike_warning":
		case "tech_consult":
		case "vm_limit_crush":
			return "body_slam.mp3";

		case "fire_blast":
		case "yodel_blast":
			return "eruption_1.2s.mp3";

		case "ping_wave":
			return "fury_attack_2hits.mp3";

		case "ami_apply":
		case "assimilate":
		case "bundle_tax":
		case "cascade_failure":
		case "collective_strike":
		case "compliance_check":
		case "config_lock":
		case "datagen":
		case "downvote":
		case "echo_chamber":
		case "egress_drain":
		case "egress_toll":
		case "elegant_override":
		case "filter_query":
		case "flush_strike":
		case "force_apply":
		case "leech_seed":
		case "legacy_hold":
		case "license_squeeze":
		case "lockdown":
		case "on_demand_ro":
		case "post_mortem":
		case "process_of_elimination":
		case "screen_tear":
		case "seek_strike":
		case "sleep_powder":
		case "system_flag":
		case "thermal_spike":
		case "vnet_fence":
		case "yellow_tile":
			return "growl.mp3";

		case "hardware_upgrade":
		case "provisioned_iops":
			return "hyper_beam_1.2s.mp3";

		case "bastion_wall":
		case "buffer_absorb":
		case "emergency_patch":
		case "ha_failover":
		case "interface_disconnect":
		case "power_cycle":
		case "self_assess":
			return "recover.mp3";

		case "adapt_protocol":
		case "cloud_optimize":
		case "dragon_dance":
		case "full_capacity":
		case "incognito_mode":
		case "iron_defense":
		case "lock_on_report":
		case "masquerade":
		case "normalize":
		case "optical_scan":
		case "outage_scan":
		case "parallel_review":
		case "reconnect":
		case "red_alert":
		case "yellow_alert":
		case "size_estimate":
		case "sort_by_threat":
		case "vpc_lockdown":
			return "swords_dance.mp3";

		case "orange_alert":
		case "red_alert_evo":
			return "body_slam.mp3";

		case "best_practice_audit":
		case "block_flush":
		case "block_write":
		case "capacity_check":
		case "data_pull":
		case "disk_read":
		case "duckling_peck":
		case "ec2_burst":
		case "essential_review":
		case "incident_report":
		case "limited_rw":
		case "memory_alloc":
		case "mercator_draft":
		case "ponder":
		case "threshold_alert":
		case "ultra_disk_hurl":
		case "validate_settings":
		case "vine_whip":
		case "vmotion":
		case "water_pulse":
			return "tackle.mp3";

		case "ampere_override":
		case "anonymous_post":
		case "config_purge":
		case "cycle_burst":
		case "graviton_crunch":
		case "ramp_run":
		case "rubber_duck_debug":
		case "session_drop":
		case "vague_prophecy":
		case "write_burst":
			return "transform.mp3";

		default:
			return undefined;
	}
}