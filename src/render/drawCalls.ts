/**
 * Development only: counting the view's draw calls, every one, as the bench
 * script does (scripts/bench.mjs). three's own count (`renderer.info`) is per
 * render pass, and the effects composer renders several a frame; this counts
 * at WebGL, multi-draws (BatchedMesh, ADR-0086) once each. Put in on first use,
 * so the app pays nothing until then.
 */

const counted = { draws: 0, installed: false };

const DRAWS = [
	"drawArrays",
	"drawElements",
	"drawArraysInstanced",
	"drawElementsInstanced",
	"drawRangeElements",
] as const;

/** Counts every draw from now on: WebGL2's own, and the multi-draw extension's. */
const install = (context: WebGL2RenderingContext) => {
	if (counted.installed) {
		return;
	}
	counted.installed = true;
	const prototype = WebGL2RenderingContext.prototype as unknown as Record<
		string,
		(...rest: unknown[]) => unknown
	>;
	for (const name of DRAWS) {
		const original = prototype[name];
		prototype[name] = function (this: unknown, ...rest: unknown[]) {
			counted.draws += 1;
			return original.apply(this, rest);
		};
	}
	// three asked for the extension when it started: the same object, its functions wrapped.
	const multiDraw = context.getExtension("WEBGL_multi_draw") as Record<string, unknown> | null;
	for (const name of Object.keys(Object.getPrototypeOf(multiDraw ?? {}))) {
		const original = multiDraw?.[name];
		if (multiDraw && name.startsWith("multiDraw") && typeof original === "function") {
			multiDraw[name] = (...rest: unknown[]) => {
				counted.draws += 1;
				return original.apply(multiDraw, rest);
			};
		}
	}
};

const nextFrame = () => new Promise((done) => requestAnimationFrame(done));

/** Draw calls per frame, averaged over the next `frames` frames. */
export const drawCallsPerFrame = async (context: WebGL2RenderingContext, frames = 20) => {
	install(context);
	await nextFrame();
	const from = counted.draws;
	for (let i = 0; i < frames; i++) {
		await nextFrame();
	}
	return Math.round((counted.draws - from) / frames);
};
