import { create } from "zustand";

import { keepOnHotReload } from "#/lib/hot";

/**
 * Whether the browser can draw the 3D view at all, and whether it stopped
 * (ADR-0145). Without WebGL 2 (hardware acceleration off, a locked-down
 * browser, an old one) three.js can't start, so the editor shows a screen
 * saying how to fix it instead of the crash screen. A view that loses its
 * WebGL context while open (the graphics driver reset, memory ran short)
 * stops drawing for good, so a bar offers to reload.
 */

let canDraw: boolean | null = null;

/** Whether this browser gives the page a WebGL 2 context: checked once, then remembered. */
export const canDraw3d = (): boolean => {
	if (canDraw !== null) {
		return canDraw;
	}
	try {
		const canvas = document.createElement("canvas");
		const gl = canvas.getContext("webgl2");
		canDraw = gl !== null;
		// Given back at once: only the view's own canvas needs one.
		gl?.getExtension("WEBGL_lose_context")?.loseContext();
	} catch {
		canDraw = false;
	}
	return canDraw;
};

/** Whether the view's WebGL context was lost while it was open; the bar over the view says so. */
export const useDrawingLost = keepOnHotReload("drawingLost", () =>
	create<{ isLost: boolean }>(() => ({ isLost: false })),
);

/** Watch the view's canvas for a lost (and restored) context. Returns a function that stops. */
export const watchForLostDrawing = (canvas: HTMLCanvasElement) => {
	const lost = () => useDrawingLost.setState({ isLost: true });
	const restored = () => useDrawingLost.setState({ isLost: false });
	canvas.addEventListener("webglcontextlost", lost);
	canvas.addEventListener("webglcontextrestored", restored);
	return () => {
		canvas.removeEventListener("webglcontextlost", lost);
		canvas.removeEventListener("webglcontextrestored", restored);
	};
};
