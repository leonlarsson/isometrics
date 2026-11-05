import * as THREE from "three";

/**
 * A buffer drawn into as the canvas is: flagged as an XR target, three tone-maps each material
 * (the painted lights that opt out keep their colours) and writes sRGB only there and on the
 * canvas, so a material keeps one shader for both. The flag changes nothing else for a half-float
 * buffer. The effects composer draws the scene so (render/Effects), and so does the warm-up draw
 * before a world shows (render/WorldReady), so the shaders it compiles are the canvas's own.
 */
export const drawnAsOnCanvas = (target: THREE.WebGLRenderTarget) => {
	if (!(target as { isXRRenderTarget?: boolean }).isXRRenderTarget) {
		Object.assign(target, { isXRRenderTarget: true });
		target.texture.colorSpace = THREE.SRGBColorSpace;
	}
};
