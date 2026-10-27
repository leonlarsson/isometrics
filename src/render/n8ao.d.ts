// n8ao ships no types: the part of its postprocessing pass that render/Effects uses.
declare module "n8ao" {
	import type { Pass } from "postprocessing";
	import type { Camera, DepthTexture, Scene, WebGLRenderer } from "three";

	interface IN8AOConfiguration {
		aoRadius: number;
		distanceFalloff: number;
		intensity: number;
		halfRes: boolean;
		gammaCorrection: boolean;
		/** Whether see-through things are drawn apart; found by detectTransparency until set. */
		transparencyAware: boolean;
	}

	export class N8AOPostPass extends Pass {
		constructor(scene: Scene, camera: Camera, width?: number, height?: number);
		configuration: IN8AOConfiguration;
		setQualityMode(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
		setDepthTexture(depthTexture: DepthTexture): void;
		/** Each frame: walks the scene for see-through materials, until it finds one. */
		detectTransparency(): void;
		/** Each frame once aware: walks the scene four times, hiding and showing around two renders. */
		renderTransparency(renderer: WebGLRenderer): void;
	}
}
