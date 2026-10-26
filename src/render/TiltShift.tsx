import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

import { useEditor } from "#/editor/store";

/** At full strength: CSS px between the blur's samples (it reaches four times as far). */
const MAX_SAMPLE_STEP_PX = 6;

/**
 * One direction of a Gaussian blur that grows away from a sharp band across
 * the view: none inside the band, easing to full strength over `soft` of the
 * view's height beyond it. Run twice, across and then up.
 */
const BandBlurShader = {
	name: "BandBlurShader",
	uniforms: {
		tDiffuse: { value: null },
		/** One step between samples, in UV: (px / width, 0) or (0, px / height). */
		direction: { value: new THREE.Vector2() },
		/** The sharp band's middle and half its height, as a share of the view's height. */
		centre: { value: 0.5 },
		halfHeight: { value: 0.15 },
		soft: { value: 0.25 },
	},
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,
	fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform vec2 direction;
		uniform float centre;
		uniform float halfHeight;
		uniform float soft;
		varying vec2 vUv;
		void main() {
			float away = abs(vUv.y - centre) - halfHeight;
			vec2 step = direction * smoothstep(0.0, soft, away);
			vec4 sum = texture2D(tDiffuse, vUv) * 0.1633;
			sum += (texture2D(tDiffuse, vUv - step) + texture2D(tDiffuse, vUv + step)) * 0.1531;
			sum += (texture2D(tDiffuse, vUv - 2.0 * step) + texture2D(tDiffuse, vUv + 2.0 * step)) * 0.12245;
			sum += (texture2D(tDiffuse, vUv - 3.0 * step) + texture2D(tDiffuse, vUv + 3.0 * step)) * 0.0918;
			sum += (texture2D(tDiffuse, vUv - 4.0 * step) + texture2D(tDiffuse, vUv + 4.0 * step)) * 0.051;
			gl_FragColor = sum;
		}`,
};

/**
 * Draws the frame through the blur passes instead of straight to the canvas.
 * Mounted only while the effect shows, since taking over drawing (a frame
 * callback with a priority) stops R3F's own.
 */
const TiltShiftPasses = () => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const settings = useEditor((s) => s.scene.camera);

	const passes = useMemo(() => {
		const composer = new EffectComposer(gl);
		const render = new RenderPass(scene, camera);
		const across = new ShaderPass(BandBlurShader);
		const up = new ShaderPass(BandBlurShader);
		composer.addPass(render);
		composer.addPass(across);
		composer.addPass(up);
		composer.addPass(new OutputPass());
		return { composer, render, across, up };
	}, [gl, scene]);

	useEffect(() => () => passes.composer.dispose(), [passes]);

	useEffect(() => {
		passes.composer.setPixelRatio(gl.getPixelRatio());
		passes.composer.setSize(size.width, size.height);
	}, [passes, size.width, size.height, gl]);

	useEffect(() => {
		const reach = MAX_SAMPLE_STEP_PX * settings.tiltShiftBlur;
		const half = settings.tiltShiftFocus / 2;
		for (const [pass, direction] of [
			[passes.across, [reach / size.width, 0]],
			[passes.up, [0, reach / size.height]],
		] as const) {
			pass.uniforms.direction.value.set(direction[0], direction[1]);
			pass.uniforms.centre.value = settings.tiltShiftPosition;
			pass.uniforms.halfHeight.value = half;
			// The blur reaches full strength a fifth of the view's height beyond the band.
			pass.uniforms.soft.value = 0.2;
		}
	}, [passes, settings, size.width, size.height]);

	useFrame(() => {
		// The camera can change (diorama ↔ perspective) without remounting.
		passes.render.camera = camera;
		passes.composer.render();
	}, 1);

	return null;
};

/**
 * The world's tilt-shift (scene.camera.tiltShift, ADR-0062): the top and
 * bottom of the view blur and a band across it stays sharp, the miniature
 * look. Shown in View mode, and in Edit mode while previewing it from the
 * Camera tab.
 */
export const TiltShift = () => {
	const shown = useEditor(
		(s) => s.scene.camera.tiltShiftOn && (s.mode === "view" || s.previewTiltShift),
	);
	return shown ? <TiltShiftPasses /> : null;
};
