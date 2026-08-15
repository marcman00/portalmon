/**
 * Ambient declarations for asset imports.
 *
 * Overworld map wrappers and TrainerList import tileset/sprite PNGs directly so
 * the bundler emits them and hands back a URL. Bundlers understand those imports;
 * the TypeScript compiler does not, and reports TS2307 without a declaration.
 *
 * The standalone Vite harness never surfaced this because esbuild transpiles
 * without type checking. Hosts that run a real type-check pass (webpack with
 * fork-ts-checker) do, so this file lives inside the Area and travels with it.
 *
 * Only *.png is declared - that is the only asset extension Portalmon modules
 * import. Keep it that way so this cannot collide with declarations the host
 * already provides for its own asset types (e.g. the @mdi/svg pipeline).
 */
declare module "*.png"
{
	const src: string;
	export default src;
}
