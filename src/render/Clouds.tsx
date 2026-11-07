import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";

import { useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { cloudAltitudeOf, useSkyWeather } from "#/editor/weather";
import { skyLookAt } from "#/scene/sky";

import { ignoreRaycast } from "./SkyDome";

/** The most clouds, at a cloudiness of 1. */
const MAX_CLOUDS = 28;
/** Radians per second the ring of clouds turns at a cloud speed of 1. */
const DRIFT = 0.004;

/** The same "random" numbers every time, so a world's clouds don't jump around between visits. */
const seeded = (seed: number) => {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

interface ICloud {
	position: [number, number, number];
	/** Its puffs, around its middle: where, and how big. */
	puffs: { at: [number, number, number]; size: number }[];
}

/** Clouds on a wide ring around and above the world, far enough out to stay clear of it. */
const cloudsFor = (count: number, reach: number, height: number): ICloud[] => {
	const random = seeded(7);
	const radius = reach * 0.9 + 40;
	return Array.from({ length: count }, (_, i) => {
		const angle = ((i + random() * 0.6) / count) * Math.PI * 2;
		const distance = radius * (0.75 + random() * 0.5);
		const size = 4 + random() * 5;
		return {
			position: [
				Math.cos(angle) * distance,
				height * (0.8 + random() * 0.4),
				Math.sin(angle) * distance,
			],
			puffs: Array.from({ length: 3 + Math.floor(random() * 4) }, (_, p) => ({
				at: [(p - 1.5) * size * 0.8, random() * size * 0.4, (random() - 0.5) * size],
				size: size * (0.6 + random() * 0.5),
			})),
		};
	});
};

/**
 * Low-poly clouds in the sky in perspective (ADR-0070): flat-shaded puffs,
 * lit like the world, drifting slowly round it while motion plays. Like the
 * sky, the pointer passes through them. How many, their colour, speed and
 * height and how see-through they are come from the world's weather
 * (scene/sky, `cloudAltitude`, `cloudTransparency`).
 */
export const Clouds = () => {
	const perspective = useEditor((s) => s.projection === "perspective");
	const sky = useEditor((s) => s.scene.sky);
	const lighting = useEditor((s) => s.scene.lighting);
	const ground = useEditor((s) => s.scene.ground);
	const playing = useEditor((s) => s.playing);
	const hour = useSceneHours();
	const ring = useRef<THREE.Group>(null);
	const look = skyLookAt(lighting, sky, hour, useSkyWeather());
	const count = Math.round(look.cloudCover * MAX_CLOUDS);
	const cloudAltitude = useEditor((s) => s.scene.weather.cloudAltitude);
	const transparency = useEditor((s) => s.scene.weather.cloudTransparency);
	const clouds = useMemo(() => {
		const reach = Math.max(ground.width, ground.depth);
		return cloudsFor(count, reach, cloudAltitudeOf({ cloudAltitude }, { reach }));
	}, [count, ground.width, ground.depth, cloudAltitude]);

	useFrame((_, delta) => {
		if (ring.current && playing) {
			ring.current.rotation.y += look.cloudSpeed * DRIFT * Math.min(delta, 0.1);
		}
	});

	if (!perspective || !sky.showsInPerspective || count === 0) {
		return null;
	}
	return (
		<group ref={ring}>
			{clouds.map((cloud, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: clouds are positional and never reordered
				<group key={i} position={cloud.position}>
					{cloud.puffs.map((puff, p) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: puffs are positional and never reordered
						<mesh key={p} position={puff.at} scale={puff.size} raycast={ignoreRaycast}>
							<icosahedronGeometry args={[1, 1]} />

							{/* A glow of their own colour, so they never go black at night (as if moonlit). */}
							<meshStandardMaterial
								color={look.cloudColor}
								emissive={look.cloudColor}
								emissiveIntensity={0.35}
								flatShading
								roughness={1}
								// See-through clouds (cloudTransparency) blend over each other rather than hide.
								transparent={transparency > 0}
								opacity={1 - transparency}
								depthWrite={transparency === 0}
							/>
						</mesh>
					))}
				</group>
			))}
		</group>
	);
};
