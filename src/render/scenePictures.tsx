import { RoundedBox } from "@react-three/drei";
import { createRoot, extend, useThree } from "@react-three/fiber";
import { useEffect, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";

import { toRadians } from "#/lib/math";
import { colorOf, resolveColors, resolveTransparencies } from "#/parts/colorModel";
import { resolveLights } from "#/parts/lightModel";
import { partIn } from "#/parts/prefabParts";
import { resolveProps, vehicleLengthOf } from "#/parts/registry";
import { GROUND } from "#/scene/ground";
import { roadNetworkOf } from "#/scene/junctions";
import { resolveTurnStyle, turnSmoothing } from "#/scene/roads";
import { createRouteSampler } from "#/scene/routes";
import type { TEntity, TScene } from "#/scene/schema";
import { groundSurfaceOf } from "#/scene/surfaces";
import { type IScenePalette, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { AreaBody } from "./AreaMesh";
import { FenceBody } from "./FenceMesh";
import { JunctionBodies } from "./JunctionMesh";
// Prefabs' copies draw their pieces with it (ADR-0134).
import "./PrefabPieces";
import { RoadBody } from "./RoadMesh";
import { SceneLights } from "./SceneLights";
import { frameBoxIn } from "./thumbnails";
import { useSurfaceShading } from "./useSurfaceShading";

/**
 * Pictures of whole worlds, rendered in the browser from the worlds
 * themselves, like the part thumbnails (ADR-0036): the ground, areas, roads
 * and objects as they stand when the world opens, seen from the default angle
 * on a transparent background. One offscreen canvas renders what's asked for,
 * then goes away; the images live in memory only. See
 * docs/adr/0047-new-world-dialog.md. The built-in worlds' pictures are made
 * the same way ahead of time (`renderScenePictures`, from
 * scripts/starter-pictures.mjs) and shipped as files (ADR-0146): live, this
 * draws only what has no file.
 */

export type TScenePictures = Readonly<Record<string, string>>;

/** A world to picture: `create` is only called when its picture is rendered. */
export interface IScenePictureSource {
	id: string;
	create: () => TScene;
}

/** CSS pixels; rendered at twice that for sharp cards. */
export const SCENE_PICTURE_SIZE = { width: 240, height: 150 };

/** How a picture is rendered: its size in CSS pixels, at how many device pixels each, and its file type. */
export interface IScenePictureFormat {
	size: { width: number; height: number };
	dpr: number;
	/** A type the canvas encodes (`image/png`, `image/webp`, `image/jpeg`), and its quality from 0 to 1. */
	type: string;
	quality?: number;
}

/** The cards' pictures: lossless, at twice the card's size. */
export const CARD_PICTURE_FORMAT: IScenePictureFormat = {
	size: SCENE_PICTURE_SIZE,
	dpr: 2,
	type: "image/png",
};
/** How much of the picture the world fills. */
const FILL = 0.94;
/** Parts that build asynchronously (text) get this long before the picture is taken anyway. */
const ASYNC_TIMEOUT_MS = 2000;

const EMPTY: TScenePictures = {};
const cache = new Map<TResolvedTheme, TScenePictures>();
const listeners = new Set<() => void>();
const requested = new Set<string>();
const pending: { theme: TResolvedTheme; source: IScenePictureSource }[] = [];
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

/** Where an object stands when the world opens: a driving vehicle at its start on the road. */
const startPose = (entity: TEntity, scene: TScene) => {
	const part = partIn(entity.kind, scene.prefabs);
	const road = entity.follow
		? scene.roads.find((candidate) => candidate.id === entity.follow?.roadId)
		: undefined;
	if (!part || !entity.follow || !road) {
		return {
			position: [entity.position[0], entity.altitude, entity.position[1]] as const,
			// Heading, then pitch, then roll, as in the editor (ADR-0097).
			rotation: [
				toRadians(entity.rotation[0]),
				toRadians(entity.rotation[1]),
				toRadians(entity.rotation[2]),
				"YZX",
			] as const,
		};
	}
	const props = resolveProps(part, entity.props);
	const length = vehicleLengthOf(part, props, entity.scale);
	const turns = resolveTurnStyle(
		scene.traffic.turnStyle,
		road.traffic.turnStyle,
		entity.follow.turnStyle,
	);
	const sample = createRouteSampler(road, scene.traffic.drivingSide, {
		reverse: entity.follow.drivesTheOtherWay,
		smoothing: turnSmoothing(turns, length),
	}).at(entity.follow.startDistance);
	return {
		position: [sample.position[0], entity.altitude + sample.height, sample.position[1]] as const,
		rotation: [0, sample.heading + toRadians(entity.rotation[1]), sample.pitch, "YZX"] as const,
	};
};

interface IPictureEntityProps {
	entity: TEntity;
	scene: TScene;
	palette: IScenePalette;
	onReady: () => void;
}

const PictureEntity = ({ entity, scene, palette, onReady }: IPictureEntityProps) => {
	const part = partIn(entity.kind, scene.prefabs);
	if (!part) {
		return null;
	}
	const { position, rotation } = startPose(entity, scene);
	const colors = resolveColors(part, entity, palette, scene.data.values);
	const lights = resolveLights(part, entity, {
		palette,
		driving: entity.follow !== null,
		data: scene.data.values,
		hour: scene.lighting.time,
	});
	const Component = part.Component;
	return (
		<group position={position}>
			<group rotation={rotation} scale={entity.scale}>
				<Component
					props={resolveProps(part, entity.props)}
					colors={colors}
					transparency={resolveTransparencies(part, entity)}
					palette={palette}
					playing={false}
					lights={lights}
					data={scene.data.values}
					hour={scene.lighting.time}
					onReady={part.rendersAsync ? onReady : undefined}
				/>
			</group>
		</group>
	);
};

interface IPictureProps {
	scene: TScene;
	palette: IScenePalette;
	format: IScenePictureFormat;
	onShot: (url: string) => void;
}

/** Shows one world, frames it, renders one frame and hands back the picture. */
const Picture = ({ scene, palette, format, onShot }: IPictureProps) => {
	const gl = useThree((s) => s.gl);
	const three = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const group = useRef<THREE.Group>(null);
	const shot = useRef(false);
	const entities = scene.entities.filter((entity) => !entity.isHidden);
	const waiting = useRef(
		entities.filter((entity) => partIn(entity.kind, scene.prefabs)?.rendersAsync).length,
	);
	const network = roadNetworkOf(scene.roads, scene.junctions);
	const groundSurface = useSurfaceShading(groundSurfaceOf(scene.ground, scene.surface), false);

	const shoot = () => {
		if (shot.current || !group.current || !(camera instanceof THREE.OrthographicCamera)) {
			return;
		}
		shot.current = true;
		frameBoxIn(camera, box.setFromObject(group.current), format.size, FILL);
		gl.render(three, camera);
		onShot(gl.domElement.toDataURL(format.type, format.quality));
	};

	const onReady = () => {
		waiting.current -= 1;
		if (waiting.current <= 0) {
			shoot();
		}
	};

	// Runs after the parts' own layout effects, so everything they build is there.
	useEffect(() => {
		if (waiting.current <= 0) {
			shoot();
			return;
		}
		const timer = setTimeout(shoot, ASYNC_TIMEOUT_MS);
		return () => clearTimeout(timer);
	}, []);

	return (
		<>
			<SceneLights ground={scene.ground} palette={palette} lighting={scene.lighting} />

			<group ref={group}>
				<RoundedBox
					args={[scene.ground.width, 1, scene.ground.depth]}
					radius={0.45}
					smoothness={4}
					position={[0, -0.5, 0]}
					receiveShadow
				>
					<meshStandardMaterial
						key={groundSurface.key}
						userData={groundSurface.userData}
						color={colorOf(
							GROUND,
							scene.ground,
							"surface",
							palette,
							scene.data.values,
							palette.ground,
						)}
						roughness={0.95}
					/>
				</RoundedBox>

				{scene.areas.map((area, index) =>
					area.isHidden ? null : (
						<AreaBody
							key={area.id}
							area={area}
							layer={index}
							palette={palette}
							data={scene.data.values}
							selected={false}
							worldSurface={scene.surface}
						/>
					),
				)}

				{scene.roads.map((road, index) =>
					road.isHidden ? null : (
						<RoadBody
							key={road.id}
							road={road}
							layer={index}
							palette={palette}
							data={scene.data.values}
							ground={scene.ground}
							editing={false}
							selected={false}
							trimStart={network.drawTrimsOf(road.id).start}
							trimEnd={network.drawTrimsOf(road.id).end}
						/>
					),
				)}

				<JunctionBodies
					roads={scene.roads}
					junctions={scene.junctions}
					palette={palette}
					data={scene.data}
				/>

				{scene.fences.map((fence) =>
					fence.isHidden ? null : (
						<FenceBody
							key={fence.id}
							fence={fence}
							palette={palette}
							areas={scene.areas}
							data={scene.data.values}
							selected={false}
						/>
					),
				)}

				{entities.map((entity) => (
					<PictureEntity
						key={entity.id}
						entity={entity}
						scene={scene}
						palette={palette}
						onReady={onReady}
					/>
				))}
			</group>
		</>
	);
};

/**
 * An offscreen canvas that renders worlds one at a time, in a format. Throws when there's no WebGL.
 * `close` when done: it lets go of its WebGL context.
 */
const openPictureRoot = async (format: IScenePictureFormat) => {
	// <Canvas> teaches R3F three's classes; this root may come before any canvas (the home screen's
	// New world…), so it teaches them too.
	extend(THREE as unknown as Parameters<typeof extend>[0]);
	const canvas = document.createElement("canvas");
	const root = createRoot(canvas);
	try {
		await root.configure({
			gl: { alpha: true, antialias: true, preserveDrawingBuffer: true },
			shadows: "percentage",
			orthographic: true,
			camera: { near: 0.1, far: 500 },
			size: { ...format.size, top: 0, left: 0 },
			dpr: format.dpr,
			frameloop: "never",
		});
	} catch (error) {
		root.unmount();
		throw error;
	}
	return {
		shoot: (scene: TScene, theme: TResolvedTheme, key: string) =>
			new Promise<string>((resolve) => {
				root.render(
					<Picture
						key={`${theme}:${key}`}
						scene={scene}
						palette={scenePalettes[theme]}
						format={format}
						onShot={resolve}
					/>,
				);
			}),
		close: () => root.unmount(),
	};
};

/**
 * Pictures of worlds for a theme, by source id, rendered one after another in
 * a format, as data URLs: for making the built-in worlds' picture files ahead
 * of time (scripts/starter-pictures.mjs, ADR-0146).
 */
export const renderScenePictures = async (
	sources: readonly IScenePictureSource[],
	theme: TResolvedTheme,
	format: IScenePictureFormat = CARD_PICTURE_FORMAT,
) => {
	const root = await openPictureRoot(format);
	const pictures: Record<string, string> = {};
	try {
		for (const source of sources) {
			pictures[source.id] = await root.shoot(source.create(), theme, source.id);
		}
	} finally {
		root.close();
	}
	return pictures;
};

/** Render everything asked for so far, publishing each picture as soon as it's ready. */
const work = async () => {
	if (working) {
		return;
	}
	working = true;
	let root: Awaited<ReturnType<typeof openPictureRoot>> | null = null;
	try {
		root = await openPictureRoot(CARD_PICTURE_FORMAT);
		for (let next = pending.shift(); next; next = pending.shift()) {
			const { theme, source } = next;
			await idle();
			try {
				const url = await root.shoot(source.create(), theme, source.id);
				cache.set(theme, { ...(cache.get(theme) ?? EMPTY), [source.id]: url });
				notify();
			} catch (error) {
				// The card keeps its placeholder.
				console.warn(`Could not render a picture of "${source.id}"`, error);
			}
		}
	} catch (error) {
		// No WebGL: every card keeps its placeholder.
		console.warn("Could not render world pictures", error);
		pending.length = 0;
	} finally {
		root?.close();
		working = false;
	}
	// Asked for while this run was finishing.
	if (pending.length > 0) {
		void work();
	}
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => listeners.delete(listener);
};

/**
 * Pictures of worlds for a theme, by source id; empty at first, filling in as
 * they're rendered. The first call for a source and theme starts rendering it.
 */
export const useScenePictures = (
	theme: TResolvedTheme,
	sources: readonly IScenePictureSource[],
): TScenePictures => {
	const pictures = useSyncExternalStore(
		subscribe,
		() => cache.get(theme) ?? EMPTY,
		() => EMPTY,
	);
	useEffect(() => {
		let added = false;
		for (const source of sources) {
			const key = `${theme}:${source.id}`;
			if (!requested.has(key)) {
				requested.add(key);
				pending.push({ theme, source });
				added = true;
			}
		}
		if (added) {
			void work();
		}
	}, [theme, sources]);
	return pictures;
};
