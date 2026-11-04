import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { MOST_LIVE_REAL_LIGHTS } from "#/editor/graphics";
import { useEditor } from "#/editor/store";
import { keepOnHotReload } from "#/lib/hot";
import type { IResolvedLight, TLightShape } from "#/parts/types";

/**
 * Real night lights (ADR-0072, ADR-0074, ADR-0144): lamps, windows, cabins and
 * headlights that light the streets, walls and water round them, as three.js
 * point lights. Each lit object puts a source where its light shines from (a
 * part's `realLight`); the view keeps a fixed number of point lights and, each
 * frame, gives them to the lit sources best placed in the picture: whose light
 * reaches into it, nearest its middle. The farthest of those fade out, so where
 * real light gives way to painted glows is a soft falloff, not a ring. A fixed
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

/** Seconds a light takes to go from nothing to full, or back, as its fade changes. */
const FADE_SECONDS = 0.25;

/**
 * How much of the picked lights' range of places, from the first left out inwards, fades: the
 * picked lights farthest out are dim and the last is all but dark (ADR-0144).
 */
const EDGE_SHARE = 0.35;

/**
 * Uniform vectors (a fragment shader's room for its inputs) each point light takes, at most: three
 * gives every material all of them (a position, a colour, a distance and a decay; a card may pad
 * each to a vector of its own).
 */
const VECTORS_PER_LIGHT = 4;

/** Uniform vectors left for everything else a material takes in (the sun and its shadows, the sky's light, textures, the weather's shading). */
const VECTORS_FOR_THE_REST = 256;

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
	(shape === "windows" ? Math.min(1, 0.4 + light.litPaneShare * 2) : 1);

/**
 * How many point lights the view may have, given how many it asks for and how many fragment
 * uniform vectors the graphics card gives a shader: up to the live view's most (64) as asked, as
 * the live view always has; beyond that (a still picture's) only as many as fit, with room left
 * for everything else, so no material's shader fails to compile.
 */
export const lightsTheCardHolds = (count: number, fragmentUniformVectors: number) =>
	count <= MOST_LIVE_REAL_LIGHTS
		? count
		: Math.max(
				MOST_LIVE_REAL_LIGHTS,
				Math.min(
					count,
					Math.floor((fragmentUniformVectors - VECTORS_FOR_THE_REST) / VECTORS_PER_LIGHT),
				),
			);

/**
 * The `count` candidates nearest, nearest first, by `distanceTo` (any measure that grows with
 * distance; null leaves a candidate out). Kept as they come, only the nearest few at a time, not
 * every one sorted: it runs each frame over every lit source. Of equal distances, the earlier wins.
 */
export const pickNearest = <T,>(
	candidates: Iterable<T>,
	count: number,
	distanceTo: (candidate: T) => number | null,
): T[] => {
	const nearest: T[] = [];
	const distances: number[] = [];
	if (count <= 0) {
		return nearest;
	}
	for (const candidate of candidates) {
		const distance = distanceTo(candidate);
		if (distance === null || (nearest.length === count && distance >= distances[count - 1])) {
			continue;
		}
		// After every one as near or nearer, so the earlier of equals stays first.
		let at = nearest.length;
		while (at > 0 && distances[at - 1] > distance) {
			at--;
		}
		nearest.splice(at, 0, candidate);
		distances.splice(at, 0, distance);
		if (nearest.length > count) {
			nearest.pop();
			distances.pop();
		}
	}
	return nearest;
};

/**
 * How strong each picked light is, from `places`: the places in the view of the best candidates,
 * best (lowest) first, `count` picked and then, if there were more, the first left out. With none
 * left out every light is full. Otherwise each fades from full to nothing across the outer
 * EDGE_SHARE of the range from the best place to the first left out's: a light's strength follows
 * its place, which moves smoothly with the camera, and is nothing where it changes hands.
 */
export const edgeFade = (places: readonly number[], count: number): number[] => {
	if (places.length <= count) {
		return places.map(() => 1);
	}
	const leftOut = places[count];
	const band = EDGE_SHARE * (leftOut - places[0]);
	return places.slice(0, count).map((place) => {
		if (band <= 0) {
			return 1;
		}
		const t = Math.min(1, Math.max(0, (leftOut - place) / band));
		return t * t * (3 - 2 * t);
	});
};

/** Across and up the picture, in halves of its width and height. */
interface IOnScreen {
	x: number;
	y: number;
}

/**
 * Where a light is in the picture, for choosing which are real (lower is better): how far it is
 * from the middle in a rounded rectangle the shape of the picture (0 in the middle, 1 at its
 * edges), so the lights chosen fill the frame's shape rather than a disc. null when its light
 * doesn't reach into the picture. `at` is its place on screen (-1…1 across and up), `range` how far
 * its light carries there.
 */
export const placeInView = (at: IOnScreen, range: IOnScreen): number | null => {
	const outX = Math.max(0, Math.abs(at.x) - 1) / range.x;
	const outY = Math.max(0, Math.abs(at.y) - 1) / range.y;
	if (outX * outX + outY * outY >= 1) {
		return null;
	}
	return (at.x ** 4 + at.y ** 4) ** 0.25;
};

const where = new THREE.Vector3();
const seen = new THREE.Vector3();

/** Each candidate's place in the view this frame, by id: kept, not made anew each frame. */
const placeOf = new Map<string, number>();

interface IRealLightsProps {
	/** How many point lights: the graphics setting's, or a still picture's (capped by the card). */
	count: number;
}

/** The view's real lights: point lights for the lit sources best placed in the picture (ADR-0144). */
export const RealLights = ({ count }: IRealLightsProps) => {
	const gl = useThree((s) => s.gl);
	const rendering = useEditor((s) => s.stillRender !== null);
	const holds = useMemo(() => {
		const context = gl.getContext();
		return lightsTheCardHolds(
			count,
			context.getParameter(context.MAX_FRAGMENT_UNIFORM_VECTORS) as number,
		);
	}, [gl, count]);
	const lights = useMemo(
		() =>
			Array.from({ length: holds }, () => {
				const light = new THREE.PointLight("#ffffff", 0, 1, 1.6);
				light.castShadow = false;
				return light;
			}),
		[holds],
	);
	// Which source each point light shows, and how strong it is now (easing to its fade).
	const shown = useRef<{ id: string | null; strength: number }[]>([]);

	useFrame(({ camera }, delta) => {
		if (shown.current.length !== lights.length) {
			shown.current = lights.map(() => ({ id: null, strength: 0 }));
		}
		// How much a world unit at a depth of 1 is across and up the picture.
		const [across, , , , , up] = camera.projectionMatrix.elements;
		const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
		placeOf.clear();
		// One more than there are lights: the first left out sets where the fade ends.
		const best = pickNearest(sources, lights.length + 1, ([id, source]) => {
			if (source.light.level <= 0.01) {
				return null;
			}
			seen.copy(source.anchor.getWorldPosition(where)).applyMatrix4(camera.matrixWorldInverse);
			// Sizes on screen shrink with distance in perspective; not in the diorama.
			const depth = perspective ? -seen.z : 1;
			if (depth <= 0) {
				return null;
			}
			seen.applyMatrix4(camera.projectionMatrix);
			const range = (source.reach * REACH_FACTOR) / depth;
			const place = placeInView(seen, { x: range * across, y: range * up });
			if (place !== null) {
				placeOf.set(id, place);
			}
			return place;
		});
		const fades = edgeFade(
			best.map(([id]) => placeOf.get(id) ?? 0),
			lights.length,
		);
		const fadeOf = new Map(best.slice(0, lights.length).map(([id], i) => [id, fades[i]]));
		// Point lights keep the sources they show while those are still picked; the rest go to the
		// newly picked, coming up from nothing.
		const slots = shown.current;
		for (const slot of slots) {
			if (slot.id !== null && !fadeOf.has(slot.id)) {
				slot.id = null;
			}
		}
		const taken = new Set(slots.map((slot) => slot.id));
		const waiting = [...fadeOf.keys()].filter((id) => !taken.has(id));
		for (const slot of slots) {
			if (slot.id === null && waiting.length > 0) {
				slot.id = waiting.shift() ?? null;
				slot.strength = 0;
			}
		}
		// A still picture takes its lights as they are: it doesn't wait for them to ease.
		const step = rendering ? 1 : delta / FADE_SECONDS;
		slots.forEach((slot, i) => {
			const light = lights[i];
			const source = slot.id === null ? undefined : sources.get(slot.id);
			if (!source || slot.id === null) {
				light.intensity = 0;
				return;
			}
			const fade = fadeOf.get(slot.id) ?? 0;
			slot.strength += Math.max(-step, Math.min(step, fade - slot.strength));
			source.anchor.getWorldPosition(light.position);
			light.color.set(source.light.color);
			light.intensity = realLightIntensity(source.light, source.shape) * slot.strength;
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
