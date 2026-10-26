import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { keepOnHotReload } from "#/lib/hot";
import type { IResolvedLight, TLightShape } from "#/parts/types";

/**
 * Real night lights (ADR-0072): lamps, windows, cabins and headlights that
 * light the streets, walls and water round them, as three.js point lights.
 * Each lit object puts a source where its light shines from (a part's
 * `realLight`); the view keeps a fixed number of point lights and gives them
 * to the lit sources nearest the middle of the view, each frame. A fixed
 * number, as three rebuilds every material's shader when the number of lights
 * changes. The painted glows and pools stay as they are.
 */

interface IRealLightSourceEntry {
	/** Where it shines from: placed in the object, so it moves, turns and scales with it. */
	anchor: THREE.Object3D;
	light: IResolvedLight;
	shape: TLightShape;
	/** How far it lights round it, in world units. */
	reach: number;
}

const sources = keepOnHotReload("realLightSources", () => new Map<string, IRealLightSourceEntry>());

/** How bright a real light is at level 1, by its shape: lamps are made to light the ground. */
const BRIGHTNESS: Record<TLightShape, number> = {
	pool: 4.5,
	beam: 3.5,
	windows: 2.2,
	glow: 4,
	lens: 1.5,
};

/**
 * How fast the light falls off with distance, by its shape: lamps and
 * headlights are bright close by; light from windows spreads in a broad wash.
 */
const DECAY: Record<TLightShape, number> = {
	pool: 1.6,
	beam: 1.6,
	windows: 0.9,
	glow: 1.3,
	lens: 1.6,
};

/** How far the light carries beyond the reach of its painted pool or glow. */
const REACH_FACTOR = 2.6;

/** Seconds a light takes to come up when it's handed a point light. */
const FADE_SECONDS = 0.25;

interface IRealLightSourceProps {
	id: string;
	at: [number, number, number];
	light: IResolvedLight;
	shape: TLightShape;
	reach: number;
}

/** One object's light as a source of real light, at `at` in the object's own space. */
export const RealLightSource = ({ id, at, light, shape, reach }: IRealLightSourceProps) => {
	const anchor = useRef<THREE.Group>(null);
	useLayoutEffect(() => {
		const object = anchor.current;
		if (!object) {
			return;
		}
		sources.set(id, { anchor: object, light, shape, reach });
		return () => {
			if (sources.get(id)?.anchor === object) {
				sources.delete(id);
			}
		};
	});
	return <group ref={anchor} position={at} />;
};

/** A light's brightness for three, from how bright it is now and how many of its panes are lit. */
export const realLightIntensity = (light: IResolvedLight, shape: TLightShape) =>
	light.level *
	BRIGHTNESS[shape] *
	(shape === "windows" ? Math.min(1, 0.4 + light.litPanes * 2) : 1);

/** The `count` candidates nearest, by `distanceTo` (any measure that grows with distance). */
export const pickNearest = <T,>(
	candidates: T[],
	count: number,
	distanceTo: (candidate: T) => number,
): T[] =>
	candidates
		.map((candidate) => ({ candidate, distance: distanceTo(candidate) }))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, count)
		.map(({ candidate }) => candidate);

const where = new THREE.Vector3();
const centre = new THREE.Vector3();

interface IRealLightsProps {
	count: number;
}

/** The view's real lights: `count` point lights for the lit sources nearest the view's middle. */
export const RealLights = ({ count }: IRealLightsProps) => {
	const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
	const lights = useMemo(
		() =>
			Array.from({ length: count }, () => {
				const light = new THREE.PointLight("#ffffff", 0, 1, 1.6);
				light.castShadow = false;
				return light;
			}),
		[count],
	);
	// Which source each point light shows, and how far it has faded in.
	const shown = useRef<{ id: string | null; fade: number }[]>([]);

	useFrame(({ camera }, delta) => {
		if (shown.current.length !== lights.length) {
			shown.current = lights.map(() => ({ id: null, fade: 0 }));
		}
		if (controls?.target) {
			centre.copy(controls.target);
		} else {
			camera.getWorldPosition(centre);
		}
		const lit = [...sources].filter(([, source]) => source.light.level > 0.01);
		const nearest = new Set(
			pickNearest(lit, lights.length, ([, source]) =>
				source.anchor.getWorldPosition(where).distanceToSquared(centre),
			).map(([id]) => id),
		);
		// Point lights keep the sources they show while those are still among the nearest; the rest go
		// to the newly nearest, fading in.
		const slots = shown.current;
		for (const slot of slots) {
			if (slot.id !== null && !nearest.has(slot.id)) {
				slot.id = null;
			}
		}
		const taken = new Set(slots.map((slot) => slot.id));
		const waiting = [...nearest].filter((id) => !taken.has(id));
		for (const slot of slots) {
			if (slot.id === null && waiting.length > 0) {
				slot.id = waiting.shift() ?? null;
				slot.fade = 0;
			}
		}
		slots.forEach((slot, i) => {
			const light = lights[i];
			const source = slot.id === null ? undefined : sources.get(slot.id);
			if (!source) {
				light.intensity = 0;
				return;
			}
			slot.fade = Math.min(1, slot.fade + delta / FADE_SECONDS);
			source.anchor.getWorldPosition(light.position);
			light.color.set(source.light.color);
			light.intensity = realLightIntensity(source.light, source.shape) * slot.fade;
			light.distance = source.reach * REACH_FACTOR;
			light.decay = DECAY[source.shape];
		});
	});

	return (
		<group>
			{lights.map((light) => (
				<primitive key={light.uuid} object={light} />
			))}
		</group>
	);
};
