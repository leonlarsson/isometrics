/**
 * Render lab switches (prototype, docs/rendering-study): which effects to try,
 * from the page's `?fx=a,b,c`, and whether the dev server runs the app on
 * three's WebGPU build (`LAB_WEBGPU=1 pnpm dev`). No three.js here, so the
 * viewport can check them without loading the lab: with neither set, nothing
 * of the lab is loaded or drawn.
 */

declare const __LAB_WEBGPU__: boolean;

const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);

const FX = new Set((params.get("fx") ?? "").split(",").filter(Boolean));

/** Whether `?fx=` asks for this effect. */
export const labHas = (fx: string) => FX.has(fx);

/** Whether any lab effect is asked for. */
export const labActive = FX.size > 0;

/** The sky environment's strength (`?env=0.6`), for tuning it. */
export const labEnvStrength = Number(params.get("env") ?? 0.6);

/** The dev server was started with `LAB_WEBGPU=1`: `three` is the WebGPU build (vite.config.ts). */
export const labWebGpu = typeof __LAB_WEBGPU__ !== "undefined" && __LAB_WEBGPU__;
