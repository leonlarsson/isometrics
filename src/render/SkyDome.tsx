import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useSceneHours } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { useSkyWeather } from "#/editor/weather";
import { skyLookAt } from "#/scene/sky";

import { directionOf } from "./viewpoints";

/**
 * The dome's size as a share of the camera's far plane, which follows the camera's distance
 * (render/CameraControls): just inside it, so it's never clipped away.
 */
const FAR_SHARE = 0.9;

/** For meshes the pointer should pass through (the sky, the clouds). */
export const ignoreRaycast = () => {};

const vertexShader = /* glsl */ `
	varying vec3 vDirection;
	void main() {
		vDirection = position;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const fragmentShader = /* glsl */ `
	uniform vec3 colorOverhead;
	uniform vec3 colorAtHorizon;
	uniform vec3 sunDirection;
	uniform vec3 sunColor;
	uniform float showsSun;
	uniform vec3 moonDirection;
	uniform float showsMoon;
	uniform float starBrightness;
	varying vec3 vDirection;

	float hash(vec3 p) {
		p = fract(p * 0.3183099 + 0.1);
		p *= 17.0;
		return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
	}

	void main() {
		vec3 d = normalize(vDirection);
		float up = d.y;
		// Light at the horizon, deeper overhead; a little darker below it (past the ground's edge).
		vec3 colour = mix(colorAtHorizon, colorOverhead, pow(clamp(up, 0.0, 1.0), 0.5));
		colour = mix(colour, colorAtHorizon * 0.75, 1.0 - smoothstep(-0.25, 0.0, up));

		// Stars: a point in some cells of a grid over the sky, fading out towards the horizon. Each is
		// a pixel or two across whatever the screen and lens (fwidth: how much of a cell a pixel is).
		if (starBrightness > 0.0 && up > 0.0) {
			vec3 grid = d * 160.0;
			vec3 cell = floor(grid);
			float lit = step(1.0 - 0.025 * starBrightness, hash(cell));
			float pixel = length(fwidth(grid));
			float point = 1.0 - smoothstep(pixel * 0.8, pixel * 1.6, length(fract(grid) - 0.5));
			float brightness = 0.35 + 0.55 * hash(cell + 3.1);
			colour += vec3(lit * point * brightness * min(1.0, starBrightness * 1.4) * smoothstep(0.0, 0.3, up));
		}

		// The sun: a bright disc with a soft glow around it, in the sunlight's colour.
		if (showsSun > 0.5) {
			float facing = max(dot(d, sunDirection), 0.0);
			colour += sunColor * (smoothstep(0.9994, 0.9997, facing) * 1.5 + pow(facing, 400.0) * 0.6 + pow(facing, 12.0) * 0.12);
		}

		// The moon: a pale disc with a faint halo.
		if (showsMoon > 0.5) {
			float facing = max(dot(d, moonDirection), 0.0);
			colour = mix(colour, vec3(0.92, 0.94, 1.0), smoothstep(0.99986, 0.99993, facing));
			colour += vec3(0.6, 0.65, 0.9) * pow(facing, 1500.0) * 0.25;
		}

		gl_FragColor = vec4(colour, 1.0);
		#include <colorspace_fragment>
	}
`;

/**
 * The sky around the world in perspective (ADR-0070): a dome that moves with
 * the camera, drawn behind everything, with the sky's colours for the time of
 * day, the sun and moon discs and the stars (scene/sky). The isometric diorama
 * shows the backdrop instead (ui/AppShell), and so does perspective with the
 * dome switched off.
 */
export const SkyDome = () => {
	const perspective = useEditor((s) => s.projection === "perspective");
	// A green screen is for keying the world out, and a see-through picture has no sky (ADR-0084):
	// the backdrop shows in perspective too, or nothing.
	const skyless = useEditor(
		(s) => s.scene.backdrop.kind === "greenScreen" || (s.stillRender?.transparent ?? false),
	);
	const sky = useEditor((s) => s.scene.sky);
	const lighting = useEditor((s) => s.scene.lighting);
	const hour = useSceneHours();
	const mesh = useRef<THREE.Mesh>(null);
	// Made here, not as JSX props: R3F would hand the material copies of the uniforms, and numbers
	// changed on these (sun and moon on or off, stars) wouldn't reach the shader.
	const material = useMemo(
		() =>
			new THREE.ShaderMaterial({
				side: THREE.BackSide,
				depthWrite: false,
				depthTest: false,
				vertexShader,
				fragmentShader,
				uniforms: {
					colorOverhead: { value: new THREE.Color() },
					colorAtHorizon: { value: new THREE.Color() },
					sunDirection: { value: new THREE.Vector3() },
					sunColor: { value: new THREE.Color() },
					showsSun: { value: 0 },
					moonDirection: { value: new THREE.Vector3() },
					showsMoon: { value: 0 },
					starBrightness: { value: 0 },
				},
			}),
		[],
	);
	useEffect(() => () => material.dispose(), [material]);
	const { uniforms } = material;

	const look = skyLookAt(lighting, sky, hour, useSkyWeather());
	uniforms.colorOverhead.value.set(look.colorOverhead);
	uniforms.colorAtHorizon.value.set(look.colorAtHorizon);
	uniforms.showsSun.value = look.sunDisc ? 1 : 0;
	if (look.sunDisc) {
		uniforms.sunDirection.value.copy(directionOf(look.sunDisc.azimuth, look.sunDisc.elevation));
		uniforms.sunColor.value.set(look.sunDisc.color);
	}
	uniforms.showsMoon.value = look.moonDisc ? 1 : 0;
	if (look.moonDisc) {
		uniforms.moonDirection.value.copy(directionOf(look.moonDisc.azimuth, look.moonDisc.elevation));
	}
	uniforms.starBrightness.value = look.starBrightness;

	// Always around the camera, so it can't be flown out of, and just inside what it can see.
	useFrame(({ camera }) => {
		const dome = mesh.current;
		if (!dome) {
			return;
		}
		dome.position.copy(camera.position);
		dome.scale.setScalar((camera as THREE.PerspectiveCamera).far * FAR_SHARE);
	});

	if (!perspective || !sky.showsInPerspective || skyless) {
		return null;
	}
	return (
		// Never hit by the pointer: the camera pans and orbits around what's under the cursor, and
		// clicks on empty sky deselect.
		<mesh
			ref={mesh}
			renderOrder={-1000}
			frustumCulled={false}
			material={material}
			raycast={ignoreRaycast}
		>
			<sphereGeometry args={[1, 48, 24]} />
		</mesh>
	);
};
