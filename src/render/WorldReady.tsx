import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import { useEditor } from "#/editor/store";

/** Frames drawn after the shaders are compiled before the world shows: the first ones settle shadows. */
const FRAMES_BEFORE_SHOWN = 3;
/** However long compiling takes, the world shows after this long (ms), rather than never. */
const LONGEST_WAIT = 8000;

/**
 * Says when a world being opened is ready to look at (ADR-0100), so the
 * loading screen can go: once its objects are mounted (this sits last in the
 * view, so its effect runs after theirs), the effects composer's code is
 * loaded when the graphics settings use it, every shader is compiled
 * (`compileAsync`, in parallel where the browser can) and a few frames are
 * drawn. Until then the world would show half-built: objects, water and
 * effects popping in as their shaders compile on first draw.
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
			if (!cancelled) {
				frames.current = 0;
			}
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
