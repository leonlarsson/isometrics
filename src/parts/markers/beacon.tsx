import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

const BeaconSchema = z.object({
	radius: z.number().min(0.2).max(10).default(0.9),
	pulse: z.boolean().default(true),
});

const BeaconRing = ({
	radius,
	color,
	pulse,
	playing,
}: {
	radius: number;
	color: string;
	pulse: boolean;
	playing: boolean;
}) => {
	const ring = useRef<THREE.Mesh>(null);
	const material = useRef<THREE.MeshBasicMaterial>(null);
	useFrame(({ clock }) => {
		if (!ring.current || !material.current) {
			return;
		}
		const t = pulse && playing ? (clock.elapsedTime % 1.6) / 1.6 : 0.4;
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

export const beacon = definePart({
	kind: "beacon",
	name: "Beacon",
	category: "markers",
	description: "Pulsing ring to highlight a live spot",
	keywords: ["marker", "highlight", "pin", "ping"],
	schema: BeaconSchema,
	fields: [
		{ key: "radius", label: "Radius", type: "number", min: 0.2, max: 10, step: 0.1 },
		{ key: "pulse", label: "Pulse", type: "boolean" },
	],
	defaultColor: (p) => p.signal,
	defaultAccent: "#ffffff",
	colorLabel: "Ring",
	accentLabel: "Centre",
	footprint: (p) => [p.radius * 2, p.radius * 2],
	height: () => 0.3,
	Component: ({ props: p, color, accent, playing }) => (
		<group>
			<BeaconRing radius={p.radius} color={color} pulse={p.pulse} playing={playing} />

			<mesh position={[0, 0.12, 0]} castShadow>
				<sphereGeometry args={[0.14, 16, 16]} />

				<Mat color={color} />
			</mesh>

			<mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
				<circleGeometry args={[0.28, 24]} />

				<meshBasicMaterial color={accent} />
			</mesh>
		</group>
	),
});
