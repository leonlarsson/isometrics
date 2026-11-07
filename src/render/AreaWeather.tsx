import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { sceneHoursNow, useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import {
	areaWeathersInWorld,
	areaWeathersNow,
	type IAreaWeatherNow,
	weatherMapAmountsOf,
	weatherNowInWorld,
} from "#/editor/weather";
import { useWorldData } from "#/editor/worldData";
import { mixColor } from "#/lib/color";
import { motionClock } from "#/lib/motionClock";
import { jitter } from "#/parts/primitives";
import { isInsidePolygon, polygonArea } from "#/scene/areas";
import { skyLookAt } from "#/scene/sky";
import { skyLightAt } from "#/scene/sun";
import { type IWeatherMap, WEATHER_MAP_STRIDE, weatherMapOf } from "#/scene/weatherMap";

import { ignoreRaycast } from "./SkyDome";
import { MOST_FLASHES, weatherShading } from "./weatherShading";

/**
 * Areas' own weather in the view (ADR-0151): the weather map every weather
 * shader reads (rain, snow and splashes in render/Weather, snow, wetness,
 * fog, haze and the light in render/weatherShading), the clouds gathered over
 * areas with cloud cover, and their lightning. Mounted only while an area has
 * weather of its own.
 */

/** The weather's fog and haze, as the world's (render/DistanceHaze): grey-white, darkening with the night. */
const FOG_DAY = "#cdd3d9";
const FOG_NIGHT = "#252a33";
const HAZE = "#f4ecdc";
/** What storm clouds turn towards. */
const STORM_GREY = "#525965";
/** How high clouds float over an area's top: over houses and trees, low enough to read as over the area. */
const CLOUD_HEIGHT = 9;
/** Where an area's own rain and snow start falling (render/Weather): just under its clouds. */
export const AREA_CLOUD_BASE = CLOUD_HEIGHT + 0.5;
/** At most this many puffs, all areas together. */
const MOST_PUFFS = 1600;

/** A number from an id, the same every time, to vary areas from each other. */
const seedOf = (id: string) => {
	let hash = 2166136261;
	for (let i = 0; i < id.length; i++) {
		hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
	}
	return ((hash >>> 0) % 10000) / 10.7;
};

/** Up to `count` places inside an area's outline, the same every time. */
const placesInside = (points: readonly (readonly number[])[], count: number, seed: number) => {
	let minX = Number.POSITIVE_INFINITY;
	let minZ = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxZ = Number.NEGATIVE_INFINITY;
	for (const [x, z] of points) {
		minX = Math.min(minX, x);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxZ = Math.max(maxZ, z);
	}
	const places: [number, number][] = [];
	for (let tries = 0; places.length < count && tries < count * 30; tries++) {
		const x = minX + jitter(seed + tries * 1.37) * (maxX - minX);
		const z = minZ + jitter(seed + tries * 2.71 + 0.5) * (maxZ - minZ);
		if (isInsidePolygon([x, z], points)) {
			places.push([x, z]);
		}
	}
	return places;
};

/** Four of the map's numbers per texel (by their place in it, -1 for none), as a texture's bytes. */
const mapBytes = (map: IWeatherMap, channels: readonly number[]) => {
	const texels = map.width * map.depth;
	const bytes = new Uint8Array(texels * 4);
	for (let t = 0; t < texels; t++) {
		for (let c = 0; c < 4; c++) {
			const k = channels[c];
			bytes[t * 4 + c] = k < 0 ? 0 : Math.round(map.values[t * WEATHER_MAP_STRIDE + k] * 255);
		}
	}
	return bytes;
};

const COVERAGE = WEATHER_MAP_STRIDE - 1;
/** Which of the map's numbers each texture holds (scene/weatherMap's order), -1 for nothing. */
const TEXTURE_CHANNELS = {
	mapA: [0, 1, 2, 3],
	mapB: [4, 5, 6, COVERAGE],
	mapC: [7, -1, -1, COVERAGE],
} as const;

const mapTexture = (map: IWeatherMap, channels: readonly number[]) => {
	const texture = new THREE.DataTexture(mapBytes(map, channels), map.width, map.depth);
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearFilter;
	texture.wrapS = THREE.ClampToEdgeWrapping;
	texture.wrapT = THREE.ClampToEdgeWrapping;
	texture.needsUpdate = true;
	return texture;
};

/**
 * Keeps the weather map in step with the areas' own weathers: worked out again
 * when an area or a value changes (each outline's coverage is kept, so a
 * change of amounts only mixes it again), never per frame.
 */
const useWeatherMap = (weathers: readonly IAreaWeatherNow[]) => {
	useLayoutEffect(() => {
		const map = weatherMapOf(
			weathers.map(({ area, now }) => ({ points: area.points, amounts: weatherMapAmountsOf(now) })),
		);
		if (!map) {
			return;
		}
		const u = weatherShading.uniforms;
		const before = [u.mapA.value, u.mapB.value, u.mapC.value];
		u.mapA.value = mapTexture(map, TEXTURE_CHANNELS.mapA);
		u.mapB.value = mapTexture(map, TEXTURE_CHANNELS.mapB);
		u.mapC.value = mapTexture(map, TEXTURE_CHANNELS.mapC);
		// From texel centres: the first lies at minX, so the texture starts half a texel before.
		u.mapBounds.value.set(
			map.minX - map.cell / 2,
			map.minZ - map.cell / 2,
			1 / (map.width * map.cell),
			1 / (map.depth * map.cell),
		);
		for (const texture of before) {
			texture.dispose();
		}
	}, [weathers]);
};

interface IPuff {
	at: THREE.Vector3;
	size: number;
	/** Which area's it is, in the list, and a phase for its drift. */
	area: number;
	phase: number;
}

/** The puffs of the clouds gathered over each area with cloud cover: more for more cover and bigger areas. */
const puffsOf = (weathers: readonly IAreaWeatherNow[]) => {
	const puffs: IPuff[] = [];
	weathers.forEach(({ area, now }, index) => {
		if (now.cloudCover <= 0) {
			return;
		}
		const seed = seedOf(area.id);
		const size = Math.sqrt(Math.abs(polygonArea(area.points)));
		const count = Math.max(1, Math.min(30, Math.round(now.cloudCover * size * 0.55)));
		const scale = Math.min(2.2, 0.8 + size / 40);
		for (const [c, [x, z]] of placesInside(area.points, count, seed).entries()) {
			const height = area.height + CLOUD_HEIGHT + jitter(seed + c * 3.1) * 3;
			const pieces = 3 + Math.floor(jitter(seed + c * 5.3) * 3);
			for (let p = 0; p < pieces && puffs.length < MOST_PUFFS; p++) {
				const r = jitter(seed + c * 7.7 + p);
				puffs.push({
					at: new THREE.Vector3(
						x + (p - (pieces - 1) / 2) * 1.6 * scale,
						height + r * 0.8 * scale,
						z + (jitter(seed + c * 9.1 + p) - 0.5) * 2 * scale,
					),
					size: (1.4 + r * 1.2) * scale,
					area: index,
					phase: jitter(seed + c * 11.3) * Math.PI * 2,
				});
			}
		}
	});
	return puffs;
};

const puffMatrix = new THREE.Matrix4();
const puffQuaternion = new THREE.Quaternion();
const puffScale = new THREE.Vector3();
const puffAt = new THREE.Vector3();
const puffColor = new THREE.Color();

/**
 * Clouds over areas (both views, unlike the world's ring of them): flat-shaded
 * puffs over each area with cloud cover, greyer as it rains, snows or storms,
 * tinted by the time of day as the world's are, drifting a little in place
 * while motion plays. One instanced draw for every area; the pointer passes
 * through them.
 */
const AreaClouds = ({ weathers }: { weathers: readonly IAreaWeatherNow[] }) => {
	const mesh = useRef<THREE.InstancedMesh>(null);
	const lighting = useEditor((s) => s.scene.lighting);
	const sky = useEditor((s) => s.scene.sky);
	const playing = useEditor((s) => s.playing);
	const hour = useSceneHours();
	const puffs = useMemo(() => puffsOf(weathers), [weathers]);
	const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
	const material = useMemo(() => {
		const made = new THREE.MeshStandardMaterial({
			flatShading: true,
			roughness: 1,
			// A glow of their own, so they never go black at night (as if moonlit).
			emissive: new THREE.Color("#1d2230"),
		});
		// Snow doesn't settle on clouds.
		made.userData.noWeather = true;
		return made;
	}, []);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(() => () => material.dispose(), [material]);

	const place = (seconds: number) => {
		const instanced = mesh.current;
		if (!instanced) {
			return;
		}
		puffs.forEach((puff, i) => {
			const speed = weathers[puff.area].now.cloudSpeed;
			const drift = Math.sin(seconds * 0.12 * speed + puff.phase) * 0.9;
			puffAt.set(puff.at.x + drift, puff.at.y, puff.at.z + drift * 0.4);
			puffScale.set(puff.size, puff.size * 0.62, puff.size);
			instanced.setMatrixAt(i, puffMatrix.compose(puffAt, puffQuaternion, puffScale));
		});
		instanced.instanceMatrix.needsUpdate = true;
	};

	useLayoutEffect(() => {
		const instanced = mesh.current;
		if (!instanced) {
			return;
		}
		instanced.count = puffs.length;
		place(motionClock.seconds);
		const colors = weathers.map(({ area, now }) => {
			const look = skyLookAt(lighting, sky, hour, {
				cloudCover: now.cloudCover,
				cloudColor: area.weather?.cloudColor ?? null,
				cloudSpeed: now.cloudSpeed,
				overcast: now.overcast,
			});
			const storm = Math.min(1, now.rain * 0.55 + now.lightning * 0.45 + now.snow * 0.15);
			return mixColor(look.cloudColor, STORM_GREY, storm);
		});
		puffs.forEach((puff, i) => {
			instanced.setColorAt(i, puffColor.set(colors[puff.area]));
		});
		if (instanced.instanceColor) {
			instanced.instanceColor.needsUpdate = true;
		}
	}, [puffs, weathers, lighting, sky, hour]);

	useFrame(() => {
		if (playing && puffs.length > 0) {
			place(motionClock.seconds);
		}
	});

	return (
		<instancedMesh
			ref={mesh}
			args={[geometry, material, Math.max(1, puffs.length)]}
			raycast={ignoreRaycast}
			frustumCulled={false}
		/>
	);
};

/** Seconds between flashes at the slowest rate and at the fastest (as the world's, render/Weather). */
const LIGHTNING_EVERY = { rarely: 14, often: 2.5 };

/** How bright a flash is `since` seconds after it struck: two quick pulses, then gone. */
const flashAt = (since: number) =>
	since < 0 || since > 0.45
		? 0
		: Math.max(Math.exp(-since * 28), 0.7 * Math.exp(-Math.abs(since - 0.18) * 30));

/** How many pieces a bolt is drawn in, and how many places in an area it can strike. */
const BOLT_PIECES = 8;
const STRIKE_PLACES = 24;

interface IStorm {
	index: number;
	seed: number;
	places: [number, number][];
	/** How far its flash lights round where it strikes. */
	reach: number;
	top: number;
}

const boltFrom = new THREE.Vector3();
const boltTo = new THREE.Vector3();
const boltMiddle = new THREE.Vector3();
const boltDirection = new THREE.Vector3();
const boltTurn = new THREE.Quaternion();
const boltSize = new THREE.Vector3();
const boltMatrix = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Lightning in areas: at each one's rate, a jagged bolt from its clouds to a
 * place inside it and a flash lighting what's round there (the weather's
 * shading, `flashes`), not the whole world. Timed by the motion clock, so
 * the same each time and held while paused; areas strike out of step. At most
 * `MOST_FLASHES` light the view at once.
 */
const AreaLightning = ({ weathers }: { weathers: readonly IAreaWeatherNow[] }) => {
	const bolts = useRef<THREE.InstancedMesh>(null);
	const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
	const material = useMemo(
		() => new THREE.MeshBasicMaterial({ color: "#f2f5ff", toneMapped: false, fog: false }),
		[],
	);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(() => () => material.dispose(), [material]);
	const storms = useMemo(
		() =>
			weathers.flatMap(({ area, now }, index): IStorm[] => {
				if (now.lightning <= 0) {
					return [];
				}
				const seed = seedOf(area.id);
				const size = Math.sqrt(Math.abs(polygonArea(area.points)));
				return [
					{
						index,
						seed,
						places: placesInside(area.points, STRIKE_PLACES, seed + 0.77),
						reach: Math.min(24, Math.max(8, size * 0.6)),
						top: area.height,
					},
				];
			}),
		[weathers],
	);
	useEffect(
		() => () => {
			for (const flash of weatherShading.uniforms.flashes.value) {
				flash.set(0, 0, 0, 0);
			}
		},
		[],
	);

	useFrame(() => {
		const t = motionClock.seconds;
		const lit: {
			x: number;
			z: number;
			reach: number;
			brightness: number;
			storm: IStorm;
			strike: number;
		}[] = [];
		const current = areaWeathersInWorld();
		for (const storm of storms) {
			const rate = current[storm.index]?.now.lightning ?? 0;
			if (rate <= 0 || storm.places.length === 0) {
				continue;
			}
			const every = THREE.MathUtils.lerp(LIGHTNING_EVERY.rarely, LIGHTNING_EVERY.often, rate);
			const shifted = t + storm.seed;
			const strike = Math.floor(shifted / every);
			const when = strike * every + jitter(strike + 0.29 + storm.seed) * every * 0.6;
			const brightness = flashAt(shifted - when);
			if (brightness <= 0.01) {
				continue;
			}
			const [x, z] =
				storm.places[Math.floor(jitter(strike * 1.9 + storm.seed) * storm.places.length)];
			lit.push({ x, z, reach: storm.reach, brightness, storm, strike });
		}
		lit.sort((a, b) => b.brightness - a.brightness);
		const flashes = weatherShading.uniforms.flashes.value;
		for (let i = 0; i < MOST_FLASHES; i++) {
			const flash = lit[i];
			flashes[i].set(
				flash?.x ?? 0,
				flash?.z ?? 0,
				flash?.reach ?? 0,
				flash ? 2.4 * flash.brightness : 0,
			);
		}
		// The bolts of the brightest, while they're bright enough to see.
		const instanced = bolts.current;
		if (!instanced) {
			return;
		}
		let count = 0;
		for (const flash of lit.slice(0, MOST_FLASHES)) {
			if (flash.brightness < 0.25) {
				continue;
			}
			const top = flash.storm.top + CLOUD_HEIGHT;
			const bottom = flash.storm.top;
			boltFrom.set(flash.x, top, flash.z);
			for (let piece = 1; piece <= BOLT_PIECES; piece++) {
				const along = piece / BOLT_PIECES;
				const wander = piece === BOLT_PIECES ? 0 : 1.3 * (1 - along * 0.5);
				boltTo.set(
					flash.x + (jitter(flash.strike + piece * 3.3 + flash.storm.seed) - 0.5) * 2 * wander,
					top + (bottom - top) * along,
					flash.z + (jitter(flash.strike + piece * 5.9 + flash.storm.seed) - 0.5) * 2 * wander,
				);
				const length = boltFrom.distanceTo(boltTo);
				boltMiddle.addVectors(boltFrom, boltTo).multiplyScalar(0.5);
				boltTurn.setFromUnitVectors(UP, boltDirection.subVectors(boltTo, boltFrom).normalize());
				boltSize.set(0.14, length, 0.14);
				instanced.setMatrixAt(count++, boltMatrix.compose(boltMiddle, boltTurn, boltSize));
				boltFrom.copy(boltTo);
			}
		}
		instanced.count = count;
		instanced.instanceMatrix.needsUpdate = count > 0;
	});

	return (
		<instancedMesh
			ref={bolts}
			args={[geometry, material, MOST_FLASHES * BOLT_PIECES]}
			raycast={ignoreRaycast}
			frustumCulled={false}
		/>
	);
};

/** Keeps the colours of areas' fog and haze with the time of day and the sky, each frame. */
const useFogColors = () => {
	useFrame(() => {
		const { lighting, sky } = useEditor.getState().scene;
		const hours = sceneHoursNow();
		const look = skyLookAt(lighting, sky, hours, weatherNowInWorld());
		const night = skyLightAt(lighting, hours).night;
		const u = weatherShading.uniforms;
		u.fogColor.value.set(mixColor(mixColor(FOG_DAY, FOG_NIGHT, night), look.colorAtHorizon, 0.25));
		u.hazeColor.value.set(
			mixColor(mixColor(look.colorAtHorizon, HAZE, 0.5), FOG_NIGHT, night * 0.7),
		);
	});
};

/**
 * Everything areas' own weathers draw beyond what falls (render/Weather) and
 * the shading. It reads the areas itself, so the view above it doesn't render
 * again when one changes.
 */
export const AreaWeather = () => {
	const areas = useEditor((s) => s.scene.areas);
	const data = useWorldData().values;
	const weathers = areaWeathersNow(areas, data);
	useWeatherMap(weathers);
	useFogColors();
	return (
		<>
			<AreaClouds weathers={weathers} />

			<AreaLightning weathers={weathers} />
		</>
	);
};
