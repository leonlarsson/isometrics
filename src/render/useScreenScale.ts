import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

import { pixelsPerUnitAt } from "./cameraMath";

const point = new THREE.Vector3();

/**
 * Keeps an object the same size on screen at any zoom and distance: one of its
 * local units is `pixels` screen pixels (times `factor`, e.g. a hover bump).
 * Attach the returned ref to the object; it owns the object's scale.
 */
export const useScreenScale = <T extends THREE.Object3D>(pixels: number, factor = 1) => {
	const ref = useRef<T>(null);
	useFrame(({ camera, size }) => {
		const object = ref.current;
		if (!object) {
			return;
		}
		object.getWorldPosition(point);
		object.scale.setScalar((pixels * factor) / pixelsPerUnitAt(camera, point, size.height));
	});
	return ref;
};
