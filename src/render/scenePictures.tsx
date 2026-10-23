import { RoundedBox } from "@react-three/drei";
import { createRoot, useThree } from "@react-three/fiber";
import { useEffect, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";

import { toRadians } from "#/lib/math";
import { getPart, resolveColors, resolveProps } from "#/parts/registry";
import { resolveTurns, turnSmoothing } from "#/scene/roads";
import { createRouteSampler } from "#/scene/routes";
import type { TEntity, TScene } from "#/scene/schema";
import { type IScenePalette, scenePalettes, type TResolvedTheme } from "#/scene/theme";

import { AreaBody } from "./AreaMesh";
import { RoadBody } from "./RoadMesh";
import { SceneLights } from "./SceneLights";
import { frameBoxIn } from "./thumbnails";

/**
 * Pictures of whole worlds (the starters in File → New world), rendered in
 * the browser from the worlds themselves, like the part thumbnails (ADR-0036):
 * the ground, areas, roads and objects as they stand when the world opens,
 * seen from the default angle on a transparent background. One offscreen
 * canvas renders what's asked for, then goes away; the images live in memory
 * only. See docs/adr/0047-new-world-dialog.md.
 */

export type TScenePictures = Readonly<Record<string, string>>;

/** A world to picture: `create` is only called when its picture is rendered. */
export interface IScenePictureSource {
	id: string;
	create: () => TScene;
}

/** CSS pixels; rendered at twice that for sharp cards. */
export const SCENE_PICTURE_SIZE = { width: 240, height: 150 };
const DPR = 2;
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
	const part = getPart(entity.kind);
	const road = entity.follow
		? scene.roads.find((candidate) => candidate.id === entity.follow?.roadId)
		: undefined;
	if (!part || !entity.follow || !road) {
		return {
			position: [entity.position[0], entity.elevation, entity.position[1]] as const,
			rotation: [0, toRadians(entity.rotation), toRadians(entity.pitch)] as const,
		};
	}
	const props = resolveProps(part, entity.props);
	const length = part.footprint(props)[0] * entity.scale;
	const turns = resolveTurns(scene.turns, road.turns, entity.follow.turns);
	const sample = createRouteSampler(road, scene.driving, {
		reverse: entity.follow.reverse,
		smoothing: turnSmoothing(turns, length),
	}).at(entity.follow.offset);
	return {
		position: [sample.position[0], entity.elevation + sample.height, sample.position[1]] as const,
		rotation: [0, sample.heading + toRadians(entity.rotation), sample.pitch] as const,
	};
};

interface IPictureEntityProps {
	entity: TEntity;
	scene: TScene;
	palette: IScenePalette;
	onReady: () => void;
}

const PictureEntity = ({ entity, scene, palette, onReady }: IPictureEntityProps) => {
	const part = getPart(entity.kind);
	if (!part) {
		return null;
	}
	const { position, rotation } = startPose(entity, scene);
	const { color, accent } = resolveColors(part, entity, palette);
	const Component = part.Component;
	return (
		<group position={position}>
			<group rotation={rotation} scale={entity.scale}>
				<Component
					props={resolveProps(part, entity.props)}
					color={color}
					accent={accent}
					palette={palette}
					playing={false}
					driving={entity.follow !== null}
					data={scene.data}
					onReady={part.rendersAsync ? onReady : undefined}
				/>
			</group>
		</group>
	);
};

interface IPictureProps {
	scene: TScene;
	palette: IScenePalette;
	onShot: (url: string) => void;
}

/** Shows one world, frames it, renders one frame and hands back the picture. */
const Picture = ({ scene, palette, onShot }: IPictureProps) => {
	const gl = useThree((s) => s.gl);
	const three = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const group = useRef<THREE.Group>(null);
	const shot = useRef(false);
	const entities = scene.entities.filter((entity) => !entity.hidden);
	const waiting = useRef(entities.filter((entity) => getPart(entity.kind)?.rendersAsync).length);

	const shoot = () => {
		if (shot.current || !group.current || !(camera instanceof THREE.OrthographicCamera)) {
			return;
		}
		shot.current = true;
		frameBoxIn(camera, box.setFromObject(group.current), SCENE_PICTURE_SIZE, FILL);
		gl.render(three, camera);
		onShot(gl.domElement.toDataURL("image/png"));
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
					<meshStandardMaterial color={scene.ground.color ?? palette.ground} roughness={0.95} />
				</RoundedBox>

				{scene.areas.map((area, index) =>
					area.hidden ? null : (
						<AreaBody key={area.id} area={area} layer={index} palette={palette} selected={false} />
					),
				)}

				{scene.roads.map((road, index) =>
					road.hidden ? null : (
						<RoadBody
							key={road.id}
							road={road}
							layer={index}
							palette={palette}
							ground={scene.ground}
							editing={false}
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

/** Render everything asked for so far, publishing each picture as soon as it's ready. */
const work = async () => {
	if (working) {
		return;
	}
	working = true;
	const canvas = document.createElement("canvas");
	const root = createRoot(canvas);
	try {
		await root.configure({
			gl: { alpha: true, antialias: true, preserveDrawingBuffer: true },
			shadows: "percentage",
			orthographic: true,
			camera: { near: 0.1, far: 500 },
			size: { ...SCENE_PICTURE_SIZE, top: 0, left: 0 },
			dpr: DPR,
			frameloop: "never",
		});
		for (let next = pending.shift(); next; next = pending.shift()) {
			const { theme, source } = next;
			await idle();
			try {
				const scene = source.create();
				const url = await new Promise<string>((resolve) => {
					root.render(
						<Picture
							key={`${theme}:${source.id}`}
							scene={scene}
							palette={scenePalettes[theme]}
							onShot={resolve}
						/>,
					);
				});
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
		root.unmount();
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
