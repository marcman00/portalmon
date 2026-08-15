import { MoveId, StatusEffectDef } from "./MoveList";
import { PortalKombatType } from "./TypeList";
import { ChargeArchetype } from "./UltimateList";

export type SpeciesId = string;
export type PortalEncounterUnlock = "always" | "after_champion_defeated";

export interface SpeciesDef
{
	id: SpeciesId;
	name: string;
	type: PortalKombatType | `${PortalKombatType}/${PortalKombatType}`;
	base: { hp: number; atk: number; def: number; spd: number };
	moveIds: [MoveId, MoveId, MoveId]; // 3 regular moves
	creatureDescription?: string;  // emoji/text fallback shown in battle when no image
	portraitImage?: string;        // URL to sprite image
	behindImage?: string;         // URL to back/trainer-side sprite
	battleSpriteScale?: number;    // optional visual-only scale bump for battle sprites
	flipEnemy?: boolean;           // true = mirror front sprite for enemy position (default: false)
	flipPlayer?: boolean;          // true = mirror behind sprite for player position (default: false)
	ultimateId?: string;            // references UltimateLibrary key
	chargeArchetype?: ChargeArchetype; // how this creature charges its ultimate
	evolvesFrom?: SpeciesId;       // set on evolution creatures; omit on base forms
	portalUnlock?: PortalEncounterUnlock; // gates when this species can appear in random encounters
}

export interface CreatureInstance
{
	instanceId: string;    // unique per battle / party slot
	speciesId: SpeciesId;  // links to CreatureDex
	hpCurrent: number;
	statuses: { kind: StatusEffectDef; turnsLeft: number }[];
}

// ============================================================
// STAT PHILOSOPHY
//
// Base creatures have modest stats that define a clear role.
// Evolutions are meaningfully better but not overwhelming (~+15-20% key stats).
// Legendaries sit at roughly evolution tier - special, not broken.
// Orakle is intentionally below curve (joke creature).
//
// Roles and what to prioritize:
//   Glass cannon   - high atk, low def, mid spd         (normling)
//   Speed sweeper  - max spd, good atk, low bulk        (redping)
//   Setup attacker - balanced stats, rewards buff turns  (pclaw, memlet)
//   Aggressive     - high hp + atk, sacrifices def/spd  (owtage)
//   Heal tank      - extreme hp + def, low atk/spd      (ressie, beecyerview)
//   Control        - balanced, value is in status moves  (querion, prodle)
//   Disrupt tank   - high def, average atk, low spd     (cpfnib)
//   Joke           - below curve across the board       (orakle)
// ============================================================
export const CreatureDex: Record<SpeciesId, SpeciesDef> = {

	// ===========================================================
	// STARTERS
	// ===========================================================

	"normling": {
		// Glass cannon - fast, hits hard, not built to take hits.
		// Spike Warning is the win condition; Normalize buys a second chance.
		id: "normling",
		name: "Normling",
		type: "Performance",
		base: { hp: 75, atk: 18, def: 12, spd: 16 },
		moveIds: ["threshold_alert", "spike_warning", "normalize"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Normling.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Normling_Behind.png",
		flipEnemy: true,
		ultimateId: "false_positive",
		chargeArchetype: "Brawler",
		creatureDescription: "Always looking for the next issue to solve",
	},

	"cpfnib": {
		// Disrupt tank - slow but hard to shift. Wins by locking down the enemy
		// and landing a clean Mercator Draft while they're Throttled or Disrupted.
		id: "cpfnib",
		name: "CPFNib",
		type: "Security",
		base: { hp: 78, atk: 13, def: 19, spd: 9 },
		moveIds: ["config_lock", "mercator_draft", "ami_apply"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/CPFNib.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/CPFNib_Behind.png", ultimateId: "pushed_to_dev",
		chargeArchetype: "Tactician",
		creatureDescription: "Somebody has to manage the settings around here",
	},

	"ressie": {
		// Heal tank - the slowest starter by far, but nearly unkillable.
		// Self Assess offers a brief self-repair window without letting battles stall out.
		id: "ressie",
		name: "Ressie",
		type: "Availability",
		base: { hp: 88, atk: 13, def: 17, spd: 8 },
		moveIds: ["essential_review", "validate_settings", "self_assess"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Ressie.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Ressie_Behind.png", ultimateId: "green_across_the_board",
		flipPlayer: true,
		chargeArchetype: "Endurance",
		creatureDescription: "Checks every box. Twice.",
	},


	// ===========================================================
	// WILD CREATURES
	// ===========================================================

	"redping": {
		// Speed sweeper - the fastest creature in the dex. Low bulk means it
		// needs to win quickly. Red Alert into back-to-back Ping Waves ends fights fast.
		id: "redping",
		name: "Redping",
		type: "Security",
		base: { hp: 70, atk: 16, def: 11, spd: 21 },
		moveIds: ["red_alert", "ping_wave", "system_flag"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Redping.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Redping_Behind.png",
		ultimateId: "all_monitors_red",
		chargeArchetype: "Momentum",
		creatureDescription: "If you see this, something has gone wrong",
	},

	"querion": {
		// Control - stats are intentionally average because its value is in
		// guaranteed Throttle + LockOn setup. The stats do enough to support the kit.
		id: "querion",
		name: "Querion",
		type: "Manageable",
		base: { hp: 80, atk: 13, def: 15, spd: 13 },
		moveIds: ["filter_query", "sort_by_threat", "data_pull"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Querion.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Querion_Behind.png",
		ultimateId: "select_from_enemy",
		chargeArchetype: "Tactician",
		creatureDescription: "The answer is in here somewhere. Probably.",
	},

	"owtage": {
		// Aggressive - high HP lets it absorb punishment while it spreads Contamination.
		// Emergency Patch sustains the attrition game; Cascade Failure is the opener.
		id: "owtage",
		name: "Owtage",
		type: "Availability",
		base: { hp: 86, atk: 17, def: 12, spd: 13 },
		moveIds: ["cascade_failure", "incident_report", "emergency_patch"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Owtage.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Owtage_Behind.png", ultimateId: "sev_1",
		chargeArchetype: "Chaos",
		creatureDescription: "Ow, my 'tage!",
	},

	"pclaw": {
		// Setup attacker - needs one Parallel Review turn to really threaten.
		// Balanced enough to take a hit while setting up; Hardware Request is the payoff.
		id: "pclaw",
		name: "Pclaw",
		type: "Performance",
		base: { hp: 80, atk: 15, def: 14, spd: 12 },
		moveIds: ["capacity_check", "parallel_review", "hardware_request"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Pclaw.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Pclaw_Behind.png", ultimateId: "over_capacity",
		chargeArchetype: "Brawler",
		creatureDescription: "The purrfect capacity companion",
	},

	"beecyerview": {
		// Heal tank (extreme) - highest HP in the dex, highest def, barely attacks.
		// HA Failover gives it a short sustain spike, but no longer lets it hard-stall fights.
		id: "beecyerview",
		name: "Beecyerview",
		type: "Availability",
		base: { hp: 86, atk: 13, def: 19, spd: 8 },
		moveIds: ["best_practice_audit", "compliance_check", "ha_failover"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Beecyerview.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Beecyerview_Behind.png", ultimateId: "dr_cutover",
		chargeArchetype: "Endurance",
		creatureDescription: "Have you done your DR cutover this quarter?",
	},

	"memlet": {
		// Setup attacker (risky) - similar role to Pclaw but leans riskier.
		// Overcommit is its nuke; Size Estimate sets up for it. Folds fast if it misses.
		id: "memlet",
		name: "Memlet",
		type: "Performance",
		base: { hp: 78, atk: 16, def: 12, spd: 14 },
		moveIds: ["memory_alloc", "overcommit", "size_estimate"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Memlet.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Memlet_Behind.png",
		ultimateId: "oom_killer",
		chargeArchetype: "Momentum",
		creatureDescription: "Just wants to be allocated.",
	},

	"orakle": {
		// Joke creature - intentionally weak across the board.
		// Misfire has the highest power in its kit and still has 50% hit chance.
		id: "orakle",
		name: "Orakle",
		type: "Manageable",
		base: { hp: 62, atk: 8, def: 9, spd: 7 },
		moveIds: ["ponder", "vague_prophecy", "misfire"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Orakle.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Orakle_Behind.png", ultimateId: "audit_season",
		chargeArchetype: "Chaos",
		creatureDescription: "C'mon... do something.",
	},



	"broadmawl": {
		// Joke - self-sabotaging attacker. Broadcom wolf. Hits hard but the licensing hurts.
		// vMotion is reliable; License Squeeze is brutal but guarantees self-Contamination.
		id: "broadmawl",
		name: "Broadmawl",
		type: "Security",
		base: { hp: 78, atk: 19, def: 14, spd: 13 },
		moveIds: ["vmotion", "license_squeeze", "bundle_tax"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Broadmawl.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Broadmawl_Behind.png",
		flipEnemy: true,
		creatureDescription: "It used to be the best. Then the acquisition happened.",
		ultimateId: "subscription_model",
		chargeArchetype: "Chaos",
	},

	"fosslaix": {
		// Joke - unkillable legacy fossil. Nobody remembers who deployed it.
		// Legacy Hold slows enemies briefly; Power Cycle buys time without dragging fights out.
		id: "fosslaix",
		name: "Fosslaix",
		type: "Availability",
		base: { hp: 90, atk: 10, def: 19, spd: 6 },
		moveIds: ["legacy_hold", "mainframe_slam", "power_cycle"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Fosslaix.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Fosslaix_Behind.png",
		creatureDescription: "Nobody remembers who deployed it. It\'s still running.",
		ultimateId: "power_ha_crash",
		chargeArchetype: "Endurance",
	},

	"fyrd": {
		// Defensive reader - blue oni in tai chi stance. Reads and absorbs.
		// Buffer Absorb sustains; Seek Strike disrupts. The calm counterpart to Fywr.
		id: "fyrd",
		name: "Fyrd",
		type: "Performance",
		base: { hp: 74, atk: 12, def: 18, spd: 15 },
		moveIds: ["disk_read", "buffer_absorb", "seek_strike"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Fyrd.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Fyrd_Behind.png",
		creatureDescription: "Reads complete. Global Buffer is warm.",
		ultimateId: "latency_injection",
		chargeArchetype: "Endurance",
	},

	"fywr": {
		// Aggressive writer - red oni in karate stance. Writes with fury.
		// Write Burst primes Cascading; Flush Strike delivers. The fierce counterpart to Fyrd.
		id: "fywr",
		name: "Fywr",
		type: "Performance",
		base: { hp: 74, atk: 18, def: 12, spd: 15 },
		moveIds: ["block_write", "write_burst", "flush_strike"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Fywr.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Fywr_Behind.png",
		creatureDescription: "Write complete. WIJ emptied.",
		ultimateId: "halt_writes",
		chargeArchetype: "Momentum",
	},

	"gockensmith": {
		// Scientific benchmarker - wiry gecko in goggles and singed apron.
		// Ramp Run primes Cascading; Even Stripe delivers max throughput.
		id: "gockensmith",
		name: "Gockensmith",
		type: "Performance",
		base: { hp: 80, atk: 16, def: 13, spd: 15 },
		moveIds: ["datagen", "ramp_run", "even_stripe"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Gockensmith.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Gockensmith_Behind.png",
		creatureDescription: "The test isn\'t done until Gockensmith says it\'s done. It\'s never done.",
		ultimateId: "generate_pain",
		chargeArchetype: "Momentum",
	},

	"pixelwraith": {
		// Joke - unreliable Citrix speedster. Fast but everything misses.
		// Session Drop has power but 60% hit. Reconnect is the only reliable move.
		id: "pixelwraith",
		name: "Pixelwraith",
		type: "Manageable",
		base: { hp: 68, atk: 15, def: 11, spd: 18 },
		moveIds: ["session_drop", "screen_tear", "reconnect"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Pixelwraith.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Pixelwraith_Behind.png",
		creatureDescription: "Your session has been disconn-",
		ultimateId: "blue_screen_of_death",
		chargeArchetype: "Chaos",
	},

	"wridaemon": {
		// Relentless writer - fiery red imp. 8K blocks all day every day.
		// Cycle Burst primes Cascading; Thermal Spike delivers the burn.
		id: "wridaemon",
		name: "Wridaemon",
		type: "Manageable",
		base: { hp: 76, atk: 18, def: 12, spd: 17 },
		moveIds: ["block_flush", "thermal_spike", "cycle_burst"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Wridaemon.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Wridaemon_Behind.png",
		creatureDescription: "8K blocks. All day. Every day. The cycle never stops.",
		ultimateId: "cyclone_kick_240s",
		chargeArchetype: "Momentum",
	},



	"icebox": {
		// Data protection tank - maximum ransomware defense. Immutable cold storage.
		// On-Demand RO locks enemies down; Interface Disconnect air-gaps for healing;
		// Limited R/W chips away. Nearly unkillable.
		id: "icebox",
		name: "Icebox",
		type: "Availability",
		base: { hp: 82, atk: 14, def: 18, spd: 8 },
		moveIds: ["on_demand_ro", "interface_disconnect", "limited_rw"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Icebox.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Icebox_Behind.png",
		ultimateId: "safe_harbor",
		chargeArchetype: "Endurance",
		creatureDescription: "Your data is safe. Nobody\'s touching it. Not even you.",
	},

	"gaier": {
		// Defensive setup - fluffy duckling with one weird mechanical eye.
		// Assimilate Throttles; Adapt Protocol buffs up. The assimilation is working.
		id: "gaier",
		name: "Gaier",
		type: "Security",
		base: { hp: 72, atk: 14, def: 16, spd: 11 },
		moveIds: ["assimilate", "duckling_peck", "adapt_protocol"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Gaier.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Gaier_Behind.png", ultimateId: "phase_one",
		creatureDescription: "Just a normal duckling. Nothing to see here.",
	},

	"yik": {
		// Anonymous gossip - hunched yak doomscrolling on phone.
		// Incognito Mode buffs up; Downvote guarantees a short Throttle.
		id: "yik",
		name: "Yik",
		type: "Security",
		base: { hp: 70, atk: 13, def: 15, spd: 14 },
		moveIds: ["anonymous_post", "incognito_mode", "downvote"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Yik.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Yik_Behind.png",
		creatureDescription: "Currently typing...",
		ultimateId: "herd_mentality",
		chargeArchetype: "Chaos",
	},


	// ===========================================================
	// EVOLUTION CREATURES
	// ===========================================================

	"mercatador": {
		// Evolved CPFNib - Mercator's drafting process fully realized.
		// Still the slowest Security creature, but now its locked-down enemies get obliterated.
		// config_purge primes Cascading; force_apply delivers the payload.
		// Key changes from CPFNib: hp +7, atk +6 (the meaningful upgrade), def +3, spd +3
		id: "mercatador",
		name: "Mercatador",
		type: "Security",
		base: { hp: 85, atk: 19, def: 20, spd: 12 },
		moveIds: ["config_purge", "force_apply", "mercator_draft"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Mercatador.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Mercatador_Behind.png",		//        self-Cascading    22 dmg 85% + 40% Throttle  16 dmg reliable fallback
		ultimateId: "pushed_to_prod",
		chargeArchetype: "Tactician",
		creatureDescription: "The draft has been finalized. There will be no further revisions.",
		evolvesFrom: "cpfnib",
	},

	"redalert": {
		// Redalert - evolved Redping - incident severity escalation incarnate.
		// Yellow Alert establishes a long LockOn window; Orange and Red become
		// increasingly dangerous as soon as the target is acquired; Plaid is the finisher.
		id: "redalert",
		name: "Redalert",
		type: "Availability",
		base: { hp: 82, atk: 20, def: 13, spd: 22 },
		moveIds: ["yellow_alert", "orange_alert", "red_alert_evo"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Redalert.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Redalert_Behind.png",
		ultimateId: "plaid_alert",
		chargeArchetype: "Momentum",
		creatureDescription: "The dashboards have stopped asking nicely.",
		evolvesFrom: "redping",
	},

	"fortress": {
		// Fortress - evolved Ressie - colossal castle-bearing world turtle.
		// Lockdown shuts enemies down (guaranteed Throttle), Kernel Crush hits hard,
		// Bastion Wall sustains with 3-turn healing. A true tank + offense hybrid.
		id: "fortress",
		name: "Fortress",
		type: "Availability",
		base: { hp: 101, atk: 16, def: 18, spd: 12 },
		moveIds: ["lockdown", "kernel_crush", "bastion_wall"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Fortress.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Fortress_Behind.png", ultimateId: "castle_doctrine",
		chargeArchetype: "Endurance",
		creatureDescription: "The audit is over. The fortress stands. Nothing gets through.",
		evolvesFrom: "ressie",
	},

	"hootopsy": {
		// Hootopsy - evolved Owtage - smarter and faster. Swaps brute aggression for
		// precision: LockOn into boosted Full Report. Better spd means it acts sooner.
		// Key changes from Owtage: hp +4, atk +2, def +3, spd +4
		id: "hootopsy",
		name: "Hootopsy",
		type: "Availability",
		base: { hp: 90, atk: 19, def: 15, spd: 17 },
		moveIds: ["outage_scan", "post_mortem", "full_report"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Hootopsy.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Hootopsy_Behind.png", ultimateId: "blameless_post_mortem",
		chargeArchetype: "Endurance",
		creatureDescription: "Hoot. Hoot. RCA complete.",
		evolvesFrom: "owtage",
	},

	"normking": {
		// Evolved Normling - glass cannon perfected. Hits harder and faster.
		// Critical Threshold + LockOn Report is a devastating 2-turn combo.
		// Key changes from Normling: hp +8, atk +4, def +3, spd +2
		id: "normking",
		name: "Normking",
		type: "Performance",
		base: { hp: 83, atk: 22, def: 14, spd: 18 },
		moveIds: ["threshold_alert", "critical_threshold", "lock_on_report"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Normking.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Normking_Behind.png", ultimateId: "black_swan_event",
		chargeArchetype: "Brawler",
		creatureDescription: "Ready to find issues and chew bubblegum. And it's all out of bubblegum.",
		evolvesFrom: "normling",
	},

	"purrallel": {
		// Purrallel - evolved Pclaw - the planning paid off, the hardware arrived.
		// Full Capacity gives 3-turn Optimized; then Hardware Upgrade closes it.
		// Key changes from Pclaw: hp +6, atk +5, def +1, spd +3
		id: "purrallel",
		name: "Purrallel",
		type: "Performance",
		base: { hp: 86, atk: 20, def: 15, spd: 15 },
		moveIds: ["capacity_exceeded", "full_capacity", "hardware_upgrade"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Purrallel.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Purrallel_Behind.png", ultimateId: "parallel_deployment",
		chargeArchetype: "Brawler",
		creatureDescription: "All systems check. Purrallel ready for delivery.",
		evolvesFrom: "pclaw",
	},



	"yodel": {
		// Evolution of Yik - anonymous broadcaster. Standing bipedal yak in alpine costume.
		// Masquerade sets up LockOn; Yodel Blast delivers burst + Disruption.
		id: "yodel",
		name: "Yodel",
		type: "Security",
		base: { hp: 82, atk: 17, def: 17, spd: 15 },
		moveIds: ["echo_chamber", "masquerade", "yodel_blast"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Yodel.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Yodel_Behind.png",
		flipEnemy: true,
		creatureDescription: "THE ENTIRE MOUNTAIN HEARD THAT.",
		evolvesFrom: "yik",
		ultimateId: "gossip_vortex",
		chargeArchetype: "Momentum",
	},

	"swanborg": {
		// Evolution of Gaier - majestic swan being elegantly assimilated by Borg tech.
		// Collective Strike hits hard with Throttle; Optical Scan locks on; Elegant Override disrupts.
		id: "swanborg",
		name: "Swanborg",
		type: "Security",
		base: { hp: 84, atk: 20, def: 18, spd: 14 },
		moveIds: ["collective_strike", "optical_scan", "elegant_override"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Swanborg.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Swanborg_Behind.png", ultimateId: "red_upgrade",
		creatureDescription: "Resistance is futile. Also, I\'m gorgeous.",
		evolvesFrom: "gaier",
	},


	// ===========================================================
	// LEGENDARY CREATURES
	// (Stats at roughly evolution tier - special, not broken)
	// ===========================================================

	"dougtrio": {
		// Legendary Performance - not the tankiest or fastest, but the most consistent.
		// 3-turn Optimized into Tech Consult is a near-guaranteed win condition.
		id: "dougtrio",
		name: "Dougtrio",
		type: "Performance",
		base: { hp: 88, atk: 22, def: 15, spd: 19 },
		moveIds: ["rubber_duck_debug", "cloud_optimize", "tech_consult"],
		ultimateId: "architecture_review",
		chargeArchetype: "Brawler",
		creatureDescription: "Now there's 3 Dougs to answer your cloud questions!",
	},

	"prodle": {
		// Legendary Manageable - perfectly balanced, which is appropriate for a puzzle game.
		// Process of Elimination + Yellow Tile + Green Tile is a methodical shutdown.
		id: "prodle",
		name: "Prodle",
		type: "Manageable",
		base: { hp: 85, atk: 15, def: 16, spd: 16 },
		moveIds: ["process_of_elimination", "yellow_tile", "green_tile"],

		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Prodle.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Prodle_Behind.png", ultimateId: "solved_in_1",
		chargeArchetype: "Chaos",
		creatureDescription: "Figured out the word yet?",
	},


	"amazonite": {
		// Legendary Performance - AWS stone lion. IaaS attacker.
		// EC2 Burst chips reliably; S3 Dump hits hard; VPC Lockdown buffs up.
		id: "amazonite",
		name: "Amazonite",
		type: "Availability",
		base: { hp: 80, atk: 16, def: 14, spd: 14 },
		moveIds: ["ec2_burst", "s3_dump", "vpc_lockdown"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Amazonite.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Amazonite_Behind.png",
		creatureDescription: "Ancient mineral guardian of the AWS cloud",
		ultimateId: "dynamo_punch",
		chargeArchetype: "Brawler",
	},

	"azurite": {
		// Legendary Security - Azure IaaS tank. Slow but extremely resilient.
		// VNet Fence locks enemies down; Ultra Disk Hurl chips reliably; IOPS Burst closes.
		id: "azurite",
		name: "Azurite",
		type: "Security",
		base: { hp: 84, atk: 13, def: 18, spd: 9 },
		moveIds: ["ultra_disk_hurl", "vnet_fence", "iops_burst"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Azurite.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Azurite_Behind.png",
		ultimateId: "subscription_tier_enterprise",
		chargeArchetype: "Tactician",
		creatureDescription: "Premium tier. Premium damage.",
	},

	"cobaltite": {
		// Legendary Evolution of Azurite - three-headed crystal cerberus.
		// Ampere Override primes Cascading; Egress Toll chips + Contaminates; VM Limit Crush nukes.
		id: "cobaltite",
		name: "Cobaltite",
		type: "Security",
		base: { hp: 92, atk: 19, def: 21, spd: 12 },
		moveIds: ["ampere_override", "egress_toll", "vm_limit_crush"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Cobaltite.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Cobaltite_Behind.png",
		creatureDescription: "Unlike some Azure regions, this portalmon has three AZs.",
		evolvesFrom: "azurite",
		ultimateId: "multi_region_failover",
		chargeArchetype: "Tactician",
	},

	"gravitonite": {
		// Legendary Evolution of Amazonite - three-headed orange stone hydra.
		// Graviton Crunch primes Cascading; Egress Drain chips + Contaminates; Provisioned IOPS nukes.
		id: "gravitonite",
		name: "Gravitonite",
		type: "Performance",
		base: { hp: 88, atk: 22, def: 16, spd: 15 },
		moveIds: ["graviton_crunch", "egress_drain", "provisioned_iops"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Gravitonite.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Gravitonite_Behind.png",
		creatureDescription: "They say that one day, all production ODBs will run off Gravitonite's power.",
		evolvesFrom: "amazonite",
		ultimateId: "nitro_charge",
		chargeArchetype: "Brawler",
	},

	// ===========================================================
	// GEN 1 POKEMON (GLaDOS cross-dimensional imports)
	// Imported from POKEMON_GEN_1.DB. Unlocked for random encounters after GLaDOS is defeated.
	// ===========================================================

	"venusaur": {
		id: "venusaur",
		name: "Venusaur",
		type: "Availability",
		base: { hp: 95, atk: 14, def: 18, spd: 12 },
		moveIds: ["vine_whip", "sleep_powder", "leech_seed"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Venusaur.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Venusaur_Behind.png",
		ultimateId: "solar_beam",
		chargeArchetype: "Endurance",
		portalUnlock: "after_champion_defeated",
		creatureDescription: "Imported from another dimension. Your SLA does not cover this.",
	},

	"blastoise": {
		id: "blastoise",
		name: "Blastoise",
		type: "Security",
		base: { hp: 90, atk: 16, def: 16, spd: 14 },
		moveIds: ["water_pulse", "iron_defense", "hydro_pump"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Blastoise.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Blastoise_Behind.png",
		ultimateId: "hydro_cannon",
		chargeArchetype: "Tactician",
		portalUnlock: "after_champion_defeated",
		creatureDescription: "Dual water cannons. Cross-dimensional firepower.",
	},

	"charizard": {
		id: "charizard",
		name: "Charizard",
		type: "Performance",
		base: { hp: 82, atk: 22, def: 12, spd: 18 },
		moveIds: ["flamethrower", "dragon_dance", "fire_blast"],
		portraitImage: "/Areas/Portalmon/Content/Images/Portalmon/Charizard.png",
		behindImage: "/Areas/Portalmon/Content/Images/Portalmon/Charizard_Behind.png",
		ultimateId: "blast_burn",
		chargeArchetype: "Brawler",
		portalUnlock: "after_champion_defeated",
		creatureDescription: "Fire-breathing dragon vs your database audit tortoise. Seems fair.",
	},
};
