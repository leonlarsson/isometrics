import { createRoot, useThree } from "@react-three/fiber";
import { useEffect, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";

import { PARTS, resolveColors, resolveProps, type TAnyPart } from "#/parts/registry";
import { type IScenePalette, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { VIEW_DIRECTION } from "./CameraRig";

/**
 * Small pictures of every part for the Add to scene panel, rendered in the
 * browser from the parts themselves: each part in its default look, lit like
 * the scene and seen from the same angle, on a transparent background. One
 * offscreen canvas renders them all once per theme, then goes away; the images
 * live in memory only. See docs/adr/0036-part-thumbnails.md.
 */

export type TThumbnails = Readonly<Record<string, string>>;

/** CSS pixels; rendered at twice that for sharp tiles. */
const SIZE = { width: 112, height: 84 };
const DPR = 2;
/** How much of the picture the part fills. */
const FILL = 0.84;

const EMPTY: TThumbnails = {};
const cache = new Map<TResolvedTheme, TThumbnails>();
const listeners = new Set<() => void>();
const queued = new Set<TResolvedTheme>();
let working = false;

/** Wait until the browser has a quiet moment, so rendering pictures never makes the page stutter. */
const idle = () =>
	new Promise<void>((resolve) => {
		if ("requestIdleCallback" in window) {
			window.requestIdleCallback(() => resolve(), { timeout: 500 });
		} else {
			setTimeout(resolve, 16);
		}
	});

const notify = () => {
	for (const listener of listeners) {
		listener();
	}
};

const box = new THREE.Box3();
const center = new THREE.Vector3();
const corner = new THREE.Vector3();

/**
 * Point an orthographic camera at a box from the scene's viewing angle and
 * zoom so the box fills `fill` of a view `size` CSS pixels big. Shared by the
 * thumbnails and the live preview (render/PartPreviewModel).
 */
export const frameBoxIn = (
	camera: THREE.OrthographicCamera,
	frame: THREE.Box3,
	size: { width: number; height: number },
	fill: number,
) => {
	frame.getCenter(center);
	camera.position.copy(VIEW_DIRECTION).multiplyScalar(50).add(center);
	camera.lookAt(center);
	camera.updateMatrixWorld();
	const middle = center.clone().applyMatrix4(camera.matrixWorldInverse);
	let maxX = 1e-3;
	let maxY = 1e-3;
	for (const x of [frame.min.x, frame.max.x]) {
		for (const y of [frame.min.y, frame.max.y]) {
			for (const z of [frame.min.z, frame.max.z]) {
				corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).sub(middle);
				maxX = Math.max(maxX, Math.abs(corner.x));
				maxY = Math.max(maxY, Math.abs(corner.y));
			}
		}
	}
	// The orthographic frustum is in CSS pixels, so zoom = pixels per unit (as in CameraRig).
	camera.zoom = Math.min(size.width / (2 * maxX), size.height / (2 * maxY)) * fill;
	camera.updateProjectionMatrix();
};

/** The lights of the scene, without shadows: for pictures and previews of single parts. */
export const PartLights = ({ palette }: { palette: IScenePalette }) => {
	return (
		<>
			<hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]} />

			<ambientLight intensity={palette.ambientIntensity} />

			<directionalLight position={[6, 12, 4]} intensity={palette.sunIntensity} />
		</>
	);
};

interface IShotProps {
	part: TAnyPart;
	palette: IScenePalette;
	onShot: (url: string) => void;
}

/** Shows one part, frames it, renders one frame and hands back the picture. */
const Shot = ({ part, palette, onShot }: IShotProps) => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const group = useRef<THREE.Group>(null);

	// Runs after the part's own layout effects, so everything it builds is there.
	useEffect(() => {
		if (!group.current || !(camera instanceof THREE.OrthographicCamera)) {
			return;
		}
		frameBoxIn(camera, box.setFromObject(group.current), SIZE, FILL);
		gl.render(scene, camera);
		onShot(gl.domElement.toDataURL("image/png"));
	}, []);

	const props = resolveProps(part, {});
	const { color, accent } = resolveColors(part, { color: null, accent: null }, palette);
	const Component = part.Component;
	return (
		<>
			<PartLights palette={palette} />

			<group ref={group}>
				<Component props={props} color={color} accent={accent} palette={palette} playing={false} />
			</group>
		</>
	);
};

/** Render every part for one theme, publishing each picture as soon as it's ready. */
const renderTheme = async (theme: TResolvedTheme) => {
	const palette = scenePalettes[theme];
	const canvas = document.createElement("canvas");
	const root = createRoot(canvas);
	await root.configure({
		gl: { alpha: true, antialias: true, preserveDrawingBuffer: true },
		orthographic: true,
		camera: { near: 0.1, far: 200 },
		size: { ...SIZE, top: 0, left: 0 },
		dpr: DPR,
		frameloop: "never",
	});
	const thumbnails: Record<string, string> = {};
	try {
		for (const part of PARTS) {
			await idle();
			thumbnails[part.kind] = await new Promise<string>((resolve) => {
				root.render(<Shot key={part.kind} part={part} palette={palette} onShot={resolve} />);
			});
			cache.set(theme, { ...thumbnails });
			notify();
		}
	} finally {
		root.unmount();
	}
};

/** Work through the requested themes one at a time (each run uses its own WebGL context). */
const work = async () => {
	if (working) {
		return;
	}
	working = true;
	for (const theme of queued) {
		queued.delete(theme);
		try {
			await renderTheme(theme);
		} catch (error) {
			// No WebGL, or a part failed to render: the tiles keep their colour chips.
			console.warn("Could not render part thumbnails", error);
			cache.set(theme, cache.get(theme) ?? EMPTY);
		}
	}
	working = false;
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/**
 * Pictures of the parts for a theme, by part kind; empty at first, filling in
 * as they're rendered. The first call for a theme starts rendering it.
 */
export const usePartThumbnails = (theme: TResolvedTheme): TThumbnails => {
	const thumbnails = useSyncExternalStore(
		subscribe,
		() => cache.get(theme) ?? EMPTY,
		() => EMPTY,
	);
	useEffect(() => {
		if (!cache.has(theme)) {
			queued.add(theme);
			void work();
		}
	}, [theme]);
	return thumbnails;
};
