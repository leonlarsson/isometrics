import { createRoot, extend, useThree } from "@react-three/fiber";
import { useEffect, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";

import { resolvePartColors } from "#/parts/colorModel";
import { resolvePartLights } from "#/parts/lightModel";
import { PARTS, resolveProps, type TAnyPart } from "#/parts/registry";
import { type IScenePalette, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { VIEW_DIRECTION } from "./CameraRig";

/**
 * Pictures of every part, rendered in the browser from the parts themselves:
 * each part in its default look, lit like the scene and seen from the same
 * angle, on a transparent background. Small ones for the Add to scene panel,
 * bigger ones for the parts catalogue, by day or at night with its lights on.
 * One offscreen canvas renders a set (a look at a size) once, then goes away;
 * the images live in memory only. See docs/adr/0036-part-thumbnails.md.
 */

export type TThumbnails = Readonly<Record<string, string>>;

/** How a set of pictures looks: the theme, and by day or at night with the parts' lights on. */
export interface IPictureLook {
	theme: TResolvedTheme;
	night: boolean;
}

/** A picture's size in CSS pixels; rendered at twice that, for sharp pictures. */
export interface IPictureSize {
	width: number;
	height: number;
}

/** The Add to scene panel's tiles. */
const THUMBNAIL_SIZE: IPictureSize = { width: 112, height: 84 };
const DPR = 2;
/** How much of the picture the part fills. */
const FILL = 0.84;

interface IPictureSet {
	look: IPictureLook;
	size: IPictureSize;
}

const keyOf = ({ look, size }: IPictureSet) =>
	`${look.theme}/${look.night ? "night" : "day"}/${size.width}x${size.height}`;

const EMPTY: TThumbnails = {};
const cache = new Map<string, TThumbnails>();
const listeners = new Set<() => void>();
const queued = new Map<string, IPictureSet>();
/**
 * Sets asked for so far. The cache only has a set once its first picture is done, so a
 * second request before that (a remount while starting up) would otherwise queue it again
 * and render every part twice.
 */
const requested = new Set<string>();
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
	// Far enough back that the whole box is in front of the camera (a big ground's near corner
	// would otherwise be behind it and cut off). The view is orthographic, so distance doesn't zoom.
	const distance = 10 + frame.getSize(corner).length();
	camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance).add(center);
	camera.far = Math.max(camera.far, distance * 2 + 10);
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

/** Moonlight for pictures at night: how much of the day's light is left, and its colour. */
const NIGHT_LIGHT = { share: 0.3, sunShare: 0.25, moon: "#a9b8ff" };

/** The theme's colours for a look: at night, dark enough that the parts' lights are on (ADR-0058). */
export const pictureLookPalette = (look: IPictureLook): IScenePalette =>
	look.night ? { ...scenePalettes[look.theme], night: 1 } : scenePalettes[look.theme];

/**
 * The lights of the scene, without shadows: for pictures and previews of
 * single parts. At night (`palette.night`) a dim, bluish moonlight instead.
 */
export const PartLights = ({ palette }: { palette: IScenePalette }) => {
	const night = palette.night > 0.5;
	return (
		<>
			<hemisphereLight
				args={[
					palette.hemiSky,
					palette.hemiGround,
					palette.hemiIntensity * (night ? NIGHT_LIGHT.share : 1),
				]}
			/>

			<ambientLight intensity={palette.ambientIntensity * (night ? NIGHT_LIGHT.share : 1)} />

			<directionalLight
				position={[6, 12, 4]}
				color={night ? NIGHT_LIGHT.moon : "#ffffff"}
				intensity={palette.sunIntensity * (night ? NIGHT_LIGHT.sunShare : 1)}
			/>
		</>
	);
};

interface IShotProps {
	part: TAnyPart;
	palette: IScenePalette;
	size: IPictureSize;
	onShot: (url: string) => void;
}

/** Shows one part, frames it, renders one frame and hands back the picture. */
const Shot = ({ part, palette, size, onShot }: IShotProps) => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const group = useRef<THREE.Group>(null);

	const shot = useRef(false);

	const shoot = () => {
		if (shot.current || !group.current || !(camera instanceof THREE.OrthographicCamera)) {
			return;
		}
		shot.current = true;
		frameBoxIn(camera, box.setFromObject(group.current), size, FILL);
		gl.render(scene, camera);
		onShot(gl.domElement.toDataURL("image/png"));
	};

	// Runs after the part's own layout effects, so everything it builds is there. Parts that build
	// asynchronously (text) call onReady instead.
	useEffect(() => {
		if (!part.rendersAsync) {
			shoot();
		}
	}, []);

	const props = resolveProps(part, {});
	const colors = resolvePartColors(part, palette);
	const Component = part.Component;
	return (
		<>
			<PartLights palette={palette} />

			<group ref={group}>
				<Component
					props={props}
					colors={colors}
					palette={palette}
					lights={resolvePartLights(part, palette)}
					playing={false}
					onReady={part.rendersAsync ? shoot : undefined}
				/>
			</group>
		</>
	);
};

/** Render every part for one set, publishing each picture as soon as it's ready. */
const renderSet = async (set: IPictureSet) => {
	const key = keyOf(set);
	const palette = pictureLookPalette(set.look);
	// <Canvas> teaches R3F three's classes; a root of our own, maybe before any canvas, needs it too.
	extend(THREE as unknown as Parameters<typeof extend>[0]);
	const canvas = document.createElement("canvas");
	const root = createRoot(canvas);
	await root.configure({
		gl: { alpha: true, antialias: true, preserveDrawingBuffer: true },
		orthographic: true,
		camera: { near: 0.1, far: 200 },
		size: { ...set.size, top: 0, left: 0 },
		dpr: DPR,
		frameloop: "never",
	});
	const pictures: Record<string, string> = {};
	try {
		for (const part of PARTS) {
			await idle();
			pictures[part.kind] = await new Promise<string>((resolve) => {
				root.render(
					<Shot key={part.kind} part={part} palette={palette} size={set.size} onShot={resolve} />,
				);
			});
			cache.set(key, { ...pictures });
			notify();
		}
	} finally {
		root.unmount();
	}
};

/** Work through the requested sets one at a time (each run uses its own WebGL context). */
const work = async () => {
	if (working) {
		return;
	}
	working = true;
	for (const [key, set] of queued) {
		queued.delete(key);
		try {
			await renderSet(set);
		} catch (error) {
			// No WebGL, or a part failed to render: the tiles keep their colour chips.
			console.warn("Could not render part pictures", error);
			cache.set(key, cache.get(key) ?? EMPTY);
		}
	}
	working = false;
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/**
 * Pictures of the parts in a look at a size, by part kind; empty at first,
 * filling in as they're rendered. The first call for a set starts rendering it.
 */
export const usePartPictures = (look: IPictureLook, size: IPictureSize): TThumbnails => {
	const key = keyOf({ look, size });
	const pictures = useSyncExternalStore(
		subscribe,
		() => cache.get(key) ?? EMPTY,
		() => EMPTY,
	);
	useEffect(() => {
		if (!requested.has(key)) {
			requested.add(key);
			queued.set(key, { look, size });
			void work();
		}
	}, [key]);
	return pictures;
};

/** The Add to scene panel's small pictures of the parts for a theme, by day. */
export const usePartThumbnails = (theme: TResolvedTheme): TThumbnails =>
	usePartPictures({ theme, night: false }, THUMBNAIL_SIZE);
