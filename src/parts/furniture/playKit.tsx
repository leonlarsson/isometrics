import * as THREE from "three";

import { Box } from "../primitives";

const ALONG_X = new THREE.Vector3(1, 0, 0);
const turn = new THREE.Quaternion();
const euler = new THREE.Euler();

/** A square rod from one point to another, anywhere: the playground's frames, legs and chains. */
export const Rod = ({
	from,
	to,
	color,
	thickness = 0.06,
	castShadow = true,
}: {
	from: [number, number, number];
	to: [number, number, number];
	color: string;
	thickness?: number;
	castShadow?: boolean;
}) => {
	const along = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
	const length = along.length();
	turn.setFromUnitVectors(ALONG_X, along.normalize());
	euler.setFromQuaternion(turn);
	return (
		<Box
			size={[Math.round(length * 1000) / 1000, thickness, thickness]}
			position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}
			rotation={[euler.x, euler.y, euler.z]}
			color={color}
			castShadow={castShadow}
		/>
	);
};
