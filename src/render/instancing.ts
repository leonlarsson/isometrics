import * as THREE from "three";

import { keepOnHotReload } from "#/lib/hot";

/**
 * Objects that look the same are drawn together (ADR-0086): the meshes of
 * different objects with the same shape and material are drawn as one
 * instanced mesh (render/InstancedParts), each where its original is. The
 * originals stay where they are, for clicks, hovers and drags, on a layer
 * cameras don't draw.
 */

/** The layer the originals of shared meshes move to: not drawn (cameras see layer 0), still hit by the pointer. */
export const INSTANCED_ORIGINALS_LAYER = 1;

const defaultOnBeforeRender = THREE.Object3D.prototype.onBeforeRender;
const defaultOnBeforeCompile = THREE.Material.prototype.onBeforeCompile;

/**
 * What a geometry is, for sharing: the shape a part named it by
 * (`userData.shareKey`, parts/primitives' `shareGeometryAs`), or its type and
 * parameters when it's one of three's own shapes with plain numbers for
 * parameters (a box, a cylinder); otherwise only itself.
 */
export const geometryKey = (geometry: THREE.BufferGeometry) => {
	if (typeof geometry.userData.shareKey === "string") {
		return `shared:${geometry.userData.shareKey}`;
	}
	const parameters = (geometry as { parameters?: Record<string, unknown> }).parameters;
	if (
		parameters &&
		Object.values(parameters).every((value) => ["number", "boolean"].includes(typeof value))
	) {
		return `${geometry.type}${JSON.stringify(parameters)}`;
	}
	return geometry.uuid;
};

type TSharedMaterial =
	| THREE.MeshStandardMaterial
	| THREE.MeshBasicMaterial
	| THREE.MeshLambertMaterial;

const colorKey = (color: THREE.Color | undefined) => (color ? color.getHexString() : "-");

/**
 * What a material looks like, for sharing, or null when it can't be shared:
 * see-through ones (their order matters), ones with a shader of their own
 * (text), and kinds the parts don't use.
 */
export const materialKey = (material: THREE.Material): string | null => {
	const shared = material as TSharedMaterial;
	const kind =
		(shared as THREE.MeshStandardMaterial).isMeshStandardMaterial ||
		(shared as THREE.MeshBasicMaterial).isMeshBasicMaterial ||
		(shared as THREE.MeshLambertMaterial).isMeshLambertMaterial;
	if (
		!kind ||
		material.transparent ||
		material.onBeforeCompile !== defaultOnBeforeCompile ||
		material.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey
	) {
		return null;
	}
	const standard = material as THREE.MeshStandardMaterial;
	const lambert = material as THREE.MeshLambertMaterial;
	return [
		material.type,
		colorKey(shared.color),
		colorKey(standard.emissive ?? lambert.emissive),
		standard.emissiveIntensity ?? lambert.emissiveIntensity ?? "-",
		standard.roughness ?? "-",
		standard.metalness ?? "-",
		standard.flatShading ?? lambert.flatShading ?? "-",
		shared.map?.uuid ?? "-",
		standard.emissiveMap?.uuid ?? "-",
		material.side,
		material.vertexColors,
		material.alphaTest,
		material.depthTest,
		material.depthWrite,
		material.toneMapped,
		material.polygonOffset ? `${material.polygonOffsetFactor},${material.polygonOffsetUnits}` : "-",
		(shared as { fog?: boolean }).fog ?? "-",
	].join("|");
};

/**
 * A mesh's key, for drawing it with others that have the same one; null for
 * meshes drawn on their own: with several materials, instanced, skinned or
 * morphing, with render hooks of their own, or marked `userData.notInstanced`
 * by a part that changes them outside React.
 */
export const meshKey = (mesh: THREE.Mesh): string | null => {
	if (
		!mesh.isMesh ||
		(mesh as THREE.InstancedMesh).isInstancedMesh ||
		(mesh as THREE.SkinnedMesh).isSkinnedMesh ||
		mesh.morphTargetInfluences !== undefined ||
		Array.isArray(mesh.material) ||
		mesh.onBeforeRender !== defaultOnBeforeRender ||
		mesh.userData.notInstanced
	) {
		return null;
	}
	const material = materialKey(mesh.material);
	if (material === null) {
		return null;
	}
	return `${geometryKey(mesh.geometry)}#${material}#${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}#${mesh.renderOrder}`;
};

/** The meshes one object shares, by key, found after it last rendered. */
interface IInstancedRoot {
	group: THREE.Object3D;
	shared: { mesh: THREE.Mesh; key: string }[];
	/** Rendered since its meshes were last looked through. */
	dirty: boolean;
}

/** Every object's part, by its group; `changed` is set when one was added, removed or re-rendered. */
export const instancing = keepOnHotReload("instancing", () => ({
	roots: new Map<THREE.Object3D, IInstancedRoot>(),
	changed: true,
}));

/** An object's part rendered (or was added): look through its meshes again before the next frame. */
export const markInstancedRoot = (group: THREE.Object3D) => {
	const root = instancing.roots.get(group);
	if (root) {
		root.dirty = true;
	} else {
		instancing.roots.set(group, { group, shared: [], dirty: true });
	}
	instancing.changed = true;
};

/** An object's part went away. */
export const forgetInstancedRoot = (group: THREE.Object3D) => {
	if (instancing.roots.delete(group)) {
		instancing.changed = true;
	}
};

/**
 * Finds the meshes in an object's part that can be shared, and moves back to
 * the drawn layer any that no longer can (a material that turned see-through).
 * Which shared ones are drawn together is decided with every object's (`InstancedParts`).
 */
export const scanRoot = (root: IInstancedRoot) => {
	root.shared = [];
	root.group.traverse((object) => {
		const mesh = object as THREE.Mesh;
		if (!mesh.isMesh) {
			return;
		}
		const key = meshKey(mesh);
		if (key === null) {
			if (mesh.layers.isEnabled(INSTANCED_ORIGINALS_LAYER)) {
				mesh.layers.set(0);
			}
			return;
		}
		root.shared.push({ mesh, key });
	});
	root.dirty = false;
};

/** Whether an original is shown: it and every parent visible. */
export const isShown = (object: THREE.Object3D) => {
	for (let at: THREE.Object3D | null = object; at; at = at.parent) {
		if (!at.visible) {
			return false;
		}
	}
	return true;
};
