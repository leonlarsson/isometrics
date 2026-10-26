import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { keepOnHotReload } from "#/lib/hot";

/**
 * The boats' waves (Graphics: Boat wakes, Foam and waves; ADR-0081): each
 * frame the wakes of the boats on a route are drawn from above into a texture
 * over the ground, holding how much and which way the water tilts there, and
 * the reflective water adds that to its ripples (Water.tsx), so its surface
 * and the reflection rock along each wake. Drawn afresh every frame from where
 * the boats are, like the foam: no simulation to keep.
 */

/** Texels per ground unit, and at most per side. */
const TEXELS_PER_UNIT = 16;
const MAX_TEXELS = 2048;

// Kept while the field is drawn, then put back.
const clearColor = new THREE.Color();

/** What the water's shader reads: the field, where it lies, and whether there is one. */
export interface IWakeFieldUniforms {
	wakeField: { value: THREE.Texture | null };
	/** The ground's corner at the least x and z, and its size. */
	wakeFieldMin: { value: THREE.Vector2 };
	wakeFieldSize: { value: THREE.Vector2 };
	wakeFieldOn: { value: number };
}

/** The scene of wave ribbons (one per boat, added by BoatWake) and the uniforms water reads. */
export const wakeField = keepOnHotReload("wakeField", () => ({
	scene: new THREE.Scene(),
	uniforms: {
		wakeField: { value: null },
		wakeFieldMin: { value: new THREE.Vector2() },
		wakeFieldSize: { value: new THREE.Vector2(1, 1) },
		wakeFieldOn: { value: 0 },
	} as IWakeFieldUniforms,
}));

/**
 * The waves' material, on each boat's V (BoatWake): per vertex its place
 * across the V (u, -1 to 1), the V's half-width there, how far along it (0 to
 * 1) and the route's heading. As behind a real boat, each arm is a few crests
 * running along it, the outermost strongest, fixed to the boat as it goes;
 * inside the V the water is calmer, its own ripples smoothed (the blue
 * channel). The V starts at the bow, as a real one does. Red and green are how the
 * water tilts, in the ground's x and z.
 */
export const makeWaveMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: { strength: { value: 1 } },
		vertexShader: /* glsl */ `
			attribute vec4 wakeShape;
			varying vec4 vShape;
			void main() {
				vShape = wakeShape;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,
		fragmentShader: /* glsl */ `
			uniform float strength;
			varying vec4 vShape;
			void main() {
				float u = vShape.x;
				float half_ = vShape.y;
				float along = vShape.z;
				float heading = vShape.w;
				// Right of travel and backwards, in the ground's x and z.
				vec2 side = vec2(sin(heading), cos(heading));
				vec2 behind = vec2(-cos(heading), sin(heading));
				float across = abs(u);
				// In from the arm's outer edge, and how far behind the stern (the V opens at Kelvin's angle),
				// in ground units.
				float fromEdge = (1.0 - across) * half_;
				float back = half_ / 0.354;
				// The band of crests along each arm widens further back.
				float armWidth = clamp(half_ * 0.4, 0.6, 2.2);
				float inArm = 1.0 - smoothstep(armWidth * 0.4, armWidth, fromEdge);
				float soft = smoothstep(0.0, armWidth * 0.3, fromEdge);
				// Short crests slanting across the arm (about 35° to it), broken up along it like feathers:
				// the diverging waves of a real wake.
				float crests = sin(fromEdge * 13.0 + back * 7.5);
				float pieces = 0.55 + 0.45 * sin(back * 1.7 + fromEdge * 2.0);
				// Strongest at the bow, where the boat pushes the water aside, then fading along the V.
				float bowWave = 1.0 + 1.5 * (1.0 - smoothstep(0.0, 0.2, along));
				float fade = pow(1.0 - along, 1.8) * smoothstep(0.0, 0.01, along) * bowWave;
				vec2 tilt = side * sign(u) * crests * pieces * inArm * soft * fade;
				// Calmer inside the V, where the boat has flattened the ripples.
				float calm = (1.0 - smoothstep(0.65, 0.95, across)) * pow(1.0 - along, 0.5);
				gl_FragColor = vec4(tilt * strength, calm * strength, 1.0);
			}`,
		blending: THREE.AdditiveBlending,
		depthTest: false,
		depthWrite: false,
		transparent: true,
		side: THREE.DoubleSide,
	});

/** Draws the wave field each frame while Foam and waves is on. Mount once in the scene. */
export const WakeFieldStep = () => {
	const gl = useThree((s) => s.gl);
	const ground = useEditor((s) => s.scene.ground);
	const { width, depth } = ground;

	const drawn = useMemo(() => {
		const target = new THREE.WebGLRenderTarget(
			Math.min(MAX_TEXELS, Math.ceil(width * TEXELS_PER_UNIT)),
			Math.min(MAX_TEXELS, Math.ceil(depth * TEXELS_PER_UNIT)),
			{ type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter },
		);
		// From above, the ground's far side (least z) at the top.
		const camera = new THREE.OrthographicCamera(
			-width / 2,
			width / 2,
			depth / 2,
			-depth / 2,
			0.1,
			100,
		);
		camera.position.set(0, 50, 0);
		camera.up.set(0, 0, -1);
		camera.lookAt(0, 0, 0);
		camera.updateMatrixWorld();
		return { target, camera };
	}, [width, depth]);

	useEffect(() => {
		const { uniforms } = wakeField;
		uniforms.wakeField.value = drawn.target.texture;
		uniforms.wakeFieldMin.value.set(-width / 2, -depth / 2);
		uniforms.wakeFieldSize.value.set(width, depth);
		uniforms.wakeFieldOn.value = 1;
		return () => {
			uniforms.wakeFieldOn.value = 0;
			uniforms.wakeField.value = null;
			drawn.target.dispose();
		};
	}, [drawn, width, depth]);

	useFrame(() => {
		const before = gl.getRenderTarget();
		gl.getClearColor(clearColor);
		const clearAlpha = gl.getClearAlpha();
		gl.setRenderTarget(drawn.target);
		gl.setClearColor(0x000000, 0);
		gl.clear(true, false, false);
		gl.render(wakeField.scene, drawn.camera);
		gl.setClearColor(clearColor, clearAlpha);
		gl.setRenderTarget(before);
	});

	return null;
};
