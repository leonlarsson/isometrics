import { MeshReflectorMaterial } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Reflective water (Graphics: Water reflections, ADR-0075): the world
 * mirrored in the water, broken up by ripples that drift, on top of the
 * water's own lit surface. drei's reflector renders the mirrored scene; its
 * shader is changed here so the reflection is added as reflected light,
 * stronger at a low angle (Fresnel), instead of tinting the water's colour,
 * which the dark would then dim: lit windows and lamps reflect at night.
 */

/** Pixels per side of the ripple texture, which tiles. */
const RIPPLE_SIZE = 256;
/** World units one tile of ripples covers. */
const RIPPLE_TILE = 14;

/** A random number in 0–1 for each grid point, the same every time (a hash, not a generator). */
const latticeValue = (x: number, y: number, seed: number) => {
	const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
	return n - Math.floor(n);
};

/** Smooth noise that tiles over a `cells` × `cells` grid (u, v in 0–1). */
const tilingNoise = (u: number, v: number, cells: number, seed: number) => {
	const x = u * cells;
	const y = v * cells;
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;
	const sx = fx * fx * (3 - 2 * fx);
	const sy = fy * fy * (3 - 2 * fy);
	const at = (i: number, j: number) =>
		latticeValue(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
	const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
	const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
	return top * (1 - sy) + bottom * sy;
};

/**
 * A tiling normal map of small, irregular ripples: smooth noise at a few
 * scales (no regular waves, which interfere into a visible crosshatch).
 */
const makeRippleNormals = () => {
	const octaves = [
		[6, 1],
		[12, 0.55],
		[24, 0.3],
		[48, 0.16],
	];
	const heights = new Float32Array(RIPPLE_SIZE * RIPPLE_SIZE);
	for (let y = 0; y < RIPPLE_SIZE; y++) {
		for (let x = 0; x < RIPPLE_SIZE; x++) {
			const u = x / RIPPLE_SIZE;
			const v = y / RIPPLE_SIZE;
			heights[y * RIPPLE_SIZE + x] = octaves.reduce(
				(sum, [cells, amplitude], i) => sum + amplitude * tilingNoise(u, v, cells, i + 1),
				0,
			);
		}
	}
	const heightAt = (x: number, y: number) =>
		heights[
			(((y % RIPPLE_SIZE) + RIPPLE_SIZE) % RIPPLE_SIZE) * RIPPLE_SIZE +
				(((x % RIPPLE_SIZE) + RIPPLE_SIZE) % RIPPLE_SIZE)
		];
	const data = new Uint8Array(RIPPLE_SIZE * RIPPLE_SIZE * 4);
	for (let y = 0; y < RIPPLE_SIZE; y++) {
		for (let x = 0; x < RIPPLE_SIZE; x++) {
			const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) / 2;
			const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) / 2;
			const normal = new THREE.Vector3(-dx * 28, -dy * 28, 1).normalize();
			const i = (y * RIPPLE_SIZE + x) * 4;
			data[i] = Math.round((normal.x * 0.5 + 0.5) * 255);
			data[i + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
			data[i + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
			data[i + 3] = 255;
		}
	}
	const texture = new THREE.DataTexture(data, RIPPLE_SIZE, RIPPLE_SIZE);
	texture.wrapS = THREE.RepeatWrapping;
	texture.wrapT = THREE.RepeatWrapping;
	texture.repeat.set(1 / RIPPLE_TILE, 1 / RIPPLE_TILE);
	texture.magFilter = THREE.LinearFilter;
	texture.minFilter = THREE.LinearMipmapLinearFilter;
	texture.generateMipmaps = true;
	texture.needsUpdate = true;
	return texture;
};

let ripples: THREE.DataTexture | null = null;
const rippleNormals = () => {
	ripples ??= makeRippleNormals();
	return ripples;
};

/** drei's reflection blend, which tints the water's colour by the reflection. */
const DREI_BLEND =
	"diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + newMerge.rgb * mixStrength);";

/**
 * The reflection added as reflected light instead, by how low the view meets
 * the water. The reflection is drawn as onto the canvas (asDrawnOnCanvas), so
 * it's decoded from sRGB first.
 */
const REFLECTED_LIGHT = /* glsl */ `
	float facing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
	float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
	vec3 reflected = sRGBTransferEOTF(vec4(max(newMerge.rgb, 0.0), 1.0)).rgb;
	totalEmissiveRadiance += reflected * mixStrength * mix(mirror, 1.0, fresnel);`;

/**
 * Draws the reflection exactly as onto the canvas (each material tone-mapped
 * as it opts, written as sRGB), like the effects composer's scene pass
 * (ADR-0073): three keeps one shader per material for both. Drawn into a plain
 * buffer instead, every material in the world switched shaders twice a frame
 * per water area, which cost about 4 ms of CPU per area.
 */
const asDrawnOnCanvas = (texture: THREE.Texture | null | undefined) => {
	const target = texture?.renderTarget as THREE.WebGLRenderTarget | null | undefined;
	if (target && !(target as { isXRRenderTarget?: boolean }).isXRRenderTarget) {
		Object.assign(target, { isXRRenderTarget: true });
		target.texture.colorSpace = THREE.SRGBColorSpace;
	}
};

/** At full strength (1): how much the ripples tilt the surface, and shift the reflection, in the view. */
const RIPPLE_NORMAL_SCALE = 0.24;
const RIPPLE_SHIFT = 0.024;

/**
 * Changes drei's shader: the moving ripples for the reflection too, shifting
 * it by `shift` (drei's was a twentieth of the view), and the reflection as
 * light.
 */
const asReflectedLight = (material: THREE.Material, shift: { value: number }) => {
	const compile = material.onBeforeCompile.bind(material);
	material.onBeforeCompile = (shader, renderer) => {
		compile(shader, renderer);
		shader.uniforms.rippleShift = shift;
		shader.fragmentShader = shader.fragmentShader
			.replace("uniform float distortion;", "uniform float distortion;\nuniform float rippleShift;")
			.replace("texture2D(normalMap, vUv * normalScale)", "texture2D(normalMap, vNormalMapUv)")
			.replace("coord.z * my_normal.xz * 0.05", "coord.z * my_normal.xz * rippleShift")
			.replace(DREI_BLEND, REFLECTED_LIGHT);
	};
	material.customProgramCacheKey = () => "isometrics-water";
};

interface IReflectiveWaterProps {
	color: string;
	roughness: number;
	/** How rippled it is: 0 = mirror-calm, 1 = choppy (the area's, or the world's). */
	rippleStrength: number;
}

/** The material of a flat water area that reflects the world. */
export const ReflectiveWaterMaterial = ({
	color,
	roughness,
	rippleStrength,
}: IReflectiveWaterProps) => {
	const changed = useRef<THREE.Material | null>(null);
	const shift = useRef({ value: 0 }).current;
	shift.value = RIPPLE_SHIFT * rippleStrength;
	const normalScale = RIPPLE_NORMAL_SCALE * rippleStrength;
	const normals = rippleNormals();
	useFrame(({ clock }) => {
		// The same drift for every water area; slow, and not along an axis.
		const t = clock.elapsedTime;
		normals.offset.set(t * 0.011, t * 0.007);
	});
	return (
		<MeshReflectorMaterial
			ref={(material: THREE.Material | null) => {
				if (material && changed.current !== material) {
					changed.current = material;
					asReflectedLight(material, shift);
					asDrawnOnCanvas((material as unknown as { tDiffuse?: THREE.Texture }).tDiffuse);
				}
			}}
			color={color}
			roughness={roughness}
			metalness={0}
			normalMap={normals}
			normalScale={new THREE.Vector2(normalScale, normalScale)}
			resolution={512}
			mirror={0.35}
			mixStrength={1.1}
			blur={[90, 30]}
			mixBlur={0.6}
			depthScale={0}
			polygonOffset
			polygonOffsetFactor={-1}
		/>
	);
};
