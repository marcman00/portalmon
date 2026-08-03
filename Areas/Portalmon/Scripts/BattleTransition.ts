import { wait } from "./HelperFunctions";

export type TransitionColor = "blue" | "orange" | "gold" | "red";

const COLOR_RGB: Record<TransitionColor, [number, number, number]> = {
	blue:   [0, 136, 255],
	orange: [255, 136, 0],
	gold:   [240, 190, 50],
	red:    [220, 50, 50],
};

// ─── Vortex particle (round orb with glow — matches boot screen style) ───

class VortexParticle
{
	progress = 0;
	speed = 0;
	amplitude = 0;
	freq = 0;
	phase = 0;
	size = 0;
	yOff = 0;
	baseY = 0;

	constructor(private cw: number, private ch: number, private goingRight: boolean)
	{
		this.reset();
		this.progress = Math.random(); // stagger initial positions
	}

	reset(): void
	{
		this.progress = 0;
		this.speed = 0.003 + Math.random() * 0.005;
		this.amplitude = 8 + Math.random() * 20;
		this.freq = 1 + Math.random() * 2;
		this.phase = Math.random() * Math.PI * 2;
		this.size = 1.5 + Math.random() * 2.5;
		this.yOff = (Math.random() - 0.5) * 20;
		this.baseY = this.ch * (0.2 + Math.random() * 0.6);
	}

	update(): void
	{
		this.progress += this.speed;
		if (this.progress >= 1) this.reset();
	}

	draw(ctx: CanvasRenderingContext2D, r: number, g: number, b: number): void
	{
		const t = this.progress;
		const x = this.goingRight ? t * this.cw : (1 - t) * this.cw;
		const wave = Math.sin(t * Math.PI * this.freq + this.phase) * this.amplitude;
		const arc = -Math.sin(t * Math.PI) * 25; // upward arc in the middle
		const y = this.baseY + wave + arc + this.yOff;

		// Fade in/out at edges
		const alpha = Math.pow(Math.sin(t * Math.PI), 0.5) * 0.9;
		if (alpha <= 0.01) return;

		// Core orb (small solid circle)
		ctx.beginPath();
		ctx.arc(x, y, this.size, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
		ctx.fill();

		// Glow (larger faded circle)
		ctx.beginPath();
		ctx.arc(x, y, this.size * 2.5, 0, Math.PI * 2);
		ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.2})`;
		ctx.fill();
	}
}

// ─── Battle transition ─────────────────────────────────────────────

/**
 * Pokemon-style battle entrance transition with portal vortex effect.
 *
 *   idle → flash → vortex → iris-close → black → iris-open → intro → idle
 *
 * The `play(color, onBlack)` callback injects battle-start logic
 * at the right moment (while screen is fully black).
 */
export class BattleTransition
{
	/** Current transition phase — drives CSS class bindings */
	public phase = ko.observable<string>("idle");

	/** Portal color for flash tint and vortex particles */
	public portalColor = ko.observable<TransitionColor>("blue");

	private animFrameId = 0;
	private particles: VortexParticle[] = [];

	/**
	 * Plays the full transition sequence.
	 * @param color   Portal color (drives flash tint + vortex particles)
	 * @param onBlack Called during the black hold — start the battle here
	 */
	public async play(color: TransitionColor, onBlack: () => void): Promise<void>
	{
		this.portalColor(color);
		this.phase("flash");
		await wait(400);
		this.phase("vortex");
		this.startVortex();
		await wait(900);
		this.stopVortex();
		this.phase("iris-close");
		await wait(600);
		this.phase("black");
		onBlack();
		await wait(400);
		this.phase("iris-open");
		await wait(600);
		this.phase("intro");
		await wait(1400);
		this.phase("idle");
	}

	/** True while any transition phase is active */
	public isPlaying(): boolean
	{
		return this.phase() !== "idle";
	}

	// ─── Vortex canvas particle system ─────────────────────────────

	private startVortex(): void
	{
		const canvas = document.getElementById("pk-vortex-canvas") as HTMLCanvasElement | null;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Size canvas to match its CSS layout size
		canvas.width = canvas.offsetWidth;
		canvas.height = canvas.offsetHeight;

		const [r, g, b] = COLOR_RGB[this.portalColor()] ?? COLOR_RGB.blue;
		const goingRight = this.portalColor() === "blue" || this.portalColor() === "gold";
		this.particles = Array.from({ length: 28 }, () => new VortexParticle(canvas.width, canvas.height, goingRight));

		const draw = (): void =>
		{
			// Solid black background — fully covers the content beneath
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			for (const p of this.particles)
			{
				p.update();
				p.draw(ctx, r, g, b);
			}

			this.animFrameId = requestAnimationFrame(draw);
		};

		this.animFrameId = requestAnimationFrame(draw);
	}

	private stopVortex(): void
	{
		cancelAnimationFrame(this.animFrameId);
		const canvas = document.getElementById("pk-vortex-canvas") as HTMLCanvasElement | null;
		if (canvas)
		{
			const ctx = canvas.getContext("2d");
			if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
		}
	}
}
