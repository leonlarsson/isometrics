import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { advanceDayCycle, sceneHoursNow } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { tintColor } from "#/lib/color";
import type { TLighting, TScene } from "#/scene/schema";
import { type ISkyLight, skyLightAt } from "#/scene/sun";
import type { IScenePalette } from "#/scene/theme";

import { groundSpan } from "./cameraMath";
import { directionOf } from "./viewpoints";

/** The shadow map's size; its pixels are spread over the area the sun's shadows cover. */
const SHADOW_MAP = 2048;
/** Room around the visible ground that keeps shadows near the edges of the view. */
const VIEW_MARGIN = 4;
/** A sun lower than this (degrees) would cast endless shadows; it lights from here at least. */
const LOWEST_SHADOW_SUN = 6;

/**
 * How far (ground units) shadow lookups are pushed out of surfaces, so a
 * surface doesn't shadow itself in stripes ("acne"): at least one shadow
 * pixel, which is bigger when the sun's shadows cover more ground.
 */
const normalBiasFor = (radius: number) => Math.max(0.03, ((2 * radius) / SHADOW_MAP) * 1.5);

/** Towards the sun (or the moon) from the ground, for a light's direction in degrees. */
const sunDirectionOf = (light: Pick<ISkyLight, "azimuth" | "elevation">) =>
	directionOf(light.azimuth, Math.max(light.elevation, LOWEST_SHADOW_SUN));

// The sun's direction and its shadow camera's axes (looking from the sun, +y up), for snapping.
const sun = new THREE.Vector3();
const lightX = new THREE.Vector3();
const lightY = new THREE.Vector3();
const centre = new THREE.Vector3();
const toCamera = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/** Point a sun at `centre` from `sun`, its shadows covering `radius` around it. */
const aimSun = (light: THREE.DirectionalLight, radius: number) => {
	const distance = radius * 2 + 50;
	light.position.copy(centre).addScaledVector(sun, distance);
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

interface ILights {
	sun: THREE.DirectionalLight | null;
	sky: THREE.HemisphereLight | null;
	ambient: THREE.AmbientLight | null;
}

/** Colour and strengthen the lights for the time of day (the theme's own light at full day). */
const lightFor = (lights: ILights, sky: ISkyLight, palette: IScenePalette) => {
	lights.sun?.color.set(sky.color);
	if (lights.sun) {
		lights.sun.intensity = palette.sunIntensity * sky.strength;
	}
	if (lights.sky) {
		lights.sky.color.set(tintColor(palette.hemiSky, sky.tint, sky.tintAmount));
		lights.sky.groundColor.set(tintColor(palette.hemiGround, sky.tint, sky.tintAmount * 0.6));
		lights.sky.intensity = palette.hemiIntensity * sky.fill;
	}
	if (lights.ambient) {
		lights.ambient.intensity = palette.ambientIntensity * sky.fill;
	}
};

interface ISunProps {
	ground: TScene["ground"];
	palette: IScenePalette;
	lighting: TLighting;
	lights: ILights;
}

/**
 * The editor's sun: placed and coloured for the time of day every frame (it
 * moves while a day cycle plays), its shadows covering the ground in view
 * rather than all of it, so they stay sharp on a big ground. The area grows
 * and shrinks in steps (so shadows don't crawl while zooming) and moves in
 * whole shadow pixels (so they don't shimmer while panning). Zoomed out, it
 * covers the whole ground.
 */
const SunFollowingTheView = ({ ground, palette, lighting, lights }: ISunProps) => {
	const light = useRef<THREE.DirectionalLight>(null);
	const camera = useThree((s) => s.camera);
	const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;

	useFrame(({ size }, delta) => {
		if (!light.current) {
			return;
		}
		if (lighting.timeSource === "cycle" && useEditor.getState().playing) {
			advanceDayCycle(Math.min(delta, 0.1), lighting);
		}
		const sky = skyLightAt(lighting, sceneHoursNow());
		lights.sun = light.current;
		lightFor(lights, sky, palette);
		sun.copy(sunDirectionOf(sky));
		lightX.crossVectors(up, sun).normalize();
		lightY.crossVectors(sun, lightX);

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
		const z = centre.dot(sun);
		centre.copy(lightX).multiplyScalar(x).addScaledVector(lightY, y).addScaledVector(sun, z);
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

/**
 * A sun whose shadows cover the whole ground, at the world's set time of day
 * (pictures of worlds, which don't move).
 */
const SunOverTheGround = ({ ground, palette, lighting, lights }: ISunProps) => {
	const half = Math.max(ground.width, ground.depth) * 0.75;
	const sky = skyLightAt(lighting, lighting.time);
	const position = sunDirectionOf(sky).multiplyScalar(half * 1.4);
	return (
		<directionalLight
			ref={(light) => {
				lights.sun = light;
				lightFor(lights, sky, palette);
			}}
			castShadow
			position={position}
			intensity={palette.sunIntensity * sky.strength}
			color={sky.color}
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

interface ISceneLightsProps {
	ground: TScene["ground"];
	palette: IScenePalette;
	lighting: TLighting;
	/**
	 * The editor's view: the sun follows the time of day as it passes, and its
	 * shadows cover what's on screen, sharp on any ground (docs/adr/0049, 0052).
	 */
	followView?: boolean;
}

/** The scene's sky, fill and sun (or moon), for the world's time of day. */
export const SceneLights = ({
	ground,
	palette,
	lighting,
	followView = false,
}: ISceneLightsProps) => {
	const lights = useRef<ILights>({ sun: null, sky: null, ambient: null }).current;
	return (
		<>
			<hemisphereLight
				ref={(light) => {
					lights.sky = light;
				}}
				args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity]}
			/>

			<ambientLight
				ref={(light) => {
					lights.ambient = light;
				}}
				intensity={palette.ambientIntensity}
			/>

			{followView ? (
				<SunFollowingTheView
					ground={ground}
					palette={palette}
					lighting={lighting}
					lights={lights}
				/>
			) : (
				<SunOverTheGround ground={ground} palette={palette} lighting={lighting} lights={lights} />
			)}
		</>
	);
};
