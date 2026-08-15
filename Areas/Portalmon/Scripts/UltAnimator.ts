import { wait } from "./HelperFunctions";
import { UltimateDef, UltAnimCategory } from "./data/UltimateList";
import { PortalKombatType } from "./data/TypeList";

// ============================================================
// TYPE-COLORED FX PALETTE
// ============================================================

const TYPE_COLORS: Record<PortalKombatType, { primary: string; glow: string }> = {
	Performance: { primary: "#00cc66", glow: "rgba(0,204,102,0.6)" },
	Security:    { primary: "#ff3333", glow: "rgba(255,51,51,0.6)" },
	Availability:{ primary: "#0088ff", glow: "rgba(0,136,255,0.6)" },
	Manageable:  { primary: "#ffaa00", glow: "rgba(255,170,0,0.6)" },
};

// ============================================================
// REUSABLE FX TOOLKIT
// ============================================================

/**
 * Full-screen flash overlay (white or type-colored).
 * Creates a temporary div, fades it out, removes it.
 */
function screenFlash(color: string, duration: number = 200): void
{
	const el = document.createElement("div");
	el.style.cssText = `position:absolute;inset:0;z-index:8;background:${color};opacity:0.7;pointer-events:none;transition:opacity ${duration}ms ease-out;`;
	const battlefield = document.querySelector(".pk-battlefield");
	if (!battlefield) return;
	battlefield.appendChild(el);
	requestAnimationFrame(() =>
	{
		el.style.opacity = "0";
		setTimeout(() => el.remove(), duration);
	});
}

/**
 * Screen shake via CSS class on the battlefield container.
 */
async function screenShake(duration: number = 300): Promise<void>
{
	const bf = document.querySelector(".pk-battlefield") as HTMLElement | null;
	if (!bf) return;
	bf.classList.add("pk-ult-shake");
	await wait(duration);
	bf.classList.remove("pk-ult-shake");
}

/**
 * Sparkle burst at a position (CSS-only sparkle stars).
 * Creates N small cross-shaped elements that pop and fade.
 */
function sparkleBurst(targetSelector: string, color: string, count: number = 5): void
{
	const target = document.querySelector(targetSelector) as HTMLElement | null;
	if (!target) return;
	const rect = target.getBoundingClientRect();
	const parent = document.querySelector(".pk-battlefield") as HTMLElement | null;
	if (!parent) return;
	const parentRect = parent.getBoundingClientRect();

	for (let i = 0; i < count; i++)
	{
		const sparkle = document.createElement("div");
		sparkle.className = "pk-ult-sparkle";
		sparkle.style.cssText = `left:${rect.left - parentRect.left + rect.width * Math.random()}px;top:${rect.top - parentRect.top + rect.height * Math.random()}px;--sparkle-color:${color};animation-delay:${i * 0.08}s;`;
		parent.appendChild(sparkle);
		setTimeout(() => sparkle.remove(), 600 + i * 80);
	}
}

/**
 * Damage number popup that floats up and fades.
 */
function damageNumber(targetSelector: string, amount: number | string, color: string = "#fff"): void
{
	const target = document.querySelector(targetSelector) as HTMLElement | null;
	if (!target) return;
	const parent = document.querySelector(".pk-battlefield") as HTMLElement | null;
	if (!parent) return;
	const rect = target.getBoundingClientRect();
	const parentRect = parent.getBoundingClientRect();

	const el = document.createElement("div");
	el.className = "pk-ult-dmg-number";
	el.textContent = typeof amount === "number" ? `-${amount}` : amount;
	el.style.cssText = `left:${rect.left - parentRect.left + rect.width / 2}px;top:${rect.top - parentRect.top}px;color:${color};`;
	parent.appendChild(el);
	setTimeout(() => el.remove(), 1200);
}

/**
 * Ultimate name banner - center-screen monospace text with scale bounce.
 */
async function ultNameBanner(name: string, color: string, duration: number = 800): Promise<void>
{
	const parent = document.querySelector(".pk-battlefield") as HTMLElement | null;
	if (!parent) return;

	const el = document.createElement("div");
	el.className = "pk-ult-name-banner";
	el.textContent = name;
	el.style.setProperty("--ult-color", color);
	parent.appendChild(el);
	await wait(duration);
	el.classList.add("pk-ult-name-banner--fade");
	await wait(300);
	el.remove();
}

// ============================================================
// ULTIMATE ANIMATOR
// ============================================================

export class UltAnimator
{
	/**
	 * Plays the full ultimate animation sequence:
	 * 1. Universal activation (name banner + dramatic beat)
	 * 2. Category-specific animation
	 * 3. Cleanup
	 */
	public async playUltAnimation(ult: UltimateDef, isPlayer: boolean): Promise<void>
	{
		const typeColor = TYPE_COLORS[ult.type]?.primary ?? "#fff";
		const targetSelector = isPlayer ? ".pk-enemy-sprite" : ".pk-player-sprite";

		// --- UNIVERSAL ACTIVATION (0.5s "IT'S TIME") ---
		screenFlash(typeColor, 150);
		await wait(200);
		await ultNameBanner(ult.name, typeColor, 600);
		await wait(100);

		// --- CATEGORY-SPECIFIC ANIMATION ---
		switch (ult.animCategory)
		{
			case "single-hit":
				await this.animSingleHit(targetSelector, typeColor);
				break;
			case "multi-hit":
				await this.animMultiHit(targetSelector, typeColor, ult.hits);
				break;
			case "bench-spread":
				await this.animBenchSpread(targetSelector, typeColor);
				break;
			case "buff-heal":
				await this.animBuffHeal(isPlayer);
				break;
			case "defensive":
				await this.animDefensive(isPlayer, typeColor);
				break;
			case "status-control":
				await this.animStatusControl(targetSelector, typeColor);
				break;
			case "comedy":
				await this.animComedy(targetSelector, typeColor, ult);
				break;
		}
	}

	// --- SINGLE BIG HIT ---
	private async animSingleHit(targetSelector: string, color: string): Promise<void>
	{
		// Windup flash
		screenFlash("#fff", 100);
		await wait(150);
		// Impact
		screenFlash(color, 200);
		await screenShake(300);
		sparkleBurst(targetSelector, color, 8);
		await wait(200);
	}

	// --- MULTI-HIT ---
	private async animMultiHit(targetSelector: string, color: string, hits: number): Promise<void>
	{
		const displayHits = Math.min(hits, 8); // Cap visual hits for performance
		for (let i = 0; i < displayHits; i++)
		{
			screenFlash(color, 80);
			sparkleBurst(targetSelector, color, 2);
			await wait(Math.max(50, 120 - i * 10)); // Accelerate
		}
		// Final big impact
		screenFlash("#fff", 150);
		await screenShake(200);
		await wait(100);
	}

	// --- BENCH SPREAD ---
	private async animBenchSpread(targetSelector: string, color: string): Promise<void>
	{
		// Hit active
		screenFlash(color, 150);
		sparkleBurst(targetSelector, color, 5);
		await screenShake(200);
		await wait(200);
		// Hit bench (flash without specific target)
		screenFlash(color, 100);
		await wait(150);
		screenFlash(color, 100);
		await wait(100);
	}

	// --- BUFF/HEAL (warm, no violence) ---
	private async animBuffHeal(isPlayer: boolean): Promise<void>
	{
		const selfSelector = isPlayer ? ".pk-player-sprite" : ".pk-enemy-sprite";
		// Soft green glow
		screenFlash("rgba(0, 204, 102, 0.3)", 400);
		sparkleBurst(selfSelector, "#66ff99", 6);
		await wait(500);
		sparkleBurst(selfSelector, "#00cc66", 4);
		await wait(300);
	}

	// --- DEFENSIVE/REFLECT ---
	private async animDefensive(isPlayer: boolean, color: string): Promise<void>
	{
		const selfSelector = isPlayer ? ".pk-player-sprite" : ".pk-enemy-sprite";
		// Shield shimmer
		screenFlash(color, 100);
		sparkleBurst(selfSelector, color, 6);
		await wait(300);
		screenFlash("rgba(255,255,255,0.2)", 200);
		await wait(200);
	}

	// --- STATUS/CONTROL ---
	private async animStatusControl(targetSelector: string, color: string): Promise<void>
	{
		// Gesture flash
		screenFlash(color, 150);
		await wait(200);
		// Status icon effect (sparkle at target)
		sparkleBurst(targetSelector, color, 4);
		await wait(300);
	}

	// --- COMEDY (per-ult unique) ---
	private async animComedy(targetSelector: string, color: string, ult: UltimateDef): Promise<void>
	{
		if (ult.ultId === "audit_season")
		{
			// Rapid tiny flashes (simulating 50 paper cuts)
			for (let i = 0; i < 12; i++)
			{
				screenFlash(color, 40);
				await wait(Math.max(30, 80 - i * 5));
			}
			// Final big flash
			screenFlash("#fff", 200);
			await screenShake(400);
			await wait(200);
		}
		else if (ult.ultId === "blue_screen_of_death")
		{
			// Blue screen flash
			screenFlash("#0000AA", 500);
			await wait(600);
		}
		else if (ult.ultId === "solved_in_1")
		{
			// Green tile flash sequence
			const green = "#538d4e";
			screenFlash(green, 100);
			await wait(150);
			screenFlash(green, 100);
			await wait(150);
			screenFlash("#fff", 200);
			sparkleBurst(targetSelector, green, 8);
			await wait(300);
		}
		else
		{
			// Fallback: generic comedy (same as single hit)
			await this.animSingleHit(targetSelector, color);
		}
	}
}
