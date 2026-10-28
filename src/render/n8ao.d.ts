// n8ao ships no types: the part of its postprocessing pass that render/Effects uses.
declare module "n8ao" {
	import type { Pass } from "postprocessing";
	import type { Camera, DepthTexture, Scene, ShaderMaterial, WebGLRenderer } from "three";

	interface IN8AOConfiguration {
		aoRadius: number;
		distanceFalloff: number;
		intensity: number;
		halfRes: boolean;
		gammaCorrection: boolean;
		/** Whether see-through things are drawn apart; found by detectTransparency until set. */
		transparencyAware: boolean;
		/** How the renderer stores depth (default, logarithmic or reversed); n8ao sets it as it renders. */
		depthBufferType: number;
	}

	export class N8AOPostPass extends Pass {
		constructor(scene: Scene, camera: Camera, width?: number, height?: number);
		/** The camera it reads depth for; its shaders are built for the camera's projection. */
		camera: Camera;
		configuration: IN8AOConfiguration;
		setQualityMode(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
		setDepthTexture(depthTexture: DepthTexture): void;
		/**
		 * Build its shaders again for how depth is stored and whether the camera is orthographic
		 * (an ORTHO define); as n8ao itself calls them when a setting changes.
		 */
		configureAOPass(depthBufferType?: number, orthographic?: boolean): void;
		configureDenoisePass(depthBufferType?: number, orthographic?: boolean): void;
		configureEffectCompositer(depthBufferType?: number, orthographic?: boolean): void;
		/** Each frame: walks the scene for see-through materials, until it finds one. */
		detectTransparency(): void;
		/** Each frame once aware: walks the scene four times, hiding and showing around two renders. */
		renderTransparency(renderer: WebGLRenderer): void;
		/** Draw the next frame afresh (no accumulation from the last). */
		firstFrame(): void;
		/** Its shaders, as the configure methods build them: the occlusion, the denoise and the compositer. */
		effectShaderQuad: { material: ShaderMaterial };
		poissonBlurQuad: { material: ShaderMaterial };
		effectCompositerQuad: { material: ShaderMaterial };
		/** The denoise shaders the blur quad draws with, by iteration (render/Effects keeps them per projection). */
		standardDenoiseMaterial: ShaderMaterial;
		neuralDenoiseMaterial: ShaderMaterial | null;
	}
}
