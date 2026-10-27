import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { z } from "zod";

import { motionClock } from "#/lib/motionClock";

import { Mat } from "../primitives";
import { definePart } from "../types";

const BeaconSchema = z.object({
	radius: z.number().min(0.2).max(10).default(0.9),
	pulses: z.boolean().default(true),
});

const BeaconRing = ({
	radius,
	color,
	pulse,
}: {
	radius: number;
	color: string;
	pulse: boolean;
}) => {
	const ring = useRef<THREE.Mesh>(null);
	const material = useRef<THREE.MeshBasicMaterial>(null);
	useFrame(() => {
		if (!ring.current || !material.current) {
			return;
		}
		// Held where it is while motion is paused.
		const t = pulse ? (motionClock.seconds % 1.6) / 1.6 : 0.4;
		ring.current.scale.setScalar(0.6 + t * 0.7);
		material.current.opacity = 0.9 * (1 - t);
	});
	return (
		<mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
			<ringGeometry args={[radius * 0.85, radius, 48]} />

			<meshBasicMaterial ref={material} color={color} transparent depthWrite={false} />
		</mesh>
	);
};

export const beacon01 = definePart({
	kind: "beacon_01",
	name: "Beacon",
	category: "markers",
	description: "Pulsing ring to highlight a live spot",
	keywords: ["marker", "highlight", "pin", "ping"],
	schema: BeaconSchema,
	renamedProps: { pulse: "pulses" },
	fields: [
		{ key: "radius", label: "Radius", type: "number", min: 0.2, max: 10, step: 0.1 },
		{ key: "pulses", label: "Pulses", type: "boolean" },
	],
	colors: [
		{ id: "ring", name: "Ring", default: (p) => p.signal, legacy: "color" },
		{ id: "centre", name: "Centre", default: "#ffffff", legacy: "accent" },
	],
	footprint: (p) => [p.radius * 2, p.radius * 2],
	height: () => 0.3,
	Component: ({ props: p, colors }) => (
		<group>
			<BeaconRing radius={p.radius} color={colors.ring} pulse={p.pulses} />

			<mesh position={[0, 0.12, 0]} castShadow>
				<sphereGeometry args={[0.14, 16, 16]} />

				<Mat color={colors.ring} />
			</mesh>

			<mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.28, 24]} />

				<meshBasicMaterial color={colors.centre} />
			</mesh>
		</group>
	),
});
