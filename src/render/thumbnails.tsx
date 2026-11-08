import { createRoot, extend, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";

import { FENCE_STYLE_LIST } from "#/fences/registry";
import { resolveColors, resolveTransparencies } from "#/parts/colorModel";
import { resolveLights } from "#/parts/lightModel";
import { prefabPartOf } from "#/parts/prefabParts";
import { PARTS, resolveProps, type TAnyPart } from "#/parts/registry";
import {
	hasObjectSettings,
	NO_OBJECT_SETTINGS,
	type TObjectSettings,
} from "#/scene/objectSettings";
import { FenceSchema, type TFenceKind, type TPrefab } from "#/scene/schema";
import { type IScenePalette, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { VIEW_DIRECTION } from "./CameraRig";
import { FenceBody } from "./FenceMesh";
import PART_PICTURES from "./partPictures.json";
// Prefabs' pictures draw their pieces with it (ADR-0134).
import "./PrefabPieces";
import type { TGround } from "#/scene/schema";

/**
 * Pictures of every part, rendered in the browser from the parts themselves:
 * each part in its default look, lit like the scene and seen from the same
 * angle, on a transparent background. Small ones for the Add to scene panel,
 * bigger ones for the parts catalogue, by day or at night with its lights on.
 * One offscreen canvas renders a set (a look at a size) once, then goes away;
 * the images live in memory only. See docs/adr/0036-part-thumbnails.md. Add to
 * scene's are made ahead of time as files (ADR-0150, scripts/part-pictures.mjs):
 * only a part with none yet is drawn for it here.
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
	/** Only these pictures (parts' kinds, fences' `fencePictureKey`); every one when left out. */
	only?: readonly string[];
}

const keyOf = ({ look, size, only }: IPictureSet) =>
	`${look.theme}/${look.night ? "night" : "day"}/${size.width}x${size.height}${only ? `/${only.join(",")}` : ""}`;

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

const piece = new THREE.Box3();

/**
 * A part's own extent, without the light it throws on the ground (pools and
 * beams, marked `userData.lightOnTheGround`), which can reach far past it.
 */
export const partBounds = (part: THREE.Object3D, target: THREE.Box3) => {
	target.makeEmpty();
	part.updateWorldMatrix(true, true);
	part.traverse((object) => {
		if ("geometry" in object && !object.userData.lightOnTheGround) {
			target.union(piece.makeEmpty().expandByObject(object));
		}
	});
	return target;
};

/** Moonlight for pictures at night: how much of the day's light is left, and its colour. */
const NIGHT_LIGHT = { share: 0.3, sunShare: 0.25, moon: "#a9b8ff" };

/** The theme's colours for a look: at night, dark enough that the parts' lights are on (ADR-0058). */
export const pictureLookPalette = (look: IPictureLook): IScenePalette =>
	look.night ? { ...scenePalettes[look.theme], night: 1 } : scenePalettes[look.theme];

/** The hour a look shows, for lights on a schedule: noon by day, 22:00 at night. */
export const pictureLookHour = (look: IPictureLook) => (look.night ? 22 : 12);

/** How a part draws with an object's settings, parked, in a look's colours at its hour. */
export const partDrawing = (
	part: TAnyPart,
	settings: TObjectSettings,
	palette: IScenePalette,
	hour: number | null,
) => {
	const stored = { ...settings, color: null, accent: null };
	return {
		props: resolveProps(part, settings.props),
		colors: resolveColors(part, stored, palette),
		transparency: resolveTransparencies(part, stored),
		lights: resolveLights(part, stored, { palette, driving: false, hour }),
	};
};

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

/**
 * Renders the picture once its shaders are compiled, and hands it back. They're compiled alongside
 * (KHR_parallel_shader_compile, through three's compileAsync) rather than on the first render,
 * which waits for them: a part with materials this canvas hadn't drawn yet froze the editor for up
 * to a couple of hundred milliseconds while Add to scene's pictures were taken (PERFORMANCE.md).
 */
export const takeWhenCompiled = (
	gl: THREE.WebGLRenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	onShot: (url: string) => void,
	format: { type: string; quality?: number } = { type: "image/png" },
) => {
	// Checked in development only (render/Viewport's ShaderChecks): each check waits on the GPU.
	gl.debug.checkShaderErrors = import.meta.env.DEV;
	void gl.compileAsync(scene, camera).then(() => {
		gl.render(scene, camera);
		onShot(gl.domElement.toDataURL(format.type, format.quality));
	});
};

/** One picture to take: a part, with an object's settings, in a look. */
interface IShot {
	part: TAnyPart;
	settings: TObjectSettings;
	look: IPictureLook;
}

/** A short fence with a corner, for a style's picture (ADR-0103). */
const fenceForPicture = (style: TFenceKind) =>
	FenceSchema.parse({
		id: "picture",
		style,
		points: [
			[-1.6, 1],
			[-1.6, -0.6],
			[1.6, -0.6],
		],
	});

/** A fence style's picture in a look, for its tile in Add to scene. */
const FenceShot = ({
	style,
	look,
	size,
	onShot,
}: {
	style: TFenceKind;
	look: IPictureLook;
	size: IPictureSize;
	onShot: (url: string) => void;
}) => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const group = useRef<THREE.Group>(null);
	const palette = pictureLookPalette(look);

	useEffect(() => {
		if (!group.current || !(camera instanceof THREE.OrthographicCamera)) {
			return;
		}
		frameBoxIn(camera, partBounds(group.current, box), size, FILL);
		takeWhenCompiled(gl, scene, camera, onShot);
	}, []);

	return (
		<>
			<PartLights palette={palette} />

			<group ref={group}>
				<FenceBody
					fence={fenceForPicture(style)}
					palette={palette}
					areas={NO_AREAS}
					grounds={NO_GROUNDS}
					data={NO_DATA}
					selected={false}
				/>
			</group>
		</>
	);
};

const NO_AREAS: never[] = [];
/** Pieces and pictures stand on no ground of their own: the base level (ADR-0155). */
const NO_GROUNDS: readonly TGround[] = [];
const NO_DATA: never[] = [];

/** The key a fence style's picture is kept under, next to the parts' kinds. */
export const fencePictureKey = (style: TFenceKind) => `fence:${style}`;

interface IShotProps extends IShot {
	size: IPictureSize;
	onShot: (url: string) => void;
}

/** Shows one part, frames it, renders one frame and hands back the picture. */
const Shot = ({ part, settings, look, size, onShot }: IShotProps) => {
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
		frameBoxIn(camera, partBounds(group.current, box), size, FILL);
		takeWhenCompiled(gl, scene, camera, onShot);
	};

	// Runs after the part's own layout effects, so everything it builds is there. Parts that build
	// asynchronously (text) call onReady instead.
	useEffect(() => {
		if (!part.rendersAsync) {
			shoot();
		}
	}, []);

	const palette = pictureLookPalette(look);
	const { props, colors, transparency, lights } = partDrawing(
		part,
		settings,
		palette,
		pictureLookHour(look),
	);
	const Component = part.Component;
	return (
		<>
			<PartLights palette={palette} />

			<group ref={group}>
				<Component
					props={props}
					colors={colors}
					transparency={transparency}
					palette={palette}
					lights={lights}
					playing={false}
					onReady={part.rendersAsync ? shoot : undefined}
				/>
			</group>
		</>
	);
};

let shots = 0;

/** Take pictures with one offscreen canvas (one WebGL context), which goes away afterwards. */
const withPictureCanvas = async (
	size: IPictureSize,
	use: (
		take: (shot: IShot) => Promise<string>,
		takeFence: (style: TFenceKind, look: IPictureLook) => Promise<string>,
	) => Promise<void>,
) => {
	// <Canvas> teaches R3F three's classes; a root of our own, maybe before any canvas, needs it too.
	extend(THREE as unknown as Parameters<typeof extend>[0]);
	const canvas = document.createElement("canvas");
	const root = createRoot(canvas);
	await root.configure({
		gl: { alpha: true, antialias: true, preserveDrawingBuffer: true },
		orthographic: true,
		camera: { near: 0.1, far: 200 },
		size: { ...size, top: 0, left: 0 },
		dpr: DPR,
		frameloop: "never",
	});
	try {
		await use(
			(shot) =>
				new Promise<string>((resolve) => {
					shots += 1;
					root.render(<Shot key={shots} {...shot} size={size} onShot={resolve} />);
				}),
			(style, look) =>
				new Promise<string>((resolve) => {
					shots += 1;
					root.render(
						<FenceShot key={shots} style={style} look={look} size={size} onShot={resolve} />,
					);
				}),
		);
	} finally {
		root.unmount();
	}
};

/** How often pictures being taken are published, at most (ms). */
const PUBLISH_EVERY_MS = 500;

/** Render every part for one set, publishing the pictures as they're ready, a few at a time. */
const renderSet = (set: IPictureSet) => {
	const key = keyOf(set);
	const pictures: Record<string, string> = {};
	// Published a few at a time: each publish draws every tile showing them again (Add to scene's
	// hundreds), and one per picture kept a big world's editor busy for a minute (PERFORMANCE.md).
	let publishedAt = Number.NEGATIVE_INFINITY;
	const publish = (now = false) => {
		if (now || performance.now() - publishedAt >= PUBLISH_EVERY_MS) {
			publishedAt = performance.now();
			cache.set(key, { ...pictures });
			notify();
		}
	};
	return takeSet(set, (key, url) => {
		pictures[key] = url;
		publish();
	}).finally(() => publish(true));
};

/** Takes a set's pictures one by one in quiet moments, handing each over as it's done. */
const takeSet = (set: IPictureSet, onPicture: (key: string, url: string) => void) =>
	withPictureCanvas(set.size, async (take, takeFence) => {
		const wanted = (key: string) => !set.only || set.only.includes(key);
		for (const part of PARTS) {
			if (wanted(part.kind)) {
				await idle();
				onPicture(part.kind, await take({ part, settings: NO_OBJECT_SETTINGS, look: set.look }));
			}
		}
		// The fence styles too (ADR-0103), under keys of their own.
		for (const style of FENCE_STYLE_LIST) {
			if (wanted(fencePictureKey(style.id))) {
				await idle();
				onPicture(fencePictureKey(style.id), await takeFence(style.id, set.look));
			}
		}
	});

/**
 * Add to scene's pictures in a theme, by key (a part's kind, a fence's `fencePictureKey`), as PNG
 * data URLs: what scripts/part-pictures.mjs saves as files (ADR-0150), drawn by the code that draws
 * them live. Every one, or only these.
 */
export const renderAddToScenePictures = async (theme: TResolvedTheme, only?: readonly string[]) => {
	const pictures: Record<string, string> = {};
	await takeSet({ look: { theme, night: false }, size: THUMBNAIL_SIZE, only }, (key, url) => {
		pictures[key] = url;
	});
	return pictures;
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
 * `only` renders just those (none: nothing is rendered).
 */
export const usePartPictures = (
	look: IPictureLook,
	size: IPictureSize,
	only?: readonly string[],
): TThumbnails => {
	const key = keyOf({ look, size, only });
	const pictures = useSyncExternalStore(
		subscribe,
		() => cache.get(key) ?? EMPTY,
		() => EMPTY,
	);
	useEffect(() => {
		if (!requested.has(key) && only?.length !== 0) {
			requested.add(key);
			queued.set(key, { look, size, only });
			void work();
		}
	}, [key]);
	return pictures;
};

/** Every picture Add to scene shows: each part's, then each fence style's (`fencePictureKey`). */
export const ADD_TO_SCENE_PICTURES: readonly string[] = [
	...PARTS.map((part) => part.kind),
	...FENCE_STYLE_LIST.map((style) => fencePictureKey(style.id)),
];

/**
 * Where an Add to scene picture's file is (ADR-0150), made ahead of time by
 * scripts/part-pictures.mjs, for a theme; null for one that has none yet (a new part).
 */
export const addToScenePictureOf = (key: string, theme: TResolvedTheme) =>
	Object.hasOwn(PART_PICTURES, key)
		? `/part-pictures/${key.replace(":", "-")}-${theme}.webp`
		: null;

/**
 * The Add to scene panel's small pictures of the parts for a theme, by day, by key: each from
 * its file, made ahead of time (ADR-0150), and drawn live only for what has none or a file that
 * doesn't load (`fileFailed`, given the picture's address).
 */
export const usePartThumbnails = (theme: TResolvedTheme) => {
	const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
	const fileOf = (key: string) => (failed.has(key) ? null : addToScenePictureOf(key, theme));
	const drawn = usePartPictures(
		{ theme, night: false },
		THUMBNAIL_SIZE,
		ADD_TO_SCENE_PICTURES.filter((key) => fileOf(key) === null),
	);
	const pictures: Record<string, string> = {};
	for (const key of ADD_TO_SCENE_PICTURES) {
		const url = fileOf(key) ?? drawn[key];
		if (url) {
			pictures[key] = url;
		}
	}
	const fileFailed = (url: string) => {
		const key = ADD_TO_SCENE_PICTURES.find((each) => addToScenePictureOf(each, theme) === url);
		if (key) {
			setFailed((before) => new Set(before).add(key));
		}
	};
	return { pictures, fileFailed };
};

/** Pictures of one part with an object's settings, taken one batch at a time. */
let settingsShots = Promise.resolve();

/**
 * Prefabs' pictures (ADR-0134), by theme and design (a changed design gets a new one): replaced,
 * never changed, so components that read them draw again when one's added.
 */
let prefabPictures: Readonly<Record<string, string>> = {};
const PREFAB_PICTURES_KEPT = 200;
const prefabListeners = new Set<() => void>();
const subscribePrefabPictures = (listener: () => void) => {
	prefabListeners.add(listener);
	return () => {
		prefabListeners.delete(listener);
	};
};
const keepPrefabPicture = (key: string, url: string) => {
	// Oldest first: designs changed many times keep only their latest pictures.
	const kept = Object.entries(prefabPictures).slice(-(PREFAB_PICTURES_KEPT - 1));
	prefabPictures = { ...Object.fromEntries(kept), [key]: url };
	for (const listener of prefabListeners) {
		listener();
	}
};
/** Each design's text, once: the key its picture is kept under. */
const designKeys = new WeakMap<TPrefab, string>();
const designKeyOf = (prefab: TPrefab) => {
	let key = designKeys.get(prefab);
	if (key === undefined) {
		key = JSON.stringify({ ...prefab, name: "", description: "" });
		designKeys.set(prefab, key);
	}
	return key;
};
const prefabPictureKey = (prefab: TPrefab, theme: TResolvedTheme) =>
	`${theme}|${designKeyOf(prefab)}`;

/**
 * Add to scene's pictures of prefabs, by prefab id, taken as the parts' are (a part made from the
 * design, by day, in the theme): none at first, each filling in once it's rendered, and taken
 * again only when its design changes.
 */
export const usePrefabThumbnails = (
	prefabs: readonly TPrefab[],
	theme: TResolvedTheme,
): TThumbnails => {
	const pictures = useSyncExternalStore(
		subscribePrefabPictures,
		() => prefabPictures,
		() => prefabPictures,
	);
	const missing = prefabs.filter(
		(prefab) => !Object.hasOwn(pictures, prefabPictureKey(prefab, theme)),
	);
	const missingKey = missing.map((prefab) => prefabPictureKey(prefab, theme)).join("\n");
	useEffect(() => {
		if (missing.length === 0) {
			return;
		}
		settingsShots = settingsShots.then(() =>
			withPictureCanvas(THUMBNAIL_SIZE, async (take) => {
				for (const prefab of missing) {
					const key = prefabPictureKey(prefab, theme);
					if (Object.hasOwn(prefabPictures, key)) {
						continue;
					}
					await idle();
					const url = await take({
						part: prefabPartOf(prefab),
						settings: NO_OBJECT_SETTINGS,
						look: { theme, night: false },
					});
					keepPrefabPicture(key, url);
				}
			}).catch((error) => console.warn("Could not render prefab pictures", error)),
		);
	}, [missingKey]);
	return Object.fromEntries(
		prefabs.flatMap((prefab) => {
			const key = prefabPictureKey(prefab, theme);
			return Object.hasOwn(pictures, key) ? [[prefab.id, pictures[key]]] : [];
		}),
	);
};

/** The last batches taken, by part, settings, looks and size: reopening a part shows them at once. */
const settingsCache = new Map<string, string[]>();
const SETTINGS_CACHE_SIZE = 24;

/** How long changed settings must stay the same before their pictures are taken (a slider being dragged). */
const SETTLE_MS = 250;

/**
 * Pictures of one part with an object's settings (none: as it comes), one per
 * look, rendered on their own rather than waiting for every part's: a moment
 * after the settings stop changing, the last ones kept meanwhile (a part's
 * details in the catalogue).
 */
export const usePartPicturesWith = (
	part: TAnyPart,
	settings: TObjectSettings,
	looks: readonly IPictureLook[],
	size: IPictureSize,
): (string | undefined)[] => {
	const key = [
		part.kind,
		JSON.stringify(settings),
		...looks.map((look) => keyOf({ look, size })),
	].join("|");
	const [taken, setTaken] = useState<{ kind: string; urls: string[] } | null>(null);
	const cached = settingsCache.get(key);
	useEffect(() => {
		if (cached) {
			setTaken({ kind: part.kind, urls: cached });
			return;
		}
		let stale = false;
		const timer = setTimeout(
			() => {
				settingsShots = settingsShots.then(() =>
					stale
						? undefined
						: withPictureCanvas(size, async (take) => {
								const urls: string[] = [];
								for (const look of looks) {
									urls.push(await take({ part, settings, look }));
								}
								settingsCache.set(key, urls);
								// Oldest first: a slider dragged through many values keeps only the last few.
								for (const old of settingsCache.keys()) {
									if (settingsCache.size <= SETTINGS_CACHE_SIZE) {
										break;
									}
									settingsCache.delete(old);
								}
								if (!stale) {
									setTaken({ kind: part.kind, urls });
								}
							}).catch((error) => console.warn("Could not render part pictures", error)),
				);
			},
			hasObjectSettings(settings) ? SETTLE_MS : 0,
		);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
	}, [key]);
	return cached ?? (taken?.kind === part.kind ? taken.urls : []);
};
