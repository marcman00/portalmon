// ============================================================
// TYPES
// Four types form a cycle for type effectiveness:
//   Availability → Performance → Manageable → Security → Availability
// ============================================================
export type PortalKombatType = "Availability" | "Performance" | "Security" | "Manageable";

// ============================================================
// TYPE CHART
// Maps attacker type → { defenderType → multiplier }.
// Omitted matchups are neutral (1×).
// Usage: TypeChart[moveType][targetType] ?? 1
// ============================================================
export const TypeChart: Record<PortalKombatType, Partial<Record<PortalKombatType, number>>> = {
	//              vs Avail  vs Perf   vs Manageable  vs Security
	"Availability": { "Performance": 2, "Security": 0.5 },
	"Performance": { "Manageable": 2, "Availability": 0.5 },
	"Security": { "Availability": 2, "Manageable": 0.5 },
	"Manageable": { "Security": 2, "Performance": 0.5 },
};
// Summary:
//  Availability is SUPER EFFECTIVE vs Performance   (can't perform if you're down)
//  Performance  is SUPER EFFECTIVE vs Manageable    (a fast-moving system is hard to manage)
//  Manageable   is SUPER EFFECTIVE vs Security      (good process closes security gaps)
//  Security     is SUPER EFFECTIVE vs Availability  (security incidents cause outages)

// ============================================================
// STATUS EFFECTS
// To add a new status effect:
//   1. Add the name to the StatusEffect union below
//   2. Add a player-facing description to StatusEffectDescriptions
//   3. Handle its behavior in CombatManager.processStatusEffects()
// ============================================================
export type StatusEffect =
	// Negative effects (applied to enemy)
	"Throttled" | "Contaminated" | "Disrupted" |
	// Positive effects (applied to self)
	"Optimized" | "SelfHealing" | "LockOn" | "Cascading";

/** Shown in tooltips when hovering status badges during battle. */
export const StatusEffectDescriptions: Record<StatusEffect, string> = {
	// Negative
	Contaminated: "System compromised (dmg/turn)",
	Throttled: "All systems rate-limited (↓ atk, def, spd)",
	Disrupted: "System disrupted (↓↓ next move accuracy)",   // NEW: next attack is much more likely to miss

	// Positive
	SelfHealing: "Auto-repair enabled (heal/turn)",
	Optimized: "Operating at peak efficiency (↑ atk, def, spd)",
	LockOn: "Target acquired (↑↑ accuracy, ↑ damage)",
	Cascading: "Cascading effect active (↑↑ next move power)", // NEW: next move hits significantly harder
};

// ============================================================
// IMPLEMENTATION NOTES FOR NEW STATUS EFFECTS (CombatManager)
//
// Disrupted (1 turn, applied to enemy):
//   - When the Disrupted creature attacks, multiply its hitChance by 0.4
//     (e.g. a 100% hit move becomes 40%).
//   - Consume (remove) the effect after the affected move resolves.
//
// Cascading (1 turn, applied to self):
//   - When the Cascading creature attacks next turn, multiply move power by 1.75.
//   - Consume (remove) the effect after the boosted move resolves.
//   - Does not stack; applying it again resets the duration.
// ============================================================