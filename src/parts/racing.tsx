import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { z } from "zod";

import { Box, Mat, RBox, spread, Wheel } from "./primitives";
import { definePart } from "./types";

// ----------------------------------------------------------------- race car

/** Modelled at 2 units long; shown about 1.2× a road car's length, like a real F1 car. */
const CAR_SCALE = 0.75;

export const raceCar = definePart({
	kind: "raceCar",
	name: "Race car",
	category: "vehicles",
	description: "Open-wheel race car; can drive along a road",
	schema: z.object({}),
	fields: [],
	defaultColor: "#d5232f",
	defaultAccent: "#1f1f24",
	colorLabel: "Livery",
	accentLabel: "Wings & details",
	canFollowPath: true,
	footprint: () => [2 * CAR_SCALE, 0.95 * CAR_SCALE],
	height: () => 0.65 * CAR_SCALE,
	Component: ({ color, accent, palette }) => (
		<group scale={CAR_SCALE}>
			{/* Floor, body and nose */}
			<Box size={[1.7, 0.06, 0.62]} position={[-0.05, 0.11, 0]} color={accent} />

			<RBox size={[1.2, 0.2, 0.34]} position={[0, 0.24, 0]} color={color} radius={0.08} />

			<Box size={[0.55, 0.11, 0.18]} position={[0.82, 0.19, 0]} color={color} />

			<Box size={[0.58, 0.17, 0.16]} position={[-0.12, 0.22, 0.27]} color={color} />

			<Box size={[0.58, 0.17, 0.16]} position={[-0.12, 0.22, -0.27]} color={color} />

			{/* Cockpit, helmet and engine cover */}
			<Box size={[0.32, 0.08, 0.22]} position={[0.12, 0.38, 0]} color={palette.tire} />

			<mesh position={[0.06, 0.44, 0]} castShadow>
				<sphereGeometry args={[0.08, 12, 12]} />

				<Mat color={accent} />
			</mesh>

			<Box size={[0.48, 0.2, 0.15]} position={[-0.36, 0.4, 0]} color={color} />

			{/* Wings */}
			<Box size={[0.16, 0.035, 0.84]} position={[1.04, 0.07, 0]} color={accent} />

			<Box size={[0.16, 0.035, 0.66]} position={[-0.84, 0.58, 0]} color={accent} />

			<Box size={[0.22, 0.22, 0.03]} position={[-0.84, 0.48, 0.33]} color={accent} />

			<Box size={[0.22, 0.22, 0.03]} position={[-0.84, 0.48, -0.33]} color={accent} />

			{[0.62, -0.62].flatMap((x) =>
				[0.42, -0.42].map((z) => (
					<Wheel
						key={`${x}:${z}`}
						position={[x, 0.16, z]}
						radius={0.16}
						width={0.16}
						color={palette.tire}
					/>
				)),
			)}
		</group>
	),
});

// --------------------------------------------------------------- grandstand

const GrandstandSchema = z.object({
	length: z.number().min(2).max(40).default(8),
	rows: z.number().int().min(1).max(10).default(4),
	crowd: z.boolean().default(true),
	roof: z.boolean().default(true),
});

const ROW_DEPTH = 0.55;
const ROW_RISE = 0.28;
const SPECTATOR_SPACING = 0.32;
const CROWD_COLORS = ["#e2603b", "#3d4fd6", "#f2c230", "#2bb58c", "#f7f7f4", "#8a5cf0", "#e85d75"];

/** Deterministic pseudo-random in [0, 1). */
const jitter = (i: number) => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

/** Many small spectators drawn as one instanced mesh. */
const Crowd = ({ positions }: { positions: [number, number, number][] }) => {
	const mesh = useRef<THREE.InstancedMesh>(null);
	useLayoutEffect(() => {
		const instances = mesh.current;
		if (!instances) {
			return;
		}
		const dummy = new THREE.Object3D();
		const tint = new THREE.Color();
		positions.forEach((position, i) => {
			dummy.position.set(...position);
			dummy.updateMatrix();
			instances.setMatrixAt(i, dummy.matrix);
			instances.setColorAt(
				i,
				tint.set(CROWD_COLORS[Math.floor(jitter(i + 3) * CROWD_COLORS.length)]),
			);
		});
		instances.instanceMatrix.needsUpdate = true;
		if (instances.instanceColor) {
			instances.instanceColor.needsUpdate = true;
		}
	}, [positions]);

	return (
		<instancedMesh
			// Recreate when the count changes: an instanced mesh has a fixed capacity.
			key={positions.length}
			ref={mesh}
			args={[undefined, undefined, positions.length]}
			castShadow
		>
			<boxGeometry args={[0.16, 0.22, 0.16]} />

			<meshStandardMaterial roughness={0.9} />
		</instancedMesh>
	);
};

export const grandstand = definePart({
	kind: "grandstand",
	name: "Grandstand",
	category: "buildings",
	description: "Stepped seating with spectators; faces +Z",
	schema: GrandstandSchema,
	fields: [
		{ key: "length", label: "Length", type: "number", min: 2, max: 40, step: 0.5 },
		{ key: "rows", label: "Rows", type: "number", min: 1, max: 10, step: 1 },
		{ key: "crowd", label: "Spectators", type: "boolean" },
		{ key: "roof", label: "Roof", type: "boolean" },
	],
	defaultColor: "#3d4fd6",
	defaultAccent: "#e4e1da",
	colorLabel: "Seats",
	accentLabel: "Structure",
	footprint: (p) => [p.length, p.rows * ROW_DEPTH],
	height: (p) => p.rows * ROW_RISE + (p.roof ? 1.3 : 0.3),
	Component: ({ props: p, color, accent }) => {
		const depth = p.rows * ROW_DEPTH;
		// Row 0 is the front (+Z), lowest; each row behind it is one step higher.
		const rows = Array.from({ length: p.rows }, (_, i) => ({
			z: depth / 2 - ROW_DEPTH / 2 - i * ROW_DEPTH,
			top: (i + 1) * ROW_RISE,
		}));
		const spectators = useMemo(
			() =>
				p.crowd
					? rows.flatMap((row, r) =>
							spread(Math.floor((p.length - 0.2) / SPECTATOR_SPACING), p.length - 0.2)
								.filter((_, i) => jitter(r * 97 + i) > 0.2)
								.map(
									(x, i) =>
										[x + (jitter(r * 31 + i) - 0.5) * 0.08, row.top + 0.17, row.z] as [
											number,
											number,
											number,
										],
								),
						)
					: [],
			// `rows` is derived from p.rows and p.length, so these are the real inputs.
			[p.crowd, p.rows, p.length],
		);
		const roofY = p.rows * ROW_RISE + 1.2;

		return (
			<group>
				{rows.map((row) => (
					<group key={row.z}>
						<Box
							size={[p.length, row.top, ROW_DEPTH]}
							position={[0, row.top / 2, row.z]}
							color={accent}
						/>

						<Box
							size={[p.length - 0.1, 0.05, ROW_DEPTH * 0.55]}
							position={[0, row.top + 0.025, row.z - 0.05]}
							color={color}
							castShadow={false}
						/>
					</group>
				))}

				{spectators.length > 0 && <Crowd positions={spectators} />}

				{p.roof && (
					<>
						{spread(Math.max(2, Math.round(p.length / 4)), p.length - 0.4).map((x) => (
							<Box
								key={x}
								size={[0.12, roofY, 0.12]}
								position={[x, roofY / 2, -depth / 2 + 0.1]}
								color={accent}
							/>
						))}

						<Box
							size={[p.length + 0.3, 0.12, depth + 0.6]}
							position={[0, roofY, 0.1]}
							rotation={[0.08, 0, 0]}
							color={accent}
						/>
					</>
				)}
			</group>
		);
	},
});
