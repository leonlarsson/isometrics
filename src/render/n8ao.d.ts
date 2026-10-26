// n8ao ships no types: the part of its postprocessing pass that render/Effects uses.
declare module "n8ao" {
	import type { Pass } from "postprocessing";
	import type { Camera, DepthTexture, Scene } from "three";

	interface IN8AOConfiguration {
		aoRadius: number;
		distanceFalloff: number;
		intensity: number;
		halfRes: boolean;
		gammaCorrection: boolean;
	}

	export class N8AOPostPass extends Pass {
		constructor(scene: Scene, camera: Camera, width?: number, height?: number);
		configuration: IN8AOConfiguration;
		setQualityMode(mode: "Performance" | "Low" | "Medium" | "High" | "Ultra"): void;
		setDepthTexture(depthTexture: DepthTexture): void;
	}
}
