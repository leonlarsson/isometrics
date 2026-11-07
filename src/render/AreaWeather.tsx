import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { sceneHoursNow, useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import {
	areaWeathersInWorld,
	areaWeathersNow,
	cloudAltitudeOf,
	type IAreaWeatherNow,
	weatherMapAmountsOf,
	weatherNowInWorld,
} from "#/editor/weather";
import { useWorldData } from "#/editor/worldData";
import { mixColor } from "#/lib/color";
import { motionClock } from "#/lib/motionClock";
import { jitter } from "#/parts/primitives";
import { isHiddenArea, isInsidePolygon, polygonArea } from "#/scene/areas";
import type { TScene } from "#/scene/schema";
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
/**
 * When see-through clouds are drawn: after everything else (solid and see-through, drawn at 0),
 * their unseen depth first, then their paint (render/Clouds too).
 */
export const SEE_THROUGH_ORDER = { depth: 10, paint: 11 } as const;

/** At most this many puffs, all areas together. */
const MOST_PUFFS = 6000;

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
	mapC: [7, 8, -1, COVERAGE],
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
			weathers.map(({ area, now }) => ({
				points: area.points,
				amounts: weatherMapAmountsOf(area, now),
			})),
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

/** How far apart clouds stand on an area's grid, in grid units, unless the area is too big for it. */
const CLOUD_SPACING = 4.5;
/** At most this many clouds over one area: a bigger one gets bigger clouds rather than more. */
const MOST_CLOUDS_PER_AREA = 300;

/**
 * The puffs of the clouds over each area with cloud cover, on a grid laid over
 * its outline (jittered, so it doesn't read as one): at 100% a cloud at every
 * spot of it, close enough to overlap, so the whole area is under cloud; less
 * cover leaves out spots in a scattered order (the same every time), so 50% is
 * about half the area. Each cloud is a few puffs filling its spot.
 */
const puffsOf = (weathers: readonly IAreaWeatherNow[]) => {
	const puffs: IPuff[] = [];
	weathers.forEach(({ area, now }, index) => {
		if (now.cloudCover <= 0) {
			return;
		}
		const seed = seedOf(area.id);
		let minX = Number.POSITIVE_INFINITY;
		let minZ = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxZ = Number.NEGATIVE_INFINITY;
		for (const [x, z] of area.points) {
			minX = Math.min(minX, x);
			minZ = Math.min(minZ, z);
			maxX = Math.max(maxX, x);
			maxZ = Math.max(maxZ, z);
		}
		const spacing = Math.max(
			CLOUD_SPACING,
			Math.sqrt(Math.abs(polygonArea(area.points)) / MOST_CLOUDS_PER_AREA),
		);
		const altitude = cloudAltitudeOf(now, { area });
		// Spots on the grid that are over the area: its middle inside, or enough of it near the edge.
		const reach = spacing * 0.35;
		for (let gx = minX + spacing / 2; gx < maxX + spacing / 2; gx += spacing) {
			for (let gz = minZ + spacing / 2; gz < maxZ + spacing / 2; gz += spacing) {
				const over = [
					[gx, gz],
					[gx - reach, gz],
					[gx + reach, gz],
					[gx, gz - reach],
					[gx, gz + reach],
				].some((spot) => isInsidePolygon(spot, area.points));
				const key = seed + gx * 12.9898 + gz * 78.233;
				// Which spots a cover has: each its own place in a scattered order.
				if (!over || jitter(key) >= now.cloudCover) {
					continue;
				}
				const x = gx + (jitter(key + 1.1) - 0.5) * spacing * 0.3;
				const z = gz + (jitter(key + 2.3) - 0.5) * spacing * 0.3;
				const height = altitude + jitter(key + 3.1) * 2;
				const pieces = 3 + Math.floor(jitter(key + 5.3) * 3);
				for (let p = 0; p < pieces && puffs.length < MOST_PUFFS; p++) {
					const r = jitter(key + 7.7 + p);
					const turn = (p / pieces) * Math.PI * 2 + jitter(key + 9.1) * Math.PI;
					// Round the spot's middle, each puff about half a spot across, so neighbours overlap.
					const out = p === 0 ? 0 : spacing * 0.3;
					puffs.push({
						at: new THREE.Vector3(
							x + Math.cos(turn) * out,
							height + r * 0.15 * spacing,
							z + Math.sin(turn) * out,
						),
						size: spacing * (0.42 + r * 0.18),
						area: index,
						phase: jitter(key + 11.3) * Math.PI * 2,
					});
				}
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
 * The clouds' material: flat-shaded, glowing a little so they never go black
 * at night (as if moonlit), out of snow and areas' fog. See-through ones
 * blend (each puff's opacity from `cloudOpacity`) without hiding each other;
 * solid ones write depth, so their puffs hide what's behind them.
 */
const cloudMaterial = (seeThrough: boolean) => {
	const made = new THREE.MeshStandardMaterial({
		flatShading: true,
		roughness: 1,
		emissive: new THREE.Color("#1d2230"),
		transparent: seeThrough,
		depthWrite: !seeThrough,
	});
	made.userData.noWeather = true;
	made.userData.noAreaWeather = true;
	made.onBeforeCompile = (shader) => {
		shader.vertexShader = shader.vertexShader
			.replace(
				"#include <common>",
				"#include <common>\nattribute float cloudOpacity;\nvarying float vCloudOpacity;",
			)
			.replace("#include <begin_vertex>", "#include <begin_vertex>\nvCloudOpacity = cloudOpacity;");
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", "#include <common>\nvarying float vCloudOpacity;")
			.replace(
				"#include <opaque_fragment>",
				"#include <opaque_fragment>\ngl_FragColor.a *= vCloudOpacity;",
			);
	};
	return made;
};

interface IPuffBatchProps {
	puffs: readonly IPuff[];
	weathers: readonly IAreaWeatherNow[];
	/** Each area's cloud colour, by its place in `weathers`. */
	colors: readonly string[];
	seeThrough: boolean;
	playing: boolean;
}

/** One instanced draw of puffs: the solid clouds, or the see-through ones. */
const PuffBatch = ({ puffs, weathers, colors, seeThrough, playing }: IPuffBatchProps) => {
	const mesh = useRef<THREE.InstancedMesh>(null);
	// See-through clouds are drawn into depth first, unseen, then painted where they're nearest: each
	// cloud one see-through body, puffs never painted over the wrong way round. Both after everything
	// else (SEE_THROUGH_ORDER), so what's under and behind them is drawn before their depth hides it.
	const depthMesh = useRef<THREE.InstancedMesh>(null);
	const geometry = useMemo(() => {
		const made = new THREE.IcosahedronGeometry(1, 1);
		// Each puff's opacity, from its area's cloud transparency.
		made.setAttribute(
			"cloudOpacity",
			new THREE.InstancedBufferAttribute(new Float32Array(MOST_PUFFS).fill(1), 1),
		);
		return made;
	}, []);
	const material = useMemo(() => cloudMaterial(seeThrough), [seeThrough]);
	const depthMaterial = useMemo(() => {
		// The solid clouds' material, so its depth is exactly what the painted pass compares against;
		// among the see-through things, so it's drawn after all that's solid.
		const made = cloudMaterial(false);
		made.colorWrite = false;
		made.transparent = true;
		made.depthWrite = true;
		return made;
	}, []);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(() => () => material.dispose(), [material]);
	useEffect(() => () => depthMaterial.dispose(), [depthMaterial]);

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
		// The unseen depth pass shares the puffs' places.
		if (depthMesh.current) {
			depthMesh.current.instanceMatrix = instanced.instanceMatrix;
			depthMesh.current.count = puffs.length;
		}
		const opacity = geometry.getAttribute("cloudOpacity") as THREE.InstancedBufferAttribute;
		puffs.forEach((puff, i) => {
			instanced.setColorAt(i, puffColor.set(colors[puff.area]));
			opacity.setX(i, 1 - weathers[puff.area].now.cloudTransparency);
		});
		if (instanced.instanceColor) {
			instanced.instanceColor.needsUpdate = true;
		}
		opacity.needsUpdate = true;
	}, [puffs, weathers, colors, material]);

	useFrame(() => {
		if (playing && puffs.length > 0) {
			place(motionClock.seconds);
		}
	});

	return (
		<>
			{seeThrough && (
				<instancedMesh
					ref={depthMesh}
					args={[geometry, depthMaterial, Math.max(1, puffs.length)]}
					renderOrder={SEE_THROUGH_ORDER.depth}
					raycast={ignoreRaycast}
					frustumCulled={false}
				/>
			)}

			<instancedMesh
				ref={mesh}
				args={[geometry, material, Math.max(1, puffs.length)]}
				renderOrder={seeThrough ? SEE_THROUGH_ORDER.paint : 0}
				raycast={ignoreRaycast}
				frustumCulled={false}
			/>
		</>
	);
};

/**
 * Clouds over areas (both views, unlike the world's ring of them): flat-shaded
 * puffs over each area with cloud cover, as see-through as its weather says
 * (`cloudTransparency`), greyer as it rains, snows or storms, tinted by the
 * time of day as the world's are, drifting a little in place while motion
 * plays. Two instanced draws for every area, the solid clouds and the
 * see-through ones (so solid ones keep hiding their own back puffs; the
 * see-through ones drawn unseen into depth first, so each shows as one
 * see-through body, in front of what's behind it); the
 * pointer passes through them.
 */
const AreaClouds = ({ weathers }: { weathers: readonly IAreaWeatherNow[] }) => {
	const lighting = useEditor((s) => s.scene.lighting);
	const sky = useEditor((s) => s.scene.sky);
	const playing = useEditor((s) => s.playing);
	const hour = useSceneHours();
	return (
		<CloudsOverAreas
			weathers={weathers}
			lighting={lighting}
			sky={sky}
			hour={hour}
			playing={playing}
		/>
	);
};

interface ICloudsOverAreasProps {
	weathers: readonly IAreaWeatherNow[];
	/** What tints them: the world's light and sky at an hour. */
	lighting: TScene["lighting"];
	sky: TScene["sky"];
	/** The hour shown (null: as the lighting says, `skyLookAt`). */
	hour: number | null;
	/** Whether they drift (motion playing); still, they stand where the motion clock left them. */
	playing: boolean;
}

/**
 * The clouds over areas, from what's passed in rather than the editor: the
 * view's (`AreaClouds`), and a world's picture's (render/scenePictures), so a
 * data map's card shows its weather.
 */
export const CloudsOverAreas = ({
	weathers,
	lighting,
	sky,
	hour,
	playing,
}: ICloudsOverAreasProps) => {
	const puffs = useMemo(() => puffsOf(weathers), [weathers]);
	const colors = useMemo(
		() =>
			weathers.map(({ area, now }) => {
				const look = skyLookAt(lighting, sky, hour, {
					cloudCover: now.cloudCover,
					cloudColor: area.weather?.cloudColor ?? null,
					cloudSpeed: now.cloudSpeed,
					overcast: now.overcast,
				});
				const storm = Math.min(1, now.rain * 0.55 + now.lightning * 0.45 + now.snow * 0.15);
				return mixColor(look.cloudColor, STORM_GREY, storm);
			}),
		[weathers, lighting, sky, hour],
	);
	const solid = useMemo(
		() => puffs.filter((puff) => weathers[puff.area].now.cloudTransparency === 0),
		[puffs, weathers],
	);
	const seeThrough = useMemo(
		// Clear ones (100%) aren't drawn at all.
		() =>
			puffs.filter((puff) => {
				const transparency = weathers[puff.area].now.cloudTransparency;
				return transparency > 0 && transparency < 1;
			}),
		[puffs, weathers],
	);

	return (
		<>
			<PuffBatch
				puffs={solid}
				weathers={weathers}
				colors={colors}
				seeThrough={false}
				playing={playing}
			/>

			<PuffBatch
				puffs={seeThrough}
				weathers={weathers}
				colors={colors}
				seeThrough
				playing={playing}
			/>
		</>
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
	/** Where its bolts start (its clouds) and end (its ground). */
	top: number;
	ground: number;
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
						top: cloudAltitudeOf(now, { area }),
						ground: isHiddenArea(area) ? 0 : area.height,
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
			const top = flash.storm.top;
			const bottom = flash.storm.ground;
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
	const data = useWorldData();
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
