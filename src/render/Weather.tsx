import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { weatherNowInWorld } from "#/editor/weather";
import { motionClock } from "#/lib/motionClock";

import { pixelsPerUnitAt } from "./cameraMath";
import { installWeatherShading, weatherShading } from "./weatherShading";

/**
 * Weather in the view (ADR-0102): rain and snow falling in a box round what
 * the camera looks at, splashes where drops land, lightning now and then, and
 * snow and wetness on the ground (weatherShading). What falls is moved on the
 * GPU from the motion clock, so pausing holds it and big amounts stay cheap;
 * the amounts only change how many are drawn. Mounted only while there's
 * weather, so a clear world draws nothing more.
 */

/** At most this many raindrops, flakes and splashes; an amount of 1 draws them all. */
const MOST_DROPS = 6000;
const MOST_FLAKES = 4000;
const MOST_SPLASHES = 260;

/** Deterministic pseudo-random in [0, 1), so the field is the same every time. */
const random = (i: number) => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const target = new THREE.Vector3();

/**
 * The box what falls fills: centred on the camera's target, wide enough to
 * cover what's in view (from how big a ground unit shows), and as tall.
 */
const useFallBox = () => {
	const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
	return (camera: THREE.Camera, height: number) => {
		target.copy(controls?.target ?? target.set(0, 0, 0));
		const across = height / Math.max(1, pixelsPerUnitAt(camera, target, height));
		const radius = THREE.MathUtils.clamp(across * 0.75, 8, 90);
		return { center: target, radius, height: radius * 0.9 };
	};
};

const FALL_VERTEX = /* glsl */ `
	attribute vec3 seed;
	attribute float tip;
	uniform float time;
	uniform vec3 center;
	uniform float radius;
	uniform float height;
	uniform float speed;
	uniform float streak;
	uniform float sway;
	uniform float pointSize;
	varying float fade;
	void main() {
		// Its place in the box, falling and wrapping round. Across the ground it keeps its place in
		// the world as the box moves with the view, wrapping round at the box's sides.
		float y = fract(seed.y - time * speed / height) * height;
		vec2 low = center.xz - radius;
		vec2 xz = low + mod(seed.xz * 2.0 * radius - low, 2.0 * radius);
		vec3 position = vec3(
			xz.x + sin(time * 0.8 + seed.z * 40.0) * sway,
			center.y + y - streak * tip,
			xz.y + cos(time * 0.7 + seed.x * 40.0) * sway
		);
		// Thinner towards the box's edges and ends, so it has no hard sides.
		vec2 across = (position.xz - center.xz) / radius;
		fade = (1.0 - smoothstep(0.75, 1.0, length(across))) * smoothstep(0.0, 0.1, y / height);
		vec4 view = modelViewMatrix * vec4(position, 1.0);
		gl_Position = projectionMatrix * view;
		// Flakes: as big on screen as their size at the target, smaller farther away in perspective.
		gl_PointSize = pointSize * (projectionMatrix[3][3] > 0.5 ? 1.0 : clamp(30.0 / -view.z, 0.3, 3.0));
	}
`;

const RAIN_FRAGMENT = /* glsl */ `
	uniform vec3 color;
	uniform float opacity;
	varying float fade;
	void main() {
		gl_FragColor = vec4(color, opacity * fade);
	}
`;

const SNOW_FRAGMENT = /* glsl */ `
	uniform vec3 color;
	uniform float opacity;
	varying float fade;
	void main() {
		// A soft round flake.
		float d = length(gl_PointCoord - 0.5);
		if (d > 0.5) discard;
		gl_FragColor = vec4(color, opacity * fade * (1.0 - smoothstep(0.25, 0.5, d)));
	}
`;

const fallMaterial = (fragmentShader: string, color: string) =>
	new THREE.ShaderMaterial({
		vertexShader: FALL_VERTEX,
		fragmentShader,
		transparent: true,
		depthWrite: false,
		fog: false,
		uniforms: {
			time: { value: 0 },
			center: { value: new THREE.Vector3() },
			radius: { value: 20 },
			height: { value: 18 },
			speed: { value: 1 },
			streak: { value: 0 },
			sway: { value: 0 },
			pointSize: { value: 2 },
			color: { value: new THREE.Color(color) },
			opacity: { value: 1 },
		},
	});

/** A geometry of `count` things to fall: one vertex each (flakes), or two for a streak (rain). */
const fallGeometry = (count: number, streaks: boolean) => {
	const perOne = streaks ? 2 : 1;
	const seeds = new Float32Array(count * perOne * 3);
	const tips = new Float32Array(count * perOne);
	for (let i = 0; i < count; i++) {
		for (let end = 0; end < perOne; end++) {
			const at = i * perOne + end;
			seeds.set([random(i), random(i + 0.37), random(i + 0.71)], at * 3);
			tips[at] = end;
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		"position",
		new THREE.BufferAttribute(new Float32Array(count * perOne * 3), 3),
	);
	geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 3));
	geometry.setAttribute("tip", new THREE.BufferAttribute(tips, 1));
	// It moves on the GPU: never left out for being "off screen".
	geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Number.POSITIVE_INFINITY);
	return geometry;
};

/** Rain: thin streaks falling fast, as many as it rains. */
const Rain = () => {
	const geometry = useMemo(() => fallGeometry(MOST_DROPS, true), []);
	const material = useMemo(() => fallMaterial(RAIN_FRAGMENT, "#cdd8e4"), []);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(() => () => material.dispose(), [material]);
	const box = useFallBox();
	useFrame(({ camera, size }) => {
		const { rain } = weatherNowInWorld();
		const { center, radius, height } = box(camera, size.height);
		const u = material.uniforms;
		u.time.value = motionClock.seconds;
		u.center.value.copy(center);
		u.radius.value = radius;
		u.height.value = height;
		u.speed.value = 22;
		u.streak.value = 0.7;
		u.opacity.value = 0.25 + 0.3 * rain;
		geometry.setDrawRange(0, Math.round(rain * MOST_DROPS) * 2);
	});
	return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
};

/** Snow: soft flakes drifting down, as many as it snows. */
const Snow = () => {
	const geometry = useMemo(() => fallGeometry(MOST_FLAKES, false), []);
	const material = useMemo(() => fallMaterial(SNOW_FRAGMENT, "#ffffff"), []);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(() => () => material.dispose(), [material]);
	const box = useFallBox();
	useFrame(({ camera, size }) => {
		const { snow } = weatherNowInWorld();
		const { center, radius, height } = box(camera, size.height);
		const u = material.uniforms;
		u.time.value = motionClock.seconds;
		u.center.value.copy(center);
		u.radius.value = radius;
		u.height.value = height;
		u.speed.value = 1.6;
		u.sway.value = 0.5;
		u.pointSize.value = THREE.MathUtils.clamp(
			0.14 * pixelsPerUnitAt(camera, center, size.height),
			2,
			9,
		);
		u.opacity.value = 0.95;
		geometry.setDrawRange(0, Math.round(snow * MOST_FLAKES));
	});
	return <points geometry={geometry} material={material} frustumCulled={false} />;
};

const SPLASH_VERTEX = /* glsl */ `
	attribute vec3 seed;
	uniform float time;
	uniform vec3 center;
	uniform float radius;
	varying float life;
	void main() {
		// Each splash opens and fades, then opens again somewhere else.
		float cycle = time * 1.6 + seed.z * 10.0;
		life = fract(cycle);
		float round = floor(cycle);
		// Somewhere else each time, keeping its place in the world as the view moves (not following it).
		vec2 spot = vec2(fract(seed.x + round * 0.618), fract(seed.y + round * 0.414));
		vec2 low = center.xz - radius;
		vec2 at = low + mod(spot * 2.0 * radius - low, 2.0 * radius);
		vec3 world = vec3(at.x, 0.03, at.y);
		vec3 ring = position * (0.08 + 0.32 * life);
		gl_Position = projectionMatrix * viewMatrix * vec4(world + ring, 1.0);
	}
`;

const SPLASH_FRAGMENT = /* glsl */ `
	uniform vec3 color;
	uniform float opacity;
	varying float life;
	void main() {
		gl_FragColor = vec4(color, opacity * (1.0 - life));
	}
`;

/** Splashes: small rings opening on the ground where raindrops land, as many as it rains. */
const Splashes = () => {
	const geometry = useMemo(() => {
		const ring = new THREE.RingGeometry(0.75, 1, 14).rotateX(-Math.PI / 2);
		const instanced = new THREE.InstancedBufferGeometry().copy(
			ring as unknown as THREE.InstancedBufferGeometry,
		);
		const seeds = new Float32Array(MOST_SPLASHES * 3);
		for (let i = 0; i < MOST_SPLASHES; i++) {
			seeds.set([random(i + 0.13), random(i + 0.53), random(i + 0.91)], i * 3);
		}
		instanced.setAttribute("seed", new THREE.InstancedBufferAttribute(seeds, 3));
		instanced.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Number.POSITIVE_INFINITY);
		ring.dispose();
		return instanced;
	}, []);
	const material = useMemo(
		() =>
			new THREE.ShaderMaterial({
				vertexShader: SPLASH_VERTEX,
				fragmentShader: SPLASH_FRAGMENT,
				transparent: true,
				depthWrite: false,
				fog: false,
				uniforms: {
					time: { value: 0 },
					center: { value: new THREE.Vector3() },
					radius: { value: 10 },
					color: { value: new THREE.Color("#dfe7ef") },
					opacity: { value: 0.6 },
				},
			}),
		[],
	);
	useEffect(() => () => geometry.dispose(), [geometry]);
	useEffect(() => () => material.dispose(), [material]);
	const box = useFallBox();
	useFrame(({ camera, size }) => {
		const { rain } = weatherNowInWorld();
		const { center, radius } = box(camera, size.height);
		const u = material.uniforms;
		u.time.value = motionClock.seconds;
		u.center.value.copy(center);
		// Close round the middle of the view, where they can be seen.
		u.radius.value = radius * 0.55;
		geometry.instanceCount = Math.round(rain * MOST_SPLASHES);
	});
	return <mesh geometry={geometry} material={material} frustumCulled={false} />;
};

/** Seconds between flashes at the slowest rate and at the fastest. */
const LIGHTNING_EVERY = { rarely: 14, often: 2.5 };

/** How bright a flash is `since` seconds after it struck: two quick pulses, then gone. */
const flashAt = (since: number) =>
	since < 0 || since > 0.45
		? 0
		: Math.max(Math.exp(-since * 28), 0.7 * Math.exp(-Math.abs(since - 0.18) * 30));

/**
 * Lightning: now and then, a flash lights the world from above for a moment,
 * more often as the rate grows; timed by the motion clock, so the same each
 * time and held while paused.
 */
const Lightning = () => {
	const light = useRef<THREE.HemisphereLight>(null);
	useFrame(() => {
		if (!light.current) {
			return;
		}
		const { lightning } = weatherNowInWorld();
		const every = THREE.MathUtils.lerp(LIGHTNING_EVERY.rarely, LIGHTNING_EVERY.often, lightning);
		const t = motionClock.seconds;
		const strike = Math.floor(t / every);
		// Somewhere in the first part of each stretch, a different place each time.
		const when = strike * every + random(strike + 0.29) * every * 0.6;
		light.current.intensity = lightning > 0 ? 3.2 * flashAt(t - when) : 0;
	});
	return <hemisphereLight ref={light} args={["#e9efff", "#9aa3c4", 0]} />;
};

/** Everything the weather draws, each piece only while its amount is above nothing. */
export const Weather = ({
	rain,
	snow,
	splashes,
	lightning,
}: {
	rain: boolean;
	snow: boolean;
	splashes: boolean;
	lightning: boolean;
}) => (
	<>
		{rain && <Rain />}

		{snow && <Snow />}

		{splashes && <Splashes />}

		{lightning && <Lightning />}
	</>
);

/**
 * Keeps the weather's shading in step: on while there's snow or wetness (the
 * scene's materials recompiled when that changes), its values each frame.
 */
export const WeatherShading = ({ on }: { on: boolean }) => {
	const scene = useThree((s) => s.scene);
	const gl = useThree((s) => s.gl);
	useLayoutEffect(() => {
		installWeatherShading();
		weatherShading.renderer = gl;
		if (weatherShading.enabled === on) {
			return;
		}
		weatherShading.enabled = on;
		scene.traverse((object) => {
			const materials = (object as THREE.Mesh).material;
			for (const material of Array.isArray(materials) ? materials : materials ? [materials] : []) {
				// Its programs let go, so the next draw compiles it afresh and attaches the weather's
				// values: three reuses a program it compiled for a material before without running
				// onBeforeCompile, which left the values from the last compile (no snow) in place.
				if (material instanceof THREE.MeshStandardMaterial) {
					material.dispose();
					material.needsUpdate = true;
				}
			}
		});
	}, [on, scene, gl]);
	useFrame(() => {
		const { snowCover, wetness } = weatherNowInWorld();
		weatherShading.uniforms.snowCover.value = snowCover;
		weatherShading.uniforms.wetness.value = wetness;
	});
	return null;
};
