import * as THREE from "three";

import { isInsidePolygon } from "#/scene/areas";
import { groundOutlineOf } from "#/scene/groundShape";
import type { TGround } from "#/scene/schema";

/** Texels a side: enough for a splash to land on the ground's shape and not past it. */
const SIZE = 128;

/**
 * Where the ground is (ADR-0155), for weather drawn on it: what lands on the
 * ground (splashes) lands only on its shape, and nowhere while it's hidden.
 * `mode` 0: all of its rectangle (the plain ground, as always); 1: the mask
 * (1 inside its shape) over its rectangle (`bounds`: min x, min z, 1/width,
 * 1/depth); 2: nowhere. Plain three, no React.
 */
export interface IGroundMask {
	mode: 0 | 1 | 2;
	texture: THREE.DataTexture | null;
	bounds: THREE.Vector4;
}

const masks = new WeakMap<TGround, IGroundMask>();
/** The same ground's for what falls over it, hidden or not. */
const fallMasks = new WeakMap<TGround, IGroundMask>();
/** The last mask's texture, let go of on the GPU when another replaces it (three uploads it again if it's used again, after an undo). */
let lastTexture: THREE.DataTexture | null = null;
let olderTexture: THREE.DataTexture | null = null;

/**
 * The ground's mask, made once per ground as it is: for what lands on it
 * (splashes, none while it's hidden), or with `overIt` for what falls over it
 * (rain and snow, over its shape whether it's drawn or not: a floating model
 * still has weather round it).
 */
export const groundMaskOf = (ground: TGround, overIt = false): IGroundMask => {
	const kept = overIt ? fallMasks : masks;
	let mask = kept.get(ground);
	if (mask) {
		return mask;
	}
	const bounds = new THREE.Vector4(
		-ground.width / 2,
		-ground.depth / 2,
		1 / ground.width,
		1 / ground.depth,
	);
	const outline = groundOutlineOf(ground);
	if (ground.isHidden && !overIt) {
		mask = { mode: 2, texture: null, bounds };
	} else if (!outline) {
		mask = { mode: 0, texture: null, bounds };
	} else {
		const data = new Uint8Array(SIZE * SIZE * 4);
		for (let j = 0; j < SIZE; j++) {
			for (let i = 0; i < SIZE; i++) {
				const x = -ground.width / 2 + ((i + 0.5) / SIZE) * ground.width;
				const z = -ground.depth / 2 + ((j + 0.5) / SIZE) * ground.depth;
				data[(j * SIZE + i) * 4] = isInsidePolygon([x, z], outline) ? 255 : 0;
			}
		}
		const texture = new THREE.DataTexture(data, SIZE, SIZE);
		texture.needsUpdate = true;
		// The other kind of mask for the same shape may still use the last one: let go only of older ones.
		if (lastTexture && lastTexture !== texture) {
			olderTexture?.dispose();
			olderTexture = lastTexture;
		}
		lastTexture = texture;
		mask = { mode: 1, texture, bounds };
	}
	kept.set(ground, mask);
	return mask;
};

/** GLSL: how much of a spot [x, z] is the ground's (1 on it, 0 past its shape or while it's hidden). */
export const GROUND_MASK_GLSL = /* glsl */ `
	uniform sampler2D groundMask;
	uniform vec4 groundMaskBounds;
	uniform float groundMaskMode;
	float onGroundAt(vec2 spot) {
		if (groundMaskMode < 0.5) {
			return 1.0;
		}
		if (groundMaskMode > 1.5) {
			return 0.0;
		}
		vec2 uv = (spot - groundMaskBounds.xy) * groundMaskBounds.zw;
		if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
			return 0.0;
		}
		return texture2D(groundMask, uv).r;
	}
`;

/** The uniforms that read a ground mask (`GROUND_MASK_GLSL`). */
export const groundMaskUniforms = () => ({
	groundMask: { value: null as THREE.DataTexture | null },
	groundMaskBounds: { value: new THREE.Vector4() },
	groundMaskMode: { value: 0 },
});

/** Point a material's mask uniforms at the ground as it is now. */
export const applyGroundMask = (
	uniforms: Record<string, THREE.IUniform>,
	ground: TGround,
	overIt = false,
) => {
	const mask = groundMaskOf(ground, overIt);
	uniforms.groundMask.value = mask.texture;
	(uniforms.groundMaskBounds.value as THREE.Vector4).copy(mask.bounds);
	uniforms.groundMaskMode.value = mask.mode;
};
