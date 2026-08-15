/**
 * Opt-in frame profiler for the overworld render loop.
 *
 * The game runs inside two very different hosts: the standalone Vite harness,
 * where the page contains almost nothing but the game, and the production site,
 * where it shares a document with the rest of a real application. Identical game
 * code can feel very different in those two places, and the difference is never
 * visible from inside the game. This records the handful of numbers that
 * distinguish the possible causes so the two hosts can be compared directly.
 *
 * Everything here is inert unless explicitly enabled, because the profiler must
 * never be part of what it is measuring:
 *
 *     ?perf=1        collect samples, report on demand
 *     ?perf=hud      collect samples and show the on-screen overlay
 *     localStorage.setItem("portalmon:perf", "1" | "hud")
 *
 * Read the results from the console with portalmonPerf.report(), which returns a
 * plain object and also logs it. Run it on both hosts and diff the two blobs.
 */

const SAMPLE_CAPACITY = 600;
const HUD_UPDATE_MS = 500;
/** A frame is late when it misses its deadline by half a frame at 60Hz. */
const LATE_FRAME_MS = 25;

interface LongTaskTally
{
	count: number;
	totalMs: number;
	maxMs: number;
	/** Long task attribution container names, tallied. Names the thief. */
	containers: Record<string, number>;
}

export interface PerfReport
{
	mode: string;
	sampleCount: number;
	/** Wall-clock gap between consecutive drawn frames. */
	frameIntervalMs: Stats;
	/** Time spent inside draw() itself. */
	drawMs: Stats;
	/**
	 * Time from the end of our frame callback until the main thread is free
	 * again. Our callback returns, and the browser then does style recalculation,
	 * layout, paint, and compositing for the whole document before it can run the
	 * next task. That work is invisible to drawMs but is charged to the same
	 * frame budget, and it scales with the host page rather than with the game.
	 *
	 * drawMs equal across hosts while this diverges means the cost is the browser
	 * rendering the surrounding page, not the game rendering itself.
	 */
	postFrameMs: Stats;
	lateFrames: number;
	lateFrameRatio: number;
	/**
	 * Share of loop iterations that took the slow idle path instead of
	 * re-arming on requestAnimationFrame. Anything above ~0 while the player is
	 * walking means the loop is running on a 200ms timer, not at display rate.
	 */
	idleFrameRatio: number;
	/** Keypress to the end of the next drawn frame, for accepted presses. */
	inputLatencyMs: Stats;
	acceptedInputs: number;
	/** Presses the movement gate refused. These never produce a frame at all. */
	droppedInputs: number;
	longTasks: LongTaskTally;
	environment: Record<string, unknown>;
}

interface Stats
{
	/**
	 * The fastest sample. On a frame interval this is the display's refresh
	 * ceiling, which is the only way to tell "this monitor is 60Hz" apart from
	 * "this page is rendering at half its monitor's rate".
	 */
	min: number;
	p50: number;
	p95: number;
	max: number;
	mean: number;
}

const EMPTY_STATS: Stats = { min: 0, p50: 0, p95: 0, max: 0, mean: 0 };

function summarize(samples: number[]): Stats
{
	if (samples.length === 0) return { ...EMPTY_STATS };
	const sorted = samples.slice().sort((left, right) => left - right);
	const at = (fraction: number): number =>
		Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] * 100) / 100;
	const total = sorted.reduce((sum, value) => sum + value, 0);
	return {
		min: Math.round(sorted[0] * 100) / 100,
		p50: at(0.5),
		p95: at(0.95),
		max: Math.round(sorted[sorted.length - 1] * 100) / 100,
		mean: Math.round((total / sorted.length) * 100) / 100,
	};
}

/** Fixed-size ring so a long session cannot grow the profiler's own heap. */
class Ring
{
	private readonly values: number[] = [];
	private next: number = 0;

	public push(value: number): void
	{
		if (this.values.length < SAMPLE_CAPACITY)
		{
			this.values.push(value);
			return;
		}
		this.values[this.next] = value;
		this.next = (this.next + 1) % SAMPLE_CAPACITY;
	}

	public snapshot(): number[]
	{
		return this.values;
	}

	public clear(): void
	{
		this.values.length = 0;
		this.next = 0;
	}

	public get length(): number
	{
		return this.values.length;
	}
}

class PerfProbe
{
	/** Checked on the hot path, so it is a plain boolean field, not a getter. */
	public readonly enabled: boolean;
	public readonly showHud: boolean;
	/**
	 * The canvas dataset mirror is off even while profiling, because it writes
	 * four attributes per frame during movement and every MutationObserver on
	 * the host page runs against each one. A profiler that provokes the effect
	 * it is measuring is worse than no profiler. Opt in with ?perf=debug when
	 * the dataset itself is what you want to inspect.
	 */
	public readonly publishDataset: boolean;

	private readonly frameIntervals: Ring = new Ring();
	private readonly drawTimes: Ring = new Ring();
	private readonly postFrameTimes: Ring = new Ring();
	private readonly inputLatencies: Ring = new Ring();
	private readonly longTasks: LongTaskTally = { count: 0, totalMs: 0, maxMs: 0, containers: {} };

	private previousFrameAt: number | null = null;
	private drawnFrames: number = 0;
	private idleFrames: number = 0;
	private lateFrames: number = 0;
	private pendingInputAt: number | null = null;
	private postFrameChannel: MessageChannel | null = null;
	private postFrameStartedAt: number | null = null;
	private acceptedInputs: number = 0;
	private droppedInputs: number = 0;
	private lastCanvas: HTMLCanvasElement | null = null;

	private hudElement: HTMLElement | null = null;
	private hudTimer: number | null = null;

	constructor()
	{
		const mode = this.resolveMode();
		this.enabled = mode !== "off";
		this.showHud = mode === "hud" || mode === "debug";
		this.publishDataset = mode === "debug";
		if (!this.enabled) return;

		this.observeLongTasks();
		this.openPostFrameChannel();
		this.exposeConsoleApi();
		if (this.showHud) this.startHud();
	}

	private resolveMode(): string
	{
		try
		{
			const fromQuery = new URLSearchParams(window.location.search).get("perf");
			if (fromQuery === "debug") return "debug";
			if (fromQuery === "hud") return "hud";
			if (fromQuery === "1") return "on";
			const stored = window.localStorage.getItem("portalmon:perf");
			if (stored === "debug") return "debug";
			if (stored === "hud") return "hud";
			if (stored === "1") return "on";
		}
		catch
		{
			// Sandboxed storage or an exotic URL must not break the game.
		}
		return "off";
	}

	/**
	 * Long tasks are the only signal that can distinguish "our draw is slow" from
	 * "something else on the host page is holding the main thread". Attribution
	 * carries the containing iframe/embed when the culprit is third-party.
	 */
	private observeLongTasks(): void
	{
		if (typeof PerformanceObserver === "undefined") return;
		try
		{
			const observer = new PerformanceObserver(list =>
			{
				for (const entry of list.getEntries())
				{
					this.longTasks.count++;
					this.longTasks.totalMs += entry.duration;
					this.longTasks.maxMs = Math.max(this.longTasks.maxMs, entry.duration);
					const attributions = (entry as unknown as { attribution?: Array<{ containerName?: string; containerSrc?: string; containerType?: string }> }).attribution ?? [];
					for (const attribution of attributions)
					{
						const label = attribution.containerName
							|| attribution.containerSrc
							|| attribution.containerType
							|| "window";
						this.longTasks.containers[label] = (this.longTasks.containers[label] ?? 0) + 1;
					}
				}
			});
			observer.observe({ type: "longtask", buffered: true } as PerformanceObserverInit);
		}
		catch
		{
			// Safari and older Firefox do not implement longtask; the rest still works.
		}
	}

	/**
	 * A message posted from inside a frame is delivered after the browser has
	 * finished that frame's rendering steps, so the round trip measures the work
	 * the page costs beyond our own drawing.
	 */
	private openPostFrameChannel(): void
	{
		if (typeof MessageChannel === "undefined") return;
		const channel = new MessageChannel();
		channel.port1.onmessage = (): void =>
		{
			if (this.postFrameStartedAt === null) return;
			this.postFrameTimes.push(performance.now() - this.postFrameStartedAt);
			this.postFrameStartedAt = null;
		};
		channel.port1.start();
		this.postFrameChannel = channel;
	}

	/** Called once per loop iteration, drawn or not. */
	public recordFrame(now: number, drew: boolean): void
	{
		// One measurement in flight at a time, so a stalled frame cannot queue
		// a backlog of messages that then all resolve against stale timestamps.
		if (drew && this.postFrameChannel && this.postFrameStartedAt === null)
		{
			this.postFrameStartedAt = performance.now();
			this.postFrameChannel.port2.postMessage(0);
		}
		if (!drew)
		{
			this.idleFrames++;
			this.previousFrameAt = null;
			return;
		}
		this.drawnFrames++;
		if (this.previousFrameAt !== null)
		{
			const interval = now - this.previousFrameAt;
			this.frameIntervals.push(interval);
			if (interval > LATE_FRAME_MS) this.lateFrames++;
		}
		this.previousFrameAt = now;

		if (this.pendingInputAt !== null)
		{
			this.inputLatencies.push(performance.now() - this.pendingInputAt);
			this.pendingInputAt = null;
		}
	}

	/** Called with the measured cost of draw() and the canvas it drew into. */
	public recordDraw(durationMs: number, canvas: HTMLCanvasElement): void
	{
		this.drawTimes.push(durationMs);
		this.lastCanvas = canvas;
	}

	/**
	 * Called for every movement press, whether or not the game accepted it.
	 *
	 * A press the movement gate rejects produces no frame to measure, so timing
	 * alone would look healthiest exactly when the game feels worst. Dropped
	 * presses are counted separately: "pressed 40 times, 12 never moved anyone"
	 * explains unresponsiveness with no frame-rate story at all.
	 */
	public markInput(accepted: boolean): void
	{
		if (!accepted)
		{
			this.droppedInputs++;
			return;
		}
		this.acceptedInputs++;
		if (this.pendingInputAt === null) this.pendingInputAt = performance.now();
	}

	/**
	 * One-time environment capture. This is the actual point of the exercise: the
	 * frame numbers say which branch the problem is in, and these say why the two
	 * hosts differ.
	 */
	private describeEnvironment(): Record<string, unknown>
	{
		const canvas = this.lastCanvas ?? (document.getElementById("pk-overworld-canvas") as HTMLCanvasElement | null);
		const rect = canvas?.getBoundingClientRect();
		const globals = window as unknown as { ko?: { version?: string }; jQuery?: { fn?: { jquery?: string } } };
		return {
			userAgent: navigator.userAgent,
			devicePixelRatio: window.devicePixelRatio,
			hardwareConcurrency: navigator.hardwareConcurrency,
			deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
			viewport: `${window.innerWidth}x${window.innerHeight}`,
			// Backing store versus painted size. A non-integer or very large
			// upscale factor makes every frame cost more to rasterize, and it is
			// set entirely by the host page's CSS around the shell.
			canvasBackingStore: canvas ? `${canvas.width}x${canvas.height}` : null,
			canvasPaintedSize: rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : null,
			canvasUpscale: rect && canvas?.width
				? Math.round((rect.width / canvas.width) * 1000) / 1000
				: null,
			canvasImageRendering: canvas ? getComputedStyle(canvas).getPropertyValue("image-rendering") : null,
			// Host page weight. Style recalculation and MutationObserver fan-out
			// both scale with these, and neither exists in the local harness.
			domNodeCount: document.querySelectorAll("*").length,
			styleSheetCount: document.styleSheets.length,
			// CSS animations the host page is running behind the game. Each one
			// is compositor or main-thread work the local harness never pays.
			runningAnimations: this.countRunningAnimations(),
			iframeCount: document.querySelectorAll("iframe").length,
			knockoutVersion: globals.ko?.version ?? null,
			jqueryVersion: globals.jQuery?.fn?.jquery ?? null,
			reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
			pageVisibility: document.visibilityState,
		};
	}

	private countRunningAnimations(): number | null
	{
		const getAnimations = (document as unknown as { getAnimations?: () => unknown[] }).getAnimations;
		if (typeof getAnimations !== "function") return null;
		return getAnimations.call(document).length;
	}

	public report(): PerfReport
	{
		const loopIterations = this.drawnFrames + this.idleFrames;
		const result: PerfReport = {
			mode: this.publishDataset ? "debug" : (this.showHud ? "hud" : "on"),
			sampleCount: this.frameIntervals.length,
			frameIntervalMs: summarize(this.frameIntervals.snapshot()),
			drawMs: summarize(this.drawTimes.snapshot()),
			postFrameMs: summarize(this.postFrameTimes.snapshot()),
			lateFrames: this.lateFrames,
			lateFrameRatio: this.drawnFrames > 0
				? Math.round((this.lateFrames / this.drawnFrames) * 1000) / 1000
				: 0,
			idleFrameRatio: loopIterations > 0
				? Math.round((this.idleFrames / loopIterations) * 1000) / 1000
				: 0,
			inputLatencyMs: summarize(this.inputLatencies.snapshot()),
			acceptedInputs: this.acceptedInputs,
			droppedInputs: this.droppedInputs,
			longTasks: {
				count: this.longTasks.count,
				totalMs: Math.round(this.longTasks.totalMs),
				maxMs: Math.round(this.longTasks.maxMs),
				containers: { ...this.longTasks.containers },
			},
			environment: this.describeEnvironment(),
		};
		console.log("[portalmon perf]", result);
		return result;
	}

	public reset(): void
	{
		this.frameIntervals.clear();
		this.drawTimes.clear();
		this.postFrameTimes.clear();
		this.inputLatencies.clear();
		this.previousFrameAt = null;
		this.postFrameStartedAt = null;
		this.drawnFrames = 0;
		this.idleFrames = 0;
		this.lateFrames = 0;
		this.pendingInputAt = null;
		this.acceptedInputs = 0;
		this.droppedInputs = 0;
		this.longTasks.count = 0;
		this.longTasks.totalMs = 0;
		this.longTasks.maxMs = 0;
		for (const key of Object.keys(this.longTasks.containers)) delete this.longTasks.containers[key];
	}

	private exposeConsoleApi(): void
	{
		(window as unknown as Record<string, unknown>).portalmonPerf = {
			report: () => this.report(),
			reset: () => this.reset(),
			copy: () => JSON.stringify(this.report(), null, 2),
			enable: (mode: string = "1") => window.localStorage.setItem("portalmon:perf", mode),
			disable: () => window.localStorage.removeItem("portalmon:perf"),
		};
		console.log("[portalmon perf] enabled. Walk around for ~15s, then run portalmonPerf.report().");
	}

	private startHud(): void
	{
		// The constructor runs at module evaluation. The local harness loads the
		// bundle as a deferred module so the body exists, but the production host
		// decides where its own script tag lands, and appending to a null body
		// there would throw out of the import and take the game with it.
		if (!document.body)
		{
			document.addEventListener("DOMContentLoaded", () => this.startHud(), { once: true });
			return;
		}
		const hud = document.createElement("div");
		hud.id = "portalmon-perf-hud";
		hud.setAttribute("style", [
			"position:fixed",
			"top:8px",
			"right:8px",
			"z-index:2147483647",
			"padding:6px 8px",
			"font:11px/1.35 monospace",
			"white-space:pre",
			"color:#9dff9d",
			"background:rgba(0,0,0,0.82)",
			"border:1px solid #2f6f2f",
			"border-radius:4px",
			"pointer-events:none",
		].join(";"));
		document.body.appendChild(hud);
		this.hudElement = hud;
		this.hudTimer = window.setInterval(() => this.updateHud(), HUD_UPDATE_MS);
	}

	private updateHud(): void
	{
		if (!this.hudElement) return;
		const intervals = summarize(this.frameIntervals.snapshot());
		const draws = summarize(this.drawTimes.snapshot());
		const postFrame = summarize(this.postFrameTimes.snapshot());
		const loopIterations = this.drawnFrames + this.idleFrames;
		const idleRatio = loopIterations > 0 ? this.idleFrames / loopIterations : 0;
		const fps = intervals.p50 > 0 ? Math.round(1000 / intervals.p50) : 0;
		this.hudElement.textContent = [
			`fps  ${fps}  (p50 ${intervals.p50}ms  best ${intervals.min}ms)`,
			`draw ${draws.p50}ms p95 ${draws.p95}ms max ${draws.max}ms`,
			`rest ${postFrame.p50}ms p95 ${postFrame.p95}ms`,
			`late ${this.lateFrames}/${this.drawnFrames}  idle ${(idleRatio * 100).toFixed(0)}%`,
			`longtask ${this.longTasks.count} (${Math.round(this.longTasks.totalMs)}ms)`,
			`input p95 ${summarize(this.inputLatencies.snapshot()).p95}ms  dropped ${this.droppedInputs}/${this.droppedInputs + this.acceptedInputs}`,
		].join("\n");
	}

	public dispose(): void
	{
		if (this.hudTimer !== null) window.clearInterval(this.hudTimer);
		this.hudTimer = null;
		this.hudElement?.remove();
		this.hudElement = null;
	}
}

export const perfProbe = new PerfProbe();
