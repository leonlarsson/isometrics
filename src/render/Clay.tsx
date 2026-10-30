import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** A standard material, the kind the world's parts, ground, roads and areas are drawn with. */
const isWorldMaterial = (material: THREE.Material): material is THREE.MeshStandardMaterial =>
	(material as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;

/** One clay for everything: a warm light grey, matte. */
const CLAY = new THREE.Color("#d8d2c8");
const CLAY_ROUGHNESS = 0.95;

/** What a material was before it turned to clay. */
interface IOriginal {
	color: THREE.Color;
	roughness: number;
}

/**
 * The view in clay (ADR-0080's switcher): every surface of the world in one
 * matte clay colour, so only its shapes, light and shadow show. Standard
 * materials only, like the wireframe: the editor's gizmo, handles and lines
 * and the painted lights stay as they are, and see-through things stay
 * see-through. Looked for each frame, so things added (or recoloured) while
 * it's on are clay too; each gets its own colour back when it's off.
 */
export const Clay = () => {
	const scene = useThree((s) => s.scene);
	const originals = useRef(new Map<THREE.MeshStandardMaterial, IOriginal>());

	useFrame(() => {
		scene.traverse((object) => {
			const material = (object as THREE.Mesh).material;
			if (!material) {
				return;
			}
			for (const each of Array.isArray(material) ? material : [material]) {
				if (!isWorldMaterial(each) || each.color.equals(CLAY)) {
					continue;
				}
				// Not clay (new, or given its colour again while it's on): remember that colour.
				originals.current.set(each, { color: each.color.clone(), roughness: each.roughness });
				each.color.copy(CLAY);
				each.roughness = CLAY_ROUGHNESS;
			}
		});
	});

	useEffect(() => {
		const changed = originals.current;
		return () => {
			for (const [material, { color, roughness }] of changed) {
				material.color.copy(color);
				material.roughness = roughness;
			}
			changed.clear();
		};
	}, []);

	return null;
};
