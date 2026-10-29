import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { motionClock } from "#/lib/motionClock";

import { Box, Mat, type TV3 } from "../primitives";
import type { IResolvedLight } from "../types";

/** How many times a second the lights take turns. */
const FLASHES_PER_SECOND = 3;

/**
 * An emergency vehicle's light bar (fire engine, ambulance): a dark bar on the
 * roof with a lens at each end, which flash in turn, left then right, while
 * the light is on (its colour, from the Lights tab or data). Off, both lenses
 * stay dark. They follow the motion clock, so pausing holds them. A part that
 * has one says `movesOnItsOwn: true`, or its lenses would freeze (ADR-0092).
 */
export const FlashingLightBar = ({
	light,
	position,
	width,
}: {
	light: IResolvedLight;
	position: TV3;
	/** Across the roof (z). */
	width: number;
}) => {
	const lenses = useRef<(THREE.Mesh | null)[]>([]);
	const dark = useMemo(
		() => `#${new THREE.Color(light.color).multiplyScalar(0.3).getHexString()}`,
		[light.color],
	);
	useFrame(() => {
		const turn = Math.floor(motionClock.seconds * FLASHES_PER_SECOND) % 2;
		lenses.current.forEach((lens, i) => {
			if (lens) {
				lens.visible = light.on && i === turn;
			}
		});
	});
	const lens: TV3 = [0.1, 0.05, width * 0.34];
	return (
		<group position={position}>
			<Box size={[0.12, 0.04, width]} position={[0, 0.02, 0]} color="#2b2b2f" castShadow={false} />

			{[1, -1].map((side, i) => (
				<group key={side} position={[0, 0.06, (side * width) / 3]}>
					<mesh>
						<boxGeometry args={lens} />

						<Mat color={dark} roughness={0.4} />
					</mesh>

					{/* Lit in turn each frame: drawn on its own, not with other vehicles' (ADR-0086). */}
					<mesh
						ref={(mesh) => {
							lenses.current[i] = mesh;
						}}
						scale={1.04}
						visible={false}
						userData={{ notInstanced: true }}
					>
						<boxGeometry args={lens} />

						<meshBasicMaterial color={light.color} toneMapped={false} fog={false} />
					</mesh>
				</group>
			))}
		</group>
	);
};
