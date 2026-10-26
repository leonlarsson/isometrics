import { BlurPass } from "@react-three/drei/materials/BlurPass";
import { MeshReflectorMaterial as MeshReflectorMaterialImpl } from "@react-three/drei/materials/MeshReflectorMaterial";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { keepOnHotReload } from "#/lib/hot";
import { MAX_WATER_SEAMS } from "#/scene/areas";
import type { TWater } from "#/scene/schema";

/**
 * Reflective water (Graphics: Water reflections, ADR-0075): the world
 * mirrored in the water, broken up by ripples that drift, on top of the
 * water's own lit surface. The mirrored scene is drawn here (aimMirror) into
 * drei's reflector material, whose shader is changed so the reflection is
 * added as reflected light, stronger at a low angle (Fresnel), instead of
 * tinting the water's colour, which the dark would then dim: lit windows and
 * lamps reflect at night.
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
	// Towards the camera; in the diorama the same everywhere, its view rays being parallel.
	vec3 toCamera = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
	float facing = clamp(dot(normal, toCamera), 0.0, 1.0);
	float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
	vec3 reflected = sRGBTransferEOTF(vec4(max(newMerge.rgb, 0.0), 1.0)).rgb;
	float reflectionStrength = mix(worldMixStrength, mixStrength, waterOwnness);
	totalEmissiveRadiance += reflected * reflectionStrength * mix(mirror, 1.0, fresnel);`;

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

/** Over how many ground units a water area's own ripples and reflections fade into the world's at a seam. */
const SEAM_FADE = 2;

/**
 * A water area's own look near where it meets other water (ADR-0075):
 * `waterOwnness` is 0 on a seam and 1 from SEAM_FADE away, and the ripples
 * and the reflection fade from the world's to the area's own over it, so two
 * water areas meet without a line.
 */
const SEAM_GLSL = /* glsl */ `
	uniform vec4 waterSeams[${MAX_WATER_SEAMS}];
	uniform int waterSeamCount;
	uniform float seamFade;
	uniform float worldNormalScale;
	uniform float worldRippleShift;
	uniform float worldMixStrength;
	varying vec2 vWaterXZ;
	float waterOwnnessAt(vec2 at) {
		float closest = 1e5;
		for (int i = 0; i < ${MAX_WATER_SEAMS}; i++) {
			if (i >= waterSeamCount) {
				break;
			}
			vec2 a = waterSeams[i].xy;
			vec2 along = waterSeams[i].zw - a;
			float t = clamp(dot(at - a, along) / max(dot(along, along), 1e-6), 0.0, 1.0);
			closest = min(closest, length(at - a - along * t));
		}
		return smoothstep(0.0, seamFade, closest);
	}
`;

/** Settings the water's shader reads each frame (uniforms, shared with it by reference). */
interface IWaterUniforms {
	rippleShift: { value: number };
	waterSeams: { value: THREE.Vector4[] };
	waterSeamCount: { value: number };
	seamFade: { value: number };
	worldNormalScale: { value: number };
	worldRippleShift: { value: number };
	worldMixStrength: { value: number };
}

const waterUniforms = (): IWaterUniforms => ({
	rippleShift: { value: 0 },
	waterSeams: { value: Array.from({ length: MAX_WATER_SEAMS }, () => new THREE.Vector4()) },
	waterSeamCount: { value: 0 },
	seamFade: { value: SEAM_FADE },
	worldNormalScale: { value: 0 },
	worldRippleShift: { value: 0 },
	worldMixStrength: { value: 0 },
});

/**
 * Changes drei's shader: the moving ripples for the reflection too, shifting
 * it by `rippleShift` (drei's was a twentieth of the view), the reflection as
 * light, and both fading into the world's at seams with other water.
 */
const asReflectedLight = (material: THREE.Material, uniforms: IWaterUniforms) => {
	const compile = material.onBeforeCompile.bind(material);
	material.onBeforeCompile = (shader, renderer) => {
		compile(shader, renderer);
		Object.assign(shader.uniforms, uniforms);
		shader.vertexShader = `varying vec2 vWaterXZ;\n${shader.vertexShader}`.replace(
			"#include <project_vertex>",
			"#include <project_vertex>\n\tvWaterXZ = (modelMatrix * vec4(transformed, 1.0)).xz;",
		);
		shader.fragmentShader = `${SEAM_GLSL}\n${shader.fragmentShader}`
			.replace("void main() {", "void main() {\n\tfloat waterOwnness = waterOwnnessAt(vWaterXZ);")
			.replace(
				"#include <normal_fragment_maps>",
				THREE.ShaderChunk.normal_fragment_maps.replace(
					"mapN.xy *= normalScale;",
					"mapN.xy *= mix(vec2(worldNormalScale), normalScale, waterOwnness);",
				),
			)
			.replace("uniform float distortion;", "uniform float distortion;\nuniform float rippleShift;")
			.replace("texture2D(normalMap, vUv * normalScale)", "texture2D(normalMap, vNormalMapUv)")
			.replace(
				"coord.z * my_normal.xz * 0.05",
				"coord.z * my_normal.xz * mix(worldRippleShift, rippleShift, waterOwnness)",
			)
			.replace(DREI_BLEND, REFLECTED_LIGHT);
	};
	material.customProgramCacheKey = () => "isometrics-water";
};

interface IReflectiveWaterProps {
	color: string;
	roughness: number;
	/** How strongly it mirrors the world: 0 = not at all (ripples catching the lights), 1 = fully. */
	reflectionStrength: number;
	/** How rippled it is: 0 = mirror-calm, 1 = choppy (the area's, or the world's). */
	rippleStrength: number;
	/** The world's ripples and reflections, which its own fade into at seams. */
	world: TWater;
	/** Where it meets other water ([x1, z1, x2, z2], scene/areas: waterSeams). */
	seams: [number, number, number, number][];
}

/** How strong the mirrored world is at reflection strength 1. */
const FULL_REFLECTION = 1.1;

/** The reflection's size in pixels per side; the ripples and the blur hide the rest. */
const REFLECTION_SIZE = 512;

// Per frame, shared: the water's plane and how the mirror camera sees it.
const plane = new THREE.Plane();
const up = new THREE.Vector3();
const waterAt = new THREE.Vector3();
const cameraAt = new THREE.Vector3();
const turn = new THREE.Matrix4();
const lookAt = new THREE.Vector3();
const mirroredAt = new THREE.Vector3();
const mirroredTarget = new THREE.Vector3();
const clipPlane = new THREE.Vector4();
const corner = new THREE.Vector4();
const inverse = new THREE.Matrix4();

/**
 * Points `mirror` at the world as `camera` sees it reflected in `water` (a
 * flat mesh facing +Z in its own space; false if the camera is below it), with the part below the water cut
 * off by an oblique near plane, and sets the texture matrix that maps the
 * water's surface onto the reflection. Like drei's reflector, but the near
 * plane in the general form (Lengyel), which works for orthographic cameras
 * too: drei's perspective-only form cut the whole reflection away in the
 * diorama.
 */
const aimMirror = (
	water: THREE.Object3D,
	camera: THREE.Camera,
	mirror: THREE.Camera,
	textureMatrix: THREE.Matrix4,
) => {
	waterAt.setFromMatrixPosition(water.matrixWorld);
	cameraAt.setFromMatrixPosition(camera.matrixWorld);
	turn.extractRotation(water.matrixWorld);
	up.set(0, 0, 1).applyMatrix4(turn);
	// Seen from below, there's nothing to mirror.
	if (mirroredAt.subVectors(cameraAt, waterAt).dot(up) <= 0) {
		return false;
	}
	// The camera, and where it looks, mirrored in the water's plane.
	mirroredAt.subVectors(waterAt, cameraAt).reflect(up).negate().add(waterAt);
	turn.extractRotation(camera.matrixWorld);
	lookAt.set(0, 0, -1).applyMatrix4(turn).add(cameraAt);
	mirroredTarget.subVectors(waterAt, lookAt).reflect(up).negate().add(waterAt);
	mirror.position.copy(mirroredAt);
	mirror.up.set(0, 1, 0).applyMatrix4(turn).reflect(up);
	mirror.lookAt(mirroredTarget);
	(mirror as THREE.PerspectiveCamera).far = (camera as THREE.PerspectiveCamera).far;
	mirror.updateMatrixWorld();
	mirror.projectionMatrix.copy(camera.projectionMatrix);
	textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
	textureMatrix.multiply(mirror.projectionMatrix);
	textureMatrix.multiply(mirror.matrixWorldInverse);
	textureMatrix.multiply(water.matrixWorld);
	// The near plane moved onto the water (in the mirror's view space): row 3 of the projection
	// becomes the clip plane scaled to the far corner of the view, less row 4.
	plane.setFromNormalAndCoplanarPoint(up, waterAt).applyMatrix4(mirror.matrixWorldInverse);
	clipPlane.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
	const m = mirror.projectionMatrix.elements;
	inverse.copy(mirror.projectionMatrix).invert();
	corner.set(Math.sign(clipPlane.x), Math.sign(clipPlane.y), 1, 1).applyMatrix4(inverse);
	clipPlane.multiplyScalar(2 / clipPlane.dot(corner));
	m[2] = clipPlane.x - m[3];
	m[6] = clipPlane.y - m[7];
	m[10] = clipPlane.z - m[11];
	m[14] = clipPlane.w - m[15];
	mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();
	return true;
};

/** A water area on the shared mirror: its mesh (once mounted) and whether it shows a reflection. */
interface IMirrorMember {
	water: THREE.Object3D | null;
	mirrors: boolean;
}

/**
 * The one reflection every flat water area shows (ADR-0075): they all lie on
 * the ground (layers apart by less than a thousandth of a unit) and mirror the
 * same world, so the first of them draws it, with all of them hidden, and each
 * maps it onto itself. One draw of the mirrored world a frame, not one per area.
 */
interface ISharedMirror {
	sharp: THREE.WebGLRenderTarget;
	blurred: THREE.WebGLRenderTarget;
	blur: BlurPass;
	members: Set<IMirrorMember>;
}

const sharedMirrors = keepOnHotReload(
	"water.sharedMirrors",
	() => new Map<THREE.WebGLRenderer, ISharedMirror>(),
);

const makeSharedMirror = (gl: THREE.WebGLRenderer): ISharedMirror => {
	const sharp = new THREE.WebGLRenderTarget(REFLECTION_SIZE, REFLECTION_SIZE, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		type: THREE.HalfFloatType,
	});
	sharp.depthTexture = new THREE.DepthTexture(REFLECTION_SIZE, REFLECTION_SIZE);
	sharp.depthTexture.type = THREE.UnsignedShortType;
	asDrawnOnCanvas(sharp.texture);
	const blurred = new THREE.WebGLRenderTarget(REFLECTION_SIZE, REFLECTION_SIZE, {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		type: THREE.HalfFloatType,
	});
	const blur = new BlurPass({ gl, resolution: REFLECTION_SIZE, width: 90, height: 30 });
	return { sharp, blurred, blur, members: new Set() };
};

/** The renderer's shared mirror, made when its first water area needs it; it lasts as long as the renderer. */
const sharedMirrorOf = (gl: THREE.WebGLRenderer) => {
	let shared = sharedMirrors.get(gl);
	if (!shared) {
		shared = makeSharedMirror(gl);
		sharedMirrors.set(gl, shared);
	}
	return shared;
};

/** The material of a flat water area that reflects the world. */
export const ReflectiveWaterMaterial = ({
	color,
	roughness,
	reflectionStrength,
	rippleStrength,
	world,
	seams,
}: IReflectiveWaterProps) => {
	const gl = useThree((s) => s.gl);
	const uniforms = useRef<IWaterUniforms | null>(null);
	uniforms.current ??= waterUniforms();
	const u = uniforms.current;
	u.rippleShift.value = RIPPLE_SHIFT * rippleStrength;
	u.worldRippleShift.value = RIPPLE_SHIFT * world.rippleStrength;
	u.worldNormalScale.value = RIPPLE_NORMAL_SCALE * world.rippleStrength;
	u.worldMixStrength.value = FULL_REFLECTION * world.reflectionStrength;
	u.waterSeamCount.value = seams.length;
	seams.forEach(([x1, z1, x2, z2], i) => {
		u.waterSeams.value[i].set(x1, z1, x2, z2);
	});
	const normalScale = RIPPLE_NORMAL_SCALE * rippleStrength;
	const normals = rippleNormals();

	const member = useRef<IMirrorMember>({ water: null, mirrors: false }).current;
	const shared = sharedMirrorOf(gl);
	useEffect(() => {
		shared.members.add(member);
		return () => {
			shared.members.delete(member);
		};
	}, [shared, member]);

	const reflector = useMemo(() => {
		const textureMatrix = new THREE.Matrix4();
		// Its settings after it's made: its constructor applies them before it can hold them.
		const material = new MeshReflectorMaterialImpl();
		Object.assign(material, {
			mirror: 0.35,
			mixStrength: FULL_REFLECTION,
			mixBlur: 0.6,
			hasBlur: true,
			textureMatrix,
			tDiffuse: shared.sharp.texture,
			tDepth: shared.sharp.depthTexture,
			tDiffuseBlur: shared.blurred.texture,
			depthScale: 0,
			polygonOffset: true,
			polygonOffsetFactor: -1,
		});
		material.defines = { ...material.defines, USE_BLUR: "" };
		asReflectedLight(material, u);
		const mirrors = {
			perspective: new THREE.PerspectiveCamera(),
			orthographic: new THREE.OrthographicCamera(),
		};
		return { textureMatrix, material, mirrors };
	}, [shared, u]);

	useEffect(() => () => reflector.material.dispose(), [reflector]);

	const { material } = reflector;
	material.color.set(color);
	material.roughness = roughness;
	material.metalness = 0;
	material.normalMap = normals;
	material.normalScale.set(normalScale, normalScale);
	(material as unknown as { mixStrength: number }).mixStrength =
		FULL_REFLECTION * reflectionStrength;

	useFrame(({ clock, camera, scene }) => {
		// The same drift for every water area; slow, and not along an axis.
		const t = clock.elapsedTime;
		normals.offset.set(t * 0.011, t * 0.007);
		const water = (material as unknown as { __r3f?: { parent?: { object?: THREE.Object3D } } })
			.__r3f?.parent?.object;
		member.water = water ?? null;
		// Not mirroring at all (nor where it fades into the world's water): no need to draw the mirror.
		member.mirrors = reflectionStrength > 0 || (seams.length > 0 && world.reflectionStrength > 0);
		if (!water) {
			return;
		}
		const eye =
			camera instanceof THREE.OrthographicCamera
				? reflector.mirrors.orthographic
				: reflector.mirrors.perspective;
		// Its own map onto the reflection, even when another water area draws it.
		if (!aimMirror(water, camera, eye, reflector.textureMatrix)) {
			return;
		}
		const members = [...shared.members];
		if (members[0] !== member || !members.some((each) => each.mirrors)) {
			return;
		}
		for (const each of members) {
			if (each.water) {
				each.water.visible = false;
			}
		}
		const shadowsUpdate = gl.shadowMap.autoUpdate;
		gl.shadowMap.autoUpdate = false;
		gl.setRenderTarget(shared.sharp);
		gl.state.buffers.depth.setMask(true);
		gl.clear();
		gl.render(scene, eye);
		shared.blur.render(gl, shared.sharp, shared.blurred);
		gl.shadowMap.autoUpdate = shadowsUpdate;
		for (const each of members) {
			if (each.water) {
				each.water.visible = true;
			}
		}
		gl.setRenderTarget(null);
	});

	return <primitive object={material} attach="material" />;
};
