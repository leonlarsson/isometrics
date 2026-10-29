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
import type { IGraphics, TDrawnGraphics } from "#/editor/graphics";
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
 * A buffer drawn into as the canvas is: flagged as an XR target, three tone-maps each material
 * (the painted lights that opt out keep their colours) and writes sRGB only there and on the
 * canvas, so a material keeps one shader for both. The flag changes nothing else for a half-float
 * buffer.
 */
const drawnAsOnCanvas = (target: THREE.WebGLRenderTarget) => {
	if (!(target as { isXRRenderTarget?: boolean }).isXRRenderTarget) {
		Object.assign(target, { isXRRenderTarget: true });
		target.texture.colorSpace = THREE.SRGBColorSpace;
	}
};

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
	private view: THREE.Camera;
	private readonly drawn: THREE.WebGLRenderTarget;

	constructor(world: THREE.Scene, view: THREE.Camera, samples: number) {
		super("SceneAsOnCanvasPass");
		this.world = world;
		this.view = view;
		this.drawn = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
		this.drawn.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
		drawnAsOnCanvas(this.drawn);
		this.fullscreenMaterial = new THREE.ShaderMaterial({
			name: "DecodeSRGB",
			uniforms: { tDiffuse: { value: this.drawn.texture } },
			vertexShader: FULL_SCREEN_VERTEX,
			fragmentShader: /* glsl */ `
				uniform sampler2D tDiffuse;
				varying vec2 vUv;
				void main() {
					vec4 texel = texture2D(tDiffuse, vUv);
					vec3 linear = sRGBTransferEOTF(texel).rgb;
					// A lit surface can come out as no number at all, or one too big to add up (a real light
					// right at a surface). On the canvas that's one dot; a blur after this grows it into
					// blocks of the wrong colour. So such values are cleared here, before any effect.
					bvec3 notFinite = equal(floatBitsToUint(linear) & uvec3(0x7f800000u), uvec3(0x7f800000u));
					linear = mix(clamp(linear, 0.0, 64.0), vec3(0.0), vec3(notFinite));
					gl_FragColor = vec4(linear, texel.a);
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

	/** The camera the world is drawn with (the composer's setMainCamera). */
	override set mainCamera(camera: THREE.Camera) {
		this.view = camera;
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

/**
 * The colour grade (Graphics: Colour grade, ADR-0076): a little more colour
 * and contrast, a soft vignette, and after dark cooler shadows against warmer
 * lights. On the finished, tone-mapped picture, in display (sRGB) values and
 * clamped at each step, so no colour is pushed below black (the render lab
 * graded before tone mapping and turned saturated colours black).
 */
const colorGradePass = () =>
	new ShaderPass(
		new THREE.ShaderMaterial({
			name: "ColorGrade",
			uniforms: {
				tDiffuse: { value: null },
				saturation: { value: 1.14 },
				contrast: { value: 1.08 },
				vignette: { value: 0.32 },
				aspect: { value: 1 },
				/** 0 by day, 1 at full dark. */
				night: { value: 0 },
			},
			vertexShader: FULL_SCREEN_VERTEX,
			fragmentShader: /* glsl */ `
				uniform sampler2D tDiffuse;
				uniform float saturation;
				uniform float contrast;
				uniform float vignette;
				uniform float aspect;
				uniform float night;
				varying vec2 vUv;
				void main() {
					vec4 texel = texture2D(tDiffuse, vUv);
					// Display values, 0-1 for all but the brightest lights.
					vec3 c = sRGBTransferOETF(vec4(max(texel.rgb, 0.0), 1.0)).rgb;
					float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
					c = max(mix(vec3(luma), c, saturation), 0.0);
					c = max((c - 0.5) * contrast + 0.5, 0.0);
					// After dark: shadows towards a cool blue, lights towards warm.
					float lit = smoothstep(0.15, 0.75, luma);
					vec3 tone = mix(vec3(0.93, 0.98, 1.08), vec3(1.06, 1.0, 0.92), lit);
					c *= mix(vec3(1.0), tone, night * 0.8);
					// A soft vignette, round on screen.
					vec2 fromCentre = (vUv - 0.5) * vec2(aspect, 1.0);
					c *= 1.0 - vignette * smoothstep(0.35, 1.05, length(fromCentre));
					gl_FragColor = vec4(sRGBTransferEOTF(vec4(c, 1.0)).rgb, texel.a);
				}`,
		}),
		"tDiffuse",
	);

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

/** n8ao's buffers for its renders of the see-through things. */
interface IOcclusionTransparency {
	transparencyRenderTargetDWFalse?: THREE.WebGLRenderTarget | null;
	transparencyRenderTargetDWTrue?: THREE.WebGLRenderTarget | null;
}

/**
 * n8ao walks the whole scene each frame: for see-through materials, and once it has found one,
 * four times more to hide and show every object around its two renders of them. In a big world
 * that's tens of thousands of objects, most in groups hidden because batches draw them (ADR-0092).
 * The same, visiting only what's drawn: found once per frame, as the frame starts.
 *
 * Its two renders of the see-through things also drew the sun's shadows again, of those alone,
 * which the next frame's reflection was then drawn with; they keep the frame's shadows instead. And
 * they draw into buffers set up like the scene pass's (it reads only how opaque each pixel is), so
 * those materials keep the one shader they're drawn with, rather than switching twice a frame.
 */
const walkOnlyWhatIsDrawn = (occlusion: N8AOPostPass, scene: THREE.Scene) => {
	const drawn: THREE.Object3D[] = [];
	occlusion.detectTransparency = () => {
		drawn.length = 0;
		let seeThrough = false;
		scene.traverseVisible((object) => {
			const material = (object as THREE.Mesh).material as THREE.Material | undefined;
			if (material) {
				drawn.push(object);
				seeThrough ||= material.transparent;
			}
		});
		// Once aware, it stays so, as n8ao does.
		if (seeThrough && !occlusion.configuration.transparencyAware) {
			occlusion.configuration.transparencyAware = true;
		}
	};
	const renderTransparency = occlusion.renderTransparency.bind(occlusion);
	occlusion.renderTransparency = (renderer) => {
		const { transparencyRenderTargetDWFalse, transparencyRenderTargetDWTrue } =
			occlusion as unknown as IOcclusionTransparency;
		for (const target of [transparencyRenderTargetDWFalse, transparencyRenderTargetDWTrue]) {
			if (target) {
				drawnAsOnCanvas(target);
			}
		}
		const traverse = scene.traverse;
		scene.traverse = (callback) => {
			for (const object of drawn) {
				callback(object);
			}
		};
		const shadowsUpdate = renderer.shadowMap.autoUpdate;
		renderer.shadowMap.autoUpdate = false;
		try {
			renderTransparency(renderer);
		} finally {
			scene.traverse = traverse;
			renderer.shadowMap.autoUpdate = shadowsUpdate;
		}
	};
};

/** The composer and its passes for these settings, the ones a frame adjusts kept at hand. */
const composeFor = (
	gl: THREE.WebGLRenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	graphics: Pick<
		IGraphics,
		"ambientOcclusion" | "showGlowAfterDark" | "antiAliasing" | "useColorGrade"
	>,
) => {
	const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType });
	const scenePass = new SceneAsOnCanvasPass(
		scene,
		camera,
		graphics.antiAliasing === "multisample" ? 4 : 0,
	);
	composer.addPass(scenePass);
	let occlusion: N8AOPostPass | null = null;
	let switchOcclusionTo = (_orthographic: boolean) => {};
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
		// Its compositer too for the diorama: n8ao builds it for perspective whatever the camera.
		occlusion.configureEffectCompositer(
			occlusion.configuration.depthBufferType,
			isOrthographic(camera),
		);
		switchOcclusionTo = keepShadersForBothProjections(occlusion);
		walkOnlyWhatIsDrawn(occlusion, scene);
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
	const grade = graphics.useColorGrade ? colorGradePass() : null;
	if (grade) {
		composer.addPass(grade);
	}
	// The last pass draws to the canvas, encoding sRGB.
	composer.addPass(
		graphics.antiAliasing === "smaa" ? new EffectPass(camera, new SMAAEffect()) : new CopyPass(),
	);
	// After every pass is added: the composer hands passes the depth of its own buffers, empty here.
	occlusion?.setDepthTexture(scenePass.sceneDepth);
	return {
		composer,
		camera,
		occlusion,
		switchOcclusionTo,
		glowLayers,
		glow,
		blur: [across, up] as const,
		grade,
		drawnAt: "",
	};
};

type TComposed = ReturnType<typeof composeFor>;

const isOrthographic = (camera: THREE.Camera) => camera instanceof THREE.OrthographicCamera;

/** n8ao's shaders as built for one projection: the occlusion, the denoise (two kinds) and the compositer. */
interface IOcclusionShaders {
	occlusion: THREE.ShaderMaterial;
	denoise: THREE.ShaderMaterial;
	neuralDenoise: THREE.ShaderMaterial | null;
	compositer: THREE.ShaderMaterial;
}

/**
 * n8ao builds its three shaders for one projection (an ORTHO define) and
 * disposes them when it builds them again, so each switch between the diorama
 * and perspective compiled them anew: a hitch of three big compiles. This keeps
 * the shaders built for each projection and puts them back on a switch; the
 * first switch each way still builds them. n8ao building them itself (a setting
 * changed) drops what was kept, as it's for the old settings. Returns the
 * switch: give it whether the camera is orthographic now.
 */
const keepShadersForBothProjections = (occlusion: N8AOPostPass) => {
	const kept = new Map<boolean, IOcclusionShaders>();
	const current = (): IOcclusionShaders => ({
		occlusion: occlusion.effectShaderQuad.material,
		denoise: occlusion.standardDenoiseMaterial,
		neuralDenoise: occlusion.neuralDenoiseMaterial,
		compositer: occlusion.effectCompositerQuad.material,
	});
	const put = (shaders: IOcclusionShaders) => {
		occlusion.effectShaderQuad.material = shaders.occlusion;
		occlusion.standardDenoiseMaterial = shaders.denoise;
		occlusion.neuralDenoiseMaterial = shaders.neuralDenoise;
		occlusion.poissonBlurQuad.material = shaders.denoise;
		occlusion.effectCompositerQuad.material = shaders.compositer;
	};
	const dropKept = () => {
		for (const shaders of kept.values()) {
			shaders.occlusion.dispose();
			shaders.denoise.dispose();
			shaders.neuralDenoise?.dispose();
			shaders.compositer.dispose();
		}
		kept.clear();
	};
	const build = {
		occlusion: occlusion.configureAOPass.bind(occlusion),
		denoise: occlusion.configureDenoisePass.bind(occlusion),
		compositer: occlusion.configureEffectCompositer.bind(occlusion),
	};
	occlusion.configureAOPass = (depth, orthographic) => {
		dropKept();
		build.occlusion(depth, orthographic);
	};
	occlusion.configureDenoisePass = (depth, orthographic) => {
		dropKept();
		build.denoise(depth, orthographic);
	};
	occlusion.configureEffectCompositer = (depth, orthographic) => {
		dropKept();
		build.compositer(depth, orthographic);
	};
	// Gone with the composer (a graphics setting changed): n8ao disposes only the shaders in use.
	const dispose = occlusion.dispose.bind(occlusion);
	occlusion.dispose = () => {
		dropKept();
		dispose();
	};
	let orthographic = isOrthographic(occlusion.camera);
	return (toOrthographic: boolean) => {
		if (toOrthographic === orthographic) {
			return;
		}
		kept.set(orthographic, current());
		orthographic = toOrthographic;
		const back = kept.get(toOrthographic);
		if (back) {
			kept.delete(toOrthographic);
			put(back);
			occlusion.firstFrame();
			return;
		}
		// n8ao disposes the shaders it replaces: stand-ins take their place, so the kept ones live on.
		put({
			occlusion: new THREE.ShaderMaterial(),
			denoise: new THREE.ShaderMaterial(),
			neuralDenoise: null,
			compositer: new THREE.ShaderMaterial(),
		});
		const depth = occlusion.configuration.depthBufferType;
		build.occlusion(depth, toOrthographic);
		build.denoise(depth, toOrthographic);
		build.compositer(depth, toOrthographic);
	};
};

/**
 * Points the composer at the camera the view draws with now. Switching between
 * the diorama and perspective (render/CameraRig: ProjectionSwitch) swaps the
 * camera object; the composer, its passes and their buffers stay, since nothing
 * in them but n8ao depends on the camera, and n8ao only on its projection
 * (keepShadersForBothProjections). Making the whole composer again instead
 * froze the view for about half a second: twenty buffers and a dozen shaders.
 */
const aimAt = (made: TComposed, camera: THREE.Camera) => {
	if (made.camera === camera) {
		return;
	}
	made.camera = camera;
	made.composer.setMainCamera(camera);
	if (made.occlusion) {
		made.occlusion.camera = camera;
		made.switchOcclusionTo(isOrthographic(camera));
	}
};

interface IEffectsProps {
	graphics: TDrawnGraphics;
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
	const get = useThree((s) => s.get);
	const tiltShiftShown = useTiltShiftShown();
	const composed = useRef<TComposed | null>(null);
	const { ambientOcclusion, showGlowAfterDark, antiAliasing, useColorGrade } = graphics;

	// Made in the effect, not during render: disposing a composer empties it, and React may clean up
	// an effect and run it again (strict mode) with what render made.
	useEffect(() => {
		// The composer clears its own buffers and turns the renderer's clearing off; R3F's own drawing
		// needs it back once the composer is gone.
		const autoClear = gl.autoClear;
		// With the camera of the moment; a frame points it at another (aimAt) rather than remaking it.
		const made = composeFor(gl, scene, get().camera, {
			ambientOcclusion,
			showGlowAfterDark,
			antiAliasing,
			useColorGrade,
		});
		composed.current = made;
		return () => {
			made.composer.dispose();
			gl.autoClear = autoClear;
			if (composed.current === made) {
				composed.current = null;
			}
		};
	}, [gl, scene, ambientOcclusion, showGlowAfterDark, antiAliasing, useColorGrade]);

	useFrame(({ size, camera }, delta) => {
		const made = composed.current;
		if (!made) {
			gl.render(scene, camera);
			return;
		}
		aimAt(made, camera);
		const { composer, glowLayers, glow, blur, grade } = made;
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
		if (grade) {
			const uniforms = (grade.fullscreenMaterial as THREE.ShaderMaterial).uniforms;
			uniforms.night.value = skyLightAt(useEditor.getState().scene.lighting, sceneHoursNow()).night;
			uniforms.aspect.value = size.width / Math.max(size.height, 1);
		}
		composer.render(delta);
	}, 1);

	return null;
};
