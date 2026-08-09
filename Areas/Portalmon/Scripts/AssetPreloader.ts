/**
 * Warms images before the UI binds them to a visible `<img>`.
 *
 * Battle art is authored as standalone PNGs served by the host, so the browser
 * does not start fetching a trainer or creature sprite until Knockout writes
 * its `src`. That happens at the moment the battlefield is revealed, which is
 * exactly when a fetch plus decode is most visible as pop-in.
 *
 * A battle transition runs for roughly two seconds of pure animation before it
 * uncovers anything. That is free time, so callers hand their sources to
 * `preloadImages` when the transition starts and await the returned promise
 * before the reveal.
 *
 * Two deliberate behaviours:
 *
 * - Nothing here ever rejects. Creature and trainer artwork is intentionally
 *   incomplete in this checkout, and a missing PNG must not stall or break a
 *   battle that would otherwise start fine.
 * - `preloadImages` is capped by a timeout. A slow connection should shorten
 *   the benefit, never stretch the transition.
 */

/**
 * Resolved-once promise per URL. Repeat requests for the same art — the same
 * gym leader, the same species — reuse the first fetch instead of issuing
 * another one.
 */
const inFlight: Map<string, Promise<void>> = new Map();

/**
 * Decoded images are retained so the browser keeps the decoded bitmap rather
 * than dropping it once the element would otherwise be collectable. The set is
 * bounded by the number of distinct art files the game ships.
 */
const retained: Set<HTMLImageElement> = new Set();

/** Default ceiling on how long a reveal will wait for its art. */
const PRELOAD_TIMEOUT_MS = 1500;

/**
 * Fetches and decodes one image. Resolves on success, on error, and on an
 * unsupported `decode()`; the caller only cares that waiting is over.
 */
export function preloadImage(source: string): Promise<void>
{
	if (!source) return Promise.resolve();

	const existing = inFlight.get(source);
	if (existing) return existing;

	const pending = new Promise<void>(resolve =>
	{
		const image = new Image();
		retained.add(image);

		const settle = (): void => resolve();

		// decode() reports when the bitmap is ready to paint, which load alone
		// does not. Older engines without it fall back to the load event.
		if (typeof image.decode === "function")
		{
			image.addEventListener("error", settle, { once: true });
			image.src = source;
			image.decode().then(settle, settle);
			return;
		}

		image.addEventListener("load", settle, { once: true });
		image.addEventListener("error", settle, { once: true });
		image.src = source;
	});

	inFlight.set(source, pending);
	return pending;
}

/**
 * Warms every source and resolves once they are all ready or the timeout
 * elapses, whichever comes first. Empty and duplicate entries are ignored.
 */
export function preloadImages(sources: readonly (string | undefined | null)[], timeoutMs: number = PRELOAD_TIMEOUT_MS): Promise<void>
{
	const unique = Array.from(new Set(sources.filter((source): source is string => !!source)));
	if (unique.length === 0) return Promise.resolve();

	const all = Promise.all(unique.map(preloadImage)).then(() => undefined);
	const capped = new Promise<void>(resolve => window.setTimeout(resolve, timeoutMs));
	return Promise.race([all, capped]);
}
