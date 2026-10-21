import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { labelAnchors, labelElements } from "./labelRegistry";

const point = new THREE.Vector3();

/** Projects every registered label anchor to screen space and moves its card. */
export const LabelProjector = () => {
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);

	useFrame(() => {
		for (const [id, element] of labelElements) {
			const anchor = labelAnchors.get(id);
			if (!anchor) {
				element.style.visibility = "hidden";
				continue;
			}
			anchor.getWorldPosition(point).project(camera);
			const x = ((point.x + 1) / 2) * size.width;
			const y = ((1 - point.y) / 2) * size.height;
			element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
			element.style.visibility = Math.abs(point.z) <= 1 ? "visible" : "hidden";
		}
	});

	return null;
};
