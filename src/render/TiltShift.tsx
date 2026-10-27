import * as THREE from "three";

import { drawnModeOf, useEditor } from "#/editor/store";
import type { TScene } from "#/scene/schema";

/**
 * The world's tilt-shift (scene.camera.tiltShift, ADR-0062): the top and
 * bottom of the view blur and a band across it stays sharp, the miniature
 * look. Drawn as two passes of the effects composer (render/Effects,
 * ADR-0072), which the view goes through while it shows: in View mode, and in
 * Edit mode while previewing it from the Camera tab.
 */

/** At full strength: CSS px between the blur's samples (it reaches four times as far). */
const MAX_SAMPLE_STEP_PX = 6;

/**
 * One direction of a Gaussian blur that grows away from a sharp band across
 * the view: none inside the band, easing to full strength over `soft` of the
 * view's height beyond it. Run twice, across and then up.
 */
export const BandBlurShader = {
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
 * The blur's settings for a view `width` × `height` CSS px: one step between
 * samples in UV for each direction, and the sharp band.
 */
export const bandBlurSettings = (camera: TScene["camera"], width: number, height: number) => {
	const reach = MAX_SAMPLE_STEP_PX * camera.tiltShiftBlur;
	return {
		across: [reach / width, 0] as const,
		up: [0, reach / height] as const,
		centre: camera.tiltShiftPosition,
		halfHeight: camera.tiltShiftFocus / 2,
		// The blur reaches full strength a fifth of the view's height beyond the band.
		soft: 0.2,
	};
};

/** Whether the world's tilt-shift shows: in View mode, and in Edit mode while previewing it. */
export const useTiltShiftShown = () =>
	useEditor((s) => s.scene.camera.tiltShiftOn && (drawnModeOf(s) === "view" || s.previewTiltShift));
