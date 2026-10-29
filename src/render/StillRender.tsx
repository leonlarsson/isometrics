import { addAfterEffect, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type * as THREE from "three";

import { useEditor } from "#/editor/store";

import { paintCards, type TCardPaints, takeCards } from "./paintCards";

/**
 * Render a picture (ADR-0084): one still of the view, drawn with the render's
 * graphics (RENDER_GRAPHICS: Ultra and beyond) at `smoothing` times its size a
 * side, then shrunk to it, which smooths every edge. The live canvas draws it:
 * shaped like the picture for a moment (same area, so the view frames about
 * the same), its pixel ratio raised, a few frames to settle, then taken and
 * put back as it was.
 */

/** Frames drawn at the picture's size before it's taken: new shaders, the bigger shadow map and the effects settle. */
const SETTLE_FRAMES = 30;
/** The renderer the live view draws with, once it's mounted: for its limits, and to take pictures. */
let liveRenderer: THREE.WebGLRenderer | null = null;

/**
 * How big a picture this graphics card can draw in one frame: the widest side it
 * draws (WebGL's renderbuffer and viewport limits), and how many pixels in all.
 * The browser gives a canvas at most 2²⁵ pixels, about 33.5 million (Chrome's
 * limit, whatever the card: 4K smoothed 2 times, 8K not at all). A browser
 * can't say how much memory a card has, so smaller cards (8192 a side or less)
 * are kept to less.
 */
export const drawingLimits = () => {
	const context = liveRenderer?.getContext();
	if (!context) {
		return { maxSide: 8192, maxPixels: 36_000_000 };
	}
	const viewport = context.getParameter(context.MAX_VIEWPORT_DIMS) as Int32Array;
	const maxSide = Math.min(
		context.getParameter(context.MAX_RENDERBUFFER_SIZE) as number,
		context.getParameter(context.MAX_TEXTURE_SIZE) as number,
		viewport[0],
		viewport[1],
	);
	const guess = maxSide > 8192 ? BROWSER_MAX_PIXELS : maxSide === 8192 ? 30_000_000 : 16_000_000;
	// Once a picture has found the browser's own limit, no more than that.
	return { maxSide, maxPixels: Math.min(guess, browserMaxPixels) };
};

/**
 * The most pixels the browser gave a canvas's drawing buffer, once a picture
 * asked for more: it makes a smaller buffer than asked for without a word, and
 * three.js, drawing at the size asked for, would then fill only a corner of it.
 */
let browserMaxPixels = Number.POSITIVE_INFINITY;

/** The most pixels a browser gives a canvas's drawing buffer (Chrome's 2²⁵). */
const BROWSER_MAX_PIXELS = 2 ** 25;

/** How many times over a picture of this size is drawn: as asked, as far as the card allows (drawingLimits). */
export const smoothingFor = (width: number, height: number, wanted: number) => {
	const { maxSide, maxPixels } = drawingLimits();
	return Math.max(
		1,
		Math.min(wanted, Math.sqrt(maxPixels / (width * height)), maxSide / width, maxSide / height),
	);
};

interface IStillRequest {
	width: number;
	height: number;
	smoothing: number;
	/** Leave the backdrop (and in perspective the sky) out: what isn't the world stays see-through. */
	transparent: boolean;
	/** The data cards and their leaders in the picture. */
	showsCards: boolean;
}

/** What's behind the canvas on screen (the backdrop, ADR-0070): a colour, a CSS gradient, or nothing. */
interface IBehind {
	color: string | null;
	gradient: { angle: number; from: string; to: string } | null;
}

/** The backdrop behind the canvas, read from the first element behind it that paints one. */
const behindOf = (canvas: HTMLCanvasElement): IBehind => {
	for (let element = canvas.parentElement; element; element = element.parentElement) {
		const style = getComputedStyle(element);
		const gradient =
			/linear-gradient\((-?[\d.]+)deg,\s*(rgba?\([^)]*\)),\s*(rgba?\([^)]*\))\)/.exec(
				style.backgroundImage,
			);
		if (gradient) {
			return {
				color: null,
				gradient: { angle: Number(gradient[1]), from: gradient[2], to: gradient[3] },
			};
		}
		const color = style.backgroundColor;
		if (color && color !== "transparent" && !/rgba\(.*,\s*0\)$/.test(color)) {
			return { color, gradient: null };
		}
	}
	return { color: null, gradient: null };
};

/** Paints the backdrop over a canvas of `width` × `height`, as CSS would (0° points up). */
const paintBehind = (
	context: CanvasRenderingContext2D,
	behind: IBehind,
	width: number,
	height: number,
) => {
	if (behind.gradient) {
		const turn = (behind.gradient.angle * Math.PI) / 180;
		const [dx, dy] = [Math.sin(turn), -Math.cos(turn)];
		const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
		const fill = context.createLinearGradient(
			width / 2 - dx * half,
			height / 2 - dy * half,
			width / 2 + dx * half,
			height / 2 + dy * half,
		);
		fill.addColorStop(0, behind.gradient.from);
		fill.addColorStop(1, behind.gradient.to);
		context.fillStyle = fill;
	} else if (behind.color) {
		context.fillStyle = behind.color;
	} else {
		return;
	}
	context.fillRect(0, 0, width, height);
};

/** The live view's canvas, once it's mounted: for the picture size "The view's size". */
let liveCanvas: HTMLCanvasElement | null = null;

/** The view's size in device pixels, as a picture of it would be. */
export const viewPixelSize = () => {
	const box = liveCanvas?.getBoundingClientRect();
	const ratio = window.devicePixelRatio || 1;
	return {
		width: Math.max(1, Math.round((box?.width ?? 1280) * ratio)),
		height: Math.max(1, Math.round((box?.height ?? 720) * ratio)),
	};
};

let waiting: { resolve: (picture: Blob) => void; reject: (error: Error) => void } | null = null;

type TStillResult = { picture: Blob } | { error: Error };

/**
 * Hands the picture (or the error) to whoever asked for it. Out here, not in the component: the
 * React Compiler treats a module's variables as unchanging inside components, and turned "keep
 * the promise, clear `waiting`, settle the promise" into settling `waiting` after clearing it, so
 * the picture never arrived (ADR-0093).
 */
const settle = (result: TStillResult) => {
	const promise = waiting;
	waiting = null;
	if ("picture" in result) {
		promise?.resolve(result.picture);
	} else {
		promise?.reject(result.error);
	}
};

/** Renders the view as a PNG of `width` × `height`; one at a time. */
export const renderStill = ({ width, height, smoothing, transparent, showsCards }: IStillRequest) =>
	new Promise<Blob>((resolve, reject) => {
		if (waiting) {
			reject(new Error("A picture is already rendering."));
			return;
		}
		waiting = { resolve, reject };
		useEditor.setState((s) => ({
			stillRender: {
				width,
				height,
				smoothing: smoothingFor(width, height, smoothing),
				nonce: (s.stillRender?.nonce ?? 0) + 1,
				pixelRatio: null,
				transparent,
				showsCards,
			},
		}));
	});

/** What's taken with the frame: the backdrop (null when left out), the cards, the canvas's CSS width. */
interface ITaken {
	behind: IBehind | null;
	cards: TCardPaints;
	canvasWidth: number;
}

/**
 * Shrinks a picture to `width` × `height`, halving at a time so a high-quality shrink skips no
 * pixels, over the backdrop (unless it's left out) and under the data cards. The last canvas is
 * the page's, so the cards' text has the page's fonts.
 */
const shrink = async (picture: Blob, width: number, height: number, taken: ITaken) => {
	let source: ImageBitmap | OffscreenCanvas = await createImageBitmap(picture);
	while (source.width / 2 >= width * 1.01) {
		const half: OffscreenCanvas = new OffscreenCanvas(
			Math.round(source.width / 2),
			Math.round(source.height / 2),
		);
		const context = half.getContext("2d");
		if (!context) {
			break;
		}
		context.imageSmoothingQuality = "high";
		context.drawImage(source, 0, 0, half.width, half.height);
		source = half;
	}
	const out = document.createElement("canvas");
	out.width = width;
	out.height = height;
	const context = out.getContext("2d");
	if (!context) {
		throw new Error("Can't make the picture here.");
	}
	if (taken.behind) {
		paintBehind(context, taken.behind, width, height);
	}
	context.imageSmoothingQuality = "high";
	context.drawImage(source, 0, 0, width, height);
	paintCards(context, taken.cards, width / taken.canvasWidth);
	return new Promise<Blob>((resolve, reject) =>
		out.toBlob(
			(made) => (made ? resolve(made) : reject(new Error("The picture came out empty."))),
			"image/png",
		),
	);
};

/** Draws a still picture when one is asked for (renderStill). Mount once in the scene. */
export const StillRender = () => {
	const get = useThree((s) => s.get);
	const nonce = useEditor((s) => s.stillRender?.nonce ?? null);

	useEffect(() => {
		liveCanvas = get().gl.domElement;
		liveRenderer = get().gl;
		return () => {
			liveCanvas = null;
			liveRenderer = null;
		};
	}, []);

	useEffect(() => {
		const job = useEditor.getState().stillRender;
		if (nonce === null || !job) {
			return;
		}
		const state = get();
		const before = { ...state.size };
		// Shaped like the picture, with the view's area: it frames about what the view does.
		const aspect = job.width / job.height;
		const height = Math.sqrt((before.width * before.height) / aspect);
		const width = height * aspect;
		state.setSize(width, height, before.top, before.left);
		// Through the canvas's dpr prop (Viewport), which would otherwise put its own back.
		useEditor.setState((s) => ({
			stillRender: s.stillRender && {
				...s.stillRender,
				pixelRatio: (job.width * job.smoothing) / width,
			},
		}));

		let frames = 0;
		let taken = false;
		const putBack = () => {
			get().setSize(before.width, before.height, before.top, before.left);
			useEditor.setState({ stillRender: null });
		};
		const finish = (result: TStillResult) => {
			putBack();
			settle(result);
		};
		// Right after a frame is drawn, while the canvas still holds it.
		const stop = addAfterEffect(() => {
			if (taken || get().viewport.dpr !== useEditor.getState().stillRender?.pixelRatio) {
				return;
			}
			// Smaller than asked for (the browser's limit): draw at what it gave, and settle again.
			const drawn = get().gl.getContext();
			const { width: wide, height: high } = get().gl.domElement;
			if (drawn.drawingBufferWidth < wide - 1 || drawn.drawingBufferHeight < high - 1) {
				browserMaxPixels = drawn.drawingBufferWidth * drawn.drawingBufferHeight;
				const fits = Math.min(drawn.drawingBufferWidth / wide, drawn.drawingBufferHeight / high);
				useEditor.setState((s) => ({
					stillRender: s.stillRender && {
						...s.stillRender,
						pixelRatio: (s.stillRender.pixelRatio ?? 1) * fits * 0.999,
					},
				}));
				frames = 0;
				return;
			}
			frames += 1;
			if (frames < SETTLE_FRAMES) {
				return;
			}
			taken = true;
			const canvas = get().gl.domElement;
			// The cards as LabelProjector placed them for this frame, and what's behind the canvas.
			const withFrame: ITaken = {
				behind: job.transparent ? null : behindOf(canvas),
				cards: job.showsCards ? takeCards(canvas) : [],
				canvasWidth: canvas.getBoundingClientRect().width,
			};
			canvas.toBlob((drawn) => {
				if (!drawn) {
					finish({ error: new Error("The picture came out empty.") });
					return;
				}
				shrink(drawn, job.width, job.height, withFrame).then(
					(picture) => finish({ picture }),
					(error: Error) => finish({ error }),
				);
			}, "image/png");
			// toBlob copies the canvas as it's called, then encodes it: the view goes back now, or it
			// draws the picture's tens of millions of pixels a frame for the seconds the encoding and
			// shrinking take, and slows them down.
			putBack();
		});
		// A card without room for it drops its WebGL context: say so, rather than leave a blank view.
		const canvas = get().gl.domElement;
		const lost = () => {
			taken = true;
			finish({
				error: new Error(
					"The graphics card ran out of room for a picture this big. Try a smaller size or less smoothing, and reload the page if the view stays blank.",
				),
			});
		};
		canvas.addEventListener("webglcontextlost", lost);
		return () => {
			stop();
			canvas.removeEventListener("webglcontextlost", lost);
			if (!taken) {
				finish({ error: new Error("The render was stopped.") });
			}
		};
	}, [nonce]);

	return null;
};
