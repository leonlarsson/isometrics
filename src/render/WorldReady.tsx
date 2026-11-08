import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { type TWorldExtent, worldExtentOf } from "#/scene/grounds";

import { drawnAsOnCanvas } from "./drawnAsOnCanvas";
import { frameBoxIn } from "./thumbnails";

/** Frames drawn after the shaders are compiled before the world shows: the first ones settle shadows. */
const FRAMES_BEFORE_SHOWN = 3;
/** However long compiling takes, the world shows after this long (ms), rather than never. */
const LONGEST_WAIT = 8000;
/** The warm-up draw's size in pixels: what it's for is what it compiles and uploads, not its pixels. */
const WARM_UP_SIZE = 64;
/** How high above the ground the warm-up view reaches: above the tallest towers. */
const WARM_UP_HEIGHT = 60;

const box = new THREE.Box3();

/**
 * One draw of the whole world, before it shows, so nothing compiles or
 * uploads the first time it's seen: `compileAsync` leaves out the shadow
 * map's shaders (three r186), and an object out of the opening view is drawn
 * for the first time when the camera turns to it, which then stutters. So
 * every object is drawn once, none left out for being out of view, with the
 * shadow map drawn too, from above the whole ground, into a small buffer drawn
 * into as the canvas is (so the shaders are the canvas's own). Nothing of it
 * is seen; the view draws as before.
 */
const warmUp = (
	gl: THREE.WebGLRenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	ground: TWorldExtent,
) => {
	const target = new THREE.WebGLRenderTarget(WARM_UP_SIZE, WARM_UP_SIZE, {
		type: THREE.HalfFloatType,
	});
	drawnAsOnCanvas(target);
	const half = WARM_UP_SIZE / 2;
	const view = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 1000);
	// The view's layers: batched objects' originals sit on one it doesn't draw (ADR-0086).
	view.layers.mask = camera.layers.mask;
	box.min.set(-ground.width / 2, -1, -ground.depth / 2);
	box.max.set(ground.width / 2, WARM_UP_HEIGHT, ground.depth / 2);
	frameBoxIn(view, box, { width: WARM_UP_SIZE, height: WARM_UP_SIZE }, 1);
	const culled: THREE.Object3D[] = [];
	scene.traverse((object) => {
		if (object.frustumCulled) {
			object.frustumCulled = false;
			culled.push(object);
		}
	});
	const before = gl.getRenderTarget();
	try {
		gl.shadowMap.needsUpdate = true;
		gl.setRenderTarget(target);
		gl.render(scene, view);
	} finally {
		gl.setRenderTarget(before);
		for (const object of culled) {
			object.frustumCulled = true;
		}
		target.dispose();
	}
};

/**
 * Says when a world being opened is ready to look at (ADR-0100), so the
 * loading screen can go: once its objects are mounted (this sits last in the
 * view, so its effect runs after theirs), the effects composer's code is
 * loaded when the graphics settings use it, every shader is compiled
 * (`compileAsync`, in parallel where the browser can), the whole world is
 * drawn once out of sight (`warmUp`: the shadows' shaders, and what's out of
 * view) and a few frames are drawn. Until then the world would show
 * half-built: objects, water and effects popping in as their shaders compile
 * on first draw.
 */
export const WorldReady = ({ waitsForEffects }: { waitsForEffects: boolean }) => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const opening = useEditor((s) => s.openingWorld);
	/** Frames drawn since compiling finished, or null while waiting for it. */
	const frames = useRef<number | null>(null);

	useEffect(() => {
		if (opening === null) {
			return;
		}
		let cancelled = false;
		frames.current = null;
		const compiled = async () => {
			if (waitsForEffects) {
				await import("./Effects");
			}
			await gl.compileAsync(scene, camera);
		};
		const ready = () => {
			if (cancelled || frames.current !== null) {
				return;
			}
			try {
				performance.mark("world-warm-up-start");
				warmUp(gl, scene, camera, worldExtentOf(useEditor.getState().scene.grounds));
				performance.measure("world warm-up", "world-warm-up-start");
			} catch (error) {
				// The world shows anyway: what wasn't warmed up compiles when it's first drawn.
				console.warn("Could not warm up the world's shaders", error);
			}
			frames.current = 0;
		};
		compiled().then(ready, ready);
		const timeout = window.setTimeout(ready, LONGEST_WAIT);
		return () => {
			cancelled = true;
			window.clearTimeout(timeout);
		};
	}, [opening]);

	useFrame(() => {
		if (frames.current === null || opening === null) {
			return;
		}
		frames.current += 1;
		if (frames.current >= FRAMES_BEFORE_SHOWN) {
			frames.current = null;
			useEditor.getState().worldShown(opening);
		}
	});

	return null;
};
