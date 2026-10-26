import { useFrame, useThree } from "@react-three/fiber";
import { N8AOPostPass } from "n8ao";
import {
	BloomEffect,
	CopyPass,
	EffectComposer,
	EffectPass,
	KernelSize,
	Pass,
	ShaderPass,
	SMAAEffect,
} from "postprocessing";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { sceneHoursNow } from "#/editor/dayClock";
import type { IGraphics } from "#/editor/graphics";
import { useEditor } from "#/editor/store";
import { skyLightAt } from "#/scene/sun";

import { BandBlurShader, bandBlurSettings, useTiltShiftShown } from "./TiltShift";

/**
 * The glow after dark, in two layers: a tight, bright one round lit panes,
 * lamps and headlights, and a faint, wide halo round the brightest. Their
 * strengths at full dark; they fade with the light and are off by day.
 */
const GLOW_CORE_AT_NIGHT = 0.9;
const GLOW_HALO_AT_NIGHT = 0.35;

/** postprocessing's full-screen triangle is in clip space already. */
const FULL_SCREEN_VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = position.xy * 0.5 + 0.5;
		gl_Position = vec4(position.xy, 1.0, 1.0);
	}`;

/**
 * The scene drawn exactly as onto the canvas, so Standard's look stays, then
 * decoded into linear light, where the effects work (the last pass encodes it
 * for the canvas again). Into its own buffer, flagged as an XR target: three
 * tone-maps each material (the painted lights that opt out keep their colours)
 * and writes sRGB only there and on the canvas, so see-through things (glows,
 * lit panes) blend onto sRGB values as they do on the canvas. The flag changes
 * nothing else for a half-float buffer; no other pass draws into it.
 */
class SceneAsOnCanvasPass extends Pass {
	private readonly world: THREE.Scene;
	private readonly view: THREE.Camera;
	private readonly drawn: THREE.WebGLRenderTarget;

	constructor(world: THREE.Scene, view: THREE.Camera, samples: number) {
		super("SceneAsOnCanvasPass");
		this.world = world;
		this.view = view;
		this.drawn = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
		this.drawn.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
		Object.assign(this.drawn, { isXRRenderTarget: true });
		this.drawn.texture.colorSpace = THREE.SRGBColorSpace;
		this.fullscreenMaterial = new THREE.ShaderMaterial({
			name: "DecodeSRGB",
			uniforms: { tDiffuse: { value: this.drawn.texture } },
			vertexShader: FULL_SCREEN_VERTEX,
			fragmentShader: /* glsl */ `
				uniform sampler2D tDiffuse;
				varying vec2 vUv;
				void main() {
					vec4 texel = texture2D(tDiffuse, vUv);
					gl_FragColor = vec4(sRGBTransferEOTF(texel).rgb, texel.a);
				}`,
		});
	}

	render(
		renderer: THREE.WebGLRenderer,
		_input: THREE.WebGLRenderTarget,
		output: THREE.WebGLRenderTarget,
	) {
		renderer.setRenderTarget(this.drawn);
		renderer.clear();
		renderer.render(this.world, this.view);
		renderer.setRenderTarget(this.renderToScreen ? null : output);
		renderer.render(this.scene, this.camera);
	}

	/** The scene's depth, for ambient occlusion: the composer's own buffers never see the scene. */
	get sceneDepth() {
		return this.drawn.depthTexture as THREE.DepthTexture;
	}

	setSize(width: number, height: number) {
		this.drawn.setSize(width, height);
	}

	dispose() {
		this.drawn.dispose();
		super.dispose();
	}
}

/** One direction of the tilt-shift's blur (render/TiltShift), as a pass here. */
const bandBlurPass = () =>
	new ShaderPass(
		new THREE.ShaderMaterial({
			name: BandBlurShader.name,
			uniforms: THREE.UniformsUtils.clone(BandBlurShader.uniforms),
			vertexShader: FULL_SCREEN_VERTEX,
			fragmentShader: BandBlurShader.fragmentShader,
		}),
		"tDiffuse",
	);

/** The composer and its passes for these settings, the ones a frame adjusts kept at hand. */
const composeFor = (
	gl: THREE.WebGLRenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	graphics: Pick<IGraphics, "ambientOcclusion" | "showGlowAfterDark" | "antiAliasing">,
) => {
	const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
	const scenePass = new SceneAsOnCanvasPass(
		scene,
		camera,
		graphics.antiAliasing === "multisample" ? 4 : 0,
	);
	composer.addPass(scenePass);
	let occlusion: N8AOPostPass | null = null;
	if (graphics.ambientOcclusion !== "off") {
		occlusion = new N8AOPostPass(scene, camera);
		occlusion.setQualityMode("High");
		Object.assign(occlusion.configuration, {
			// World units round each point; strong enough to show on the dark theme's ground too.
			aoRadius: 3,
			distanceFalloff: 1,
			intensity: 3.5,
			halfRes: graphics.ambientOcclusion === "halfResolution",
			// The last pass encodes the output.
			gammaCorrection: false,
		});
		composer.addPass(occlusion);
	}
	// The Kawase blur, not the mipmap one: the mipmap blur turned the red channel of some whole night
	// views to NaN inside its own passes (with SMAA, no multisampling), which the canvas shows as a
	// frame in one or two colours, or black, while panning.
	const glowLayers = graphics.showGlowAfterDark
		? ([
				new BloomEffect({
					mipmapBlur: false,
					kernelSize: KernelSize.SMALL,
					luminanceThreshold: 0.9,
					luminanceSmoothing: 0.15,
				}),
				new BloomEffect({
					mipmapBlur: false,
					kernelSize: KernelSize.HUGE,
					luminanceThreshold: 0.97,
				}),
			] as const)
		: null;
	const glow = glowLayers ? new EffectPass(camera, ...glowLayers) : null;
	if (glow) {
		composer.addPass(glow);
	}
	const across = bandBlurPass();
	const up = bandBlurPass();
	composer.addPass(across);
	composer.addPass(up);
	// The last pass draws to the canvas, encoding sRGB.
	composer.addPass(
		graphics.antiAliasing === "smaa" ? new EffectPass(camera, new SMAAEffect()) : new CopyPass(),
	);
	// After every pass is added: the composer hands passes the depth of its own buffers, empty here.
	occlusion?.setDepthTexture(scenePass.sceneDepth);
	return { composer, glowLayers, glow, blur: [across, up] as const, drawnAt: "" };
};

interface IEffectsProps {
	graphics: IGraphics;
}

/**
 * The view drawn through the effects composer (ADR-0072): the scene (tone
 * mapped as on the canvas), ambient occlusion, the glow after dark, the
 * world's tilt-shift, and SMAA or the canvas's multisampling. Mounted only
 * while a graphics setting or the tilt-shift needs it (editor/graphics:
 * drawsEffects), so Standard draws as it always did; it takes over drawing
 * the frame.
 */
export const Effects = ({ graphics }: IEffectsProps) => {
	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const tiltShiftShown = useTiltShiftShown();
	const composed = useRef<ReturnType<typeof composeFor> | null>(null);
	const { ambientOcclusion, showGlowAfterDark, antiAliasing } = graphics;

	// Made in the effect, not during render: disposing a composer empties it, and React may clean up
	// an effect and run it again (strict mode) with what render made.
	useEffect(() => {
		// The composer clears its own buffers and turns the renderer's clearing off; R3F's own drawing
		// needs it back once the composer is gone.
		const autoClear = gl.autoClear;
		const made = composeFor(gl, scene, camera, {
			ambientOcclusion,
			showGlowAfterDark,
			antiAliasing,
		});
		composed.current = made;
		return () => {
			made.composer.dispose();
			gl.autoClear = autoClear;
			if (composed.current === made) {
				composed.current = null;
			}
		};
	}, [gl, scene, camera, ambientOcclusion, showGlowAfterDark, antiAliasing]);

	useFrame(({ size }, delta) => {
		const made = composed.current;
		if (!made) {
			gl.render(scene, camera);
			return;
		}
		const { composer, glowLayers, glow, blur } = made;
		const at = `${size.width}×${size.height}@${gl.getPixelRatio()}`;
		if (made.drawnAt !== at) {
			made.drawnAt = at;
			composer.setSize(size.width, size.height, false);
		}
		if (glowLayers && glow) {
			const night = skyLightAt(useEditor.getState().scene.lighting, sceneHoursNow()).night;
			glowLayers[0].intensity = GLOW_CORE_AT_NIGHT * night;
			glowLayers[1].intensity = GLOW_HALO_AT_NIGHT * night;
			glow.enabled = night > 0.01;
		}
		const settings = bandBlurSettings(useEditor.getState().scene.camera, size.width, size.height);
		for (const [pass, direction] of [
			[blur[0], settings.across],
			[blur[1], settings.up],
		] as const) {
			pass.enabled = tiltShiftShown;
			const uniforms = (pass.fullscreenMaterial as THREE.ShaderMaterial).uniforms;
			uniforms.direction.value.set(direction[0], direction[1]);
			uniforms.centre.value = settings.centre;
			uniforms.halfHeight.value = settings.halfHeight;
			uniforms.soft.value = settings.soft;
		}
		composer.render(delta);
	}, 1);

	return null;
};
