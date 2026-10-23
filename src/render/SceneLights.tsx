import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import type { TScene } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { groundSpan } from "./cameraMath";

/** Towards the sun: high, from +x a little more than from +z. */
const SUN = new THREE.Vector3(0.6, 1.2, 0.4).normalize();
/** The shadow map's size; its pixels are spread over the area the sun's shadows cover. */
const SHADOW_MAP = 2048;
/** Room around the visible ground that keeps shadows near the edges of the view. */
const VIEW_MARGIN = 4;

/**
 * How far (ground units) shadow lookups are pushed out of surfaces, so a
 * surface doesn't shadow itself in stripes ("acne"): at least one shadow
 * pixel, which is bigger when the sun's shadows cover more ground.
 */
const normalBiasFor = (radius: number) => Math.max(0.03, ((2 * radius) / SHADOW_MAP) * 1.5);

// The shadow camera's axes (it looks from the sun towards its target, with +y up), for snapping.
const lightZ = SUN.clone();
const lightX = new THREE.Vector3(0, 1, 0).cross(lightZ).normalize();
const lightY = lightZ.clone().cross(lightX);
const centre = new THREE.Vector3();
const toCamera = new THREE.Vector3();

/** Point a sun at `centre`, its shadows covering `radius` around it. */
const aimSun = (light: THREE.DirectionalLight, radius: number) => {
	const distance = radius * 2 + 50;
	light.position.copy(centre).addScaledVector(SUN, distance);
	light.target.position.copy(centre);
	light.target.updateMatrixWorld();
	light.shadow.normalBias = normalBiasFor(radius);
	const camera = light.shadow.camera;
	if (camera.right !== radius || camera.far !== distance * 2) {
		Object.assign(camera, {
			left: -radius,
			right: radius,
			top: radius,
			bottom: -radius,
			near: 0.5,
			far: distance * 2,
		});
		camera.updateProjectionMatrix();
	}
};

/**
 * Half the width of the ground in view, from the camera's target outwards, in
 * ground units: the screen's width, and its height stretched by how low the
 * camera looks (the screen's height covers more ground at a low angle).
 */
const visibleRadius = (
	camera: THREE.Camera,
	target: THREE.Vector3,
	width: number,
	height: number,
) => {
	toCamera.subVectors(camera.position, target);
	const distance = toCamera.length();
	const lowness = Math.max(toCamera.y / Math.max(distance, 1e-6), 0.26);
	if (camera instanceof THREE.OrthographicCamera) {
		return Math.hypot(width / camera.zoom, height / camera.zoom / lowness) / 2;
	}
	if (camera instanceof THREE.PerspectiveCamera) {
		const across = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
		// Perspective sees far into the distance; shadows a few view-heights away still count.
		return (Math.hypot(across * camera.aspect, across / lowness) / 2) * 2.5;
	}
	return Number.POSITIVE_INFINITY;
};

interface ISunProps {
	ground: TScene["ground"];
	palette: IScenePalette;
}

/**
 * The editor's sun: its shadows cover the ground in view rather than all of
 * it, so they stay sharp on a big ground. The area grows and shrinks in steps
 * (so shadows don't crawl while zooming) and moves in whole shadow pixels (so
 * they don't shimmer while panning). Zoomed out, it covers the whole ground.
 */
const SunFollowingTheView = ({ ground, palette }: ISunProps) => {
	const light = useRef<THREE.DirectionalLight>(null);
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
	const size = useThree((s) => s.size);

	useFrame(() => {
		if (!light.current) {
			return;
		}
		const whole = groundSpan(ground) / 2 + VIEW_MARGIN;
		const target = controls?.target;
		const needed = target
			? visibleRadius(camera, target, size.width, size.height) + VIEW_MARGIN
			: Number.POSITIVE_INFINITY;
		// Steps of about 19% (a quarter of a doubling).
		const stepped = 2 ** (Math.ceil(Math.log2(Math.max(needed, 1)) * 4) / 4);
		if (!target || stepped >= whole) {
			centre.set(0, 0, 0);
			aimSun(light.current, whole);
			return;
		}
		// The view's centre, moved in whole shadow pixels across the sun's view.
		const texel = (2 * stepped) / SHADOW_MAP;
		centre.set(target.x, 0, target.z);
		const x = Math.round(centre.dot(lightX) / texel) * texel;
		const y = Math.round(centre.dot(lightY) / texel) * texel;
		const z = centre.dot(lightZ);
		centre.copy(lightX).multiplyScalar(x).addScaledVector(lightY, y).addScaledVector(lightZ, z);
		aimSun(light.current, stepped);
	});

	return (
		<directionalLight
			ref={light}
			castShadow
			intensity={palette.sunIntensity}
			shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
			shadow-bias={-0.0004}
		/>
	);
};

/** A sun whose shadows cover the whole ground (pictures of worlds, which don't move). */
const SunOverTheGround = ({ ground, palette }: ISunProps) => {
	const half = Math.max(ground.width, ground.depth) * 0.75;
	return (
		<directionalLight
			castShadow
			position={[half * 0.6, half * 1.2, half * 0.4]}
			intensity={palette.sunIntensity}
			shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
			shadow-camera-left={-half}
			shadow-camera-right={half}
			shadow-camera-top={half}
			shadow-camera-bottom={-half}
			shadow-camera-near={0.5}
			shadow-camera-far={half * 4}
			shadow-bias={-0.0004}
			shadow-normalBias={normalBiasFor(half)}
		/>
	);
};

interface ISceneLightsProps extends ISunProps {
	/** The editor's view: shadows cover what's on screen, sharp on any ground (see docs/adr/0049). */
	followView?: boolean;
}

/** The scene's sky, fill and sun. */
export const SceneLights = ({ ground, palette, followView = false }: ISceneLightsProps) => {
	return (
		<>
			<hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]} />

			<ambientLight intensity={palette.ambientIntensity} />

			{followView ? (
				<SunFollowingTheView ground={ground} palette={palette} />
			) : (
				<SunOverTheGround ground={ground} palette={palette} />
			)}
		</>
	);
};
