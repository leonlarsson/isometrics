import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type * as THREE from "three";

/** A standard material, the kind the world's parts, ground, roads and areas are drawn with. */
const isWorldMaterial = (material: THREE.Material): material is THREE.MeshStandardMaterial =>
	(material as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;

/**
 * The view as wireframe (ADR-0080): every surface of the world drawn as its
 * triangles' edges, in its own colour. Only standard materials, which the
 * world is drawn with: the editor's gizmo, handles and lines (basic and line
 * materials) and the painted lights stay as they are. Looked for each frame,
 * so things added while it's on are wireframe too; put back when it's off.
 */
export const Wireframe = () => {
	const scene = useThree((s) => s.scene);
	const changed = useRef(new Set<THREE.MeshStandardMaterial>());

	useFrame(() => {
		scene.traverse((object) => {
			const material = (object as THREE.Mesh).material;
			if (!material) {
				return;
			}
			for (const each of Array.isArray(material) ? material : [material]) {
				if (isWorldMaterial(each) && !each.wireframe) {
					each.wireframe = true;
					changed.current.add(each);
				}
			}
		});
	});

	useEffect(() => {
		const materials = changed.current;
		return () => {
			for (const material of materials) {
				material.wireframe = false;
			}
			materials.clear();
		};
	}, []);

	return null;
};
