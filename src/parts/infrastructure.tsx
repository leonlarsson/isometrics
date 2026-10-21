import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { z } from "zod";

import { Box, Mat } from "./primitives";
import { definePart } from "./types";

// --------------------------------------------------------------------- zone

const ZoneSchema = z.object({
	width: z.number().min(0.5).max(200).default(6),
	depth: z.number().min(0.5).max(200).default(4),
	shape: z.enum(["rect", "circle"]).default("rect"),
});

export const zone = definePart({
	kind: "zone",
	name: "Zone",
	category: "infrastructure",
	description: "Flat coloured area: parking, lawn, water, plaza",
	schema: ZoneSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 0.5, max: 200, step: 0.5 },
		{ key: "depth", label: "Depth", type: "number", min: 0.5, max: 200, step: 0.5 },
		{
			key: "shape",
			label: "Shape",
			type: "select",
			options: [
				{ value: "rect", label: "Rectangle" },
				{ value: "circle", label: "Circle / oval" },
			],
		},
	],
	defaultColor: "#cfe3f2",
	defaultAccent: "#ffffff",
	colorLabel: "Fill",
	accentLabel: "Unused",
	footprint: (p) => [p.width, p.depth],
	height: () => 0.05,
	Component: ({ props: p, color }) =>
		p.shape === "circle" ? (
			<mesh position={[0, 0.015, 0]} scale={[p.width / 2, 1, p.depth / 2]} receiveShadow>
				<cylinderGeometry args={[1, 1, 0.03, 48]} />

				<Mat color={color} />
			</mesh>
		) : (
			<Box
				size={[p.width, 0.03, p.depth]}
				position={[0, 0.015, 0]}
				color={color}
				castShadow={false}
			/>
		),
});

// --------------------------------------------------------------------- lamp

const LampSchema = z.object({
	height: z.number().min(0.5).max(6).default(1.6),
});

export const lamp = definePart({
	kind: "lamp",
	name: "Street lamp",
	category: "infrastructure",
	description: "Lamp post",
	schema: LampSchema,
	fields: [{ key: "height", label: "Height", type: "number", min: 0.5, max: 6, step: 0.1 }],
	defaultColor: "#9a9a96",
	defaultAccent: "#ffe8a3",
	colorLabel: "Post",
	accentLabel: "Light",
	footprint: () => [0.4, 0.4],
	height: (p) => p.height + 0.1,
	Component: ({ props: p, color, accent }) => (
		<group>
			<mesh position={[0, p.height / 2, 0]} castShadow>
				<cylinderGeometry args={[0.04, 0.05, p.height, 8]} />

				<Mat color={color} />
			</mesh>

			<mesh position={[0, p.height + 0.04, 0]}>
				<sphereGeometry args={[0.1, 12, 12]} />

				<Mat color={accent} emissive={accent} />
			</mesh>
		</group>
	),
});

// ------------------------------------------------------------------ parcels

const ParcelsSchema = z.object({
	count: z.number().int().min(1).max(24).default(6),
});

/** Deterministic pseudo-random in [0, 1) so stacks look varied but stable. */
const jitter = (i: number) => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

export const parcels = definePart({
	kind: "parcels",
	name: "Parcel stack",
	category: "infrastructure",
	description: "Pile of boxes on a pallet",
	schema: ParcelsSchema,
	fields: [{ key: "count", label: "Boxes", type: "number", min: 1, max: 24, step: 1 }],
	defaultColor: (p) => p.cardboard,
	defaultAccent: "#c9b48f",
	colorLabel: "Boxes",
	accentLabel: "Pallet",
	footprint: () => [1.4, 1.4],
	height: (p) => 0.15 + Math.ceil(p.count / 4) * 0.42,
	Component: ({ props: p, color, accent }) => (
		<group>
			<Box size={[1.4, 0.12, 1.4]} position={[0, 0.06, 0]} color={accent} />

			{Array.from({ length: p.count }, (_, i) => {
				const layer = Math.floor(i / 4);
				const slot = i % 4;
				const x = (slot % 2 === 0 ? -0.32 : 0.32) + (jitter(i) - 0.5) * 0.08;
				const z = (slot < 2 ? -0.32 : 0.32) + (jitter(i + 50) - 0.5) * 0.08;
				const s = 0.52 + jitter(i + 100) * 0.12;
				return (
					<Box
						// biome-ignore lint/suspicious/noArrayIndexKey: boxes are positional
						key={i}
						size={[s, 0.38, s]}
						position={[x, 0.31 + layer * 0.42, z]}
						rotation={[0, (jitter(i + 7) - 0.5) * 0.3, 0]}
						color={color}
					/>
				);
			})}
		</group>
	),
});

// ------------------------------------------------------------------- beacon

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
