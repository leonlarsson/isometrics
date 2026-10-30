import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { z } from "zod";

import { Box, jitter, spread } from "../primitives";
import { definePart } from "../types";

const GrandstandSchema = z.object({
	length: z.number().min(2).max(40).default(8),
	seatRowCount: z.number().int().min(1).max(10).default(4),
	showsCrowd: z.boolean().default(true),
	showsRoof: z.boolean().default(true),
});

const ROW_DEPTH = 0.55;
const ROW_RISE = 0.28;
const SPECTATOR_SPACING = 0.32;
const CROWD_COLORS = ["#e2603b", "#3d4fd6", "#f2c230", "#2bb58c", "#f7f7f4", "#8a5cf0", "#e85d75"];

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

export const grandstand01 = definePart({
	kind: "grandstand_01",
	name: "Grandstand",
	category: "buildings",
	description: "Stepped seating with spectators; faces +Z",
	keywords: ["stadium", "stand", "seats", "crowd", "arena", "spectators"],
	schema: GrandstandSchema,
	renamedProps: {
		rows: "seatRowCount",
		crowd: "showsCrowd",
		roof: "showsRoof",
		seatRows: "seatRowCount",
		showCrowd: "showsCrowd",
		showRoof: "showsRoof",
	},
	fields: [
		{ key: "length", label: "Length", type: "number", min: 2, max: 40, step: 0.5 },
		{ key: "seatRowCount", label: "Seat rows", type: "number", min: 1, max: 10, step: 1 },
		{ key: "showsCrowd", label: "Show spectators", type: "boolean" },
		{ key: "showsRoof", label: "Show the roof", type: "boolean" },
	],
	colors: [
		{ id: "seats", name: "Seats", default: "#3d4fd6", legacy: "color" },
		{ id: "structure", name: "Structure", default: "#e4e1da", legacy: "accent" },
	],
	footprint: (p) => [p.length, p.seatRowCount * ROW_DEPTH],
	height: (p) => p.seatRowCount * ROW_RISE + (p.showsRoof ? 1.3 : 0.3),
	Component: ({ props: p, colors }) => {
		const depth = p.seatRowCount * ROW_DEPTH;
		// Row 0 is the front (+Z), lowest; each row behind it is one step higher.
		const rows = Array.from({ length: p.seatRowCount }, (_, i) => ({
			z: depth / 2 - ROW_DEPTH / 2 - i * ROW_DEPTH,
			top: (i + 1) * ROW_RISE,
		}));
		const spectators = useMemo(
			() =>
				p.showsCrowd
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
			// `rows` is derived from p.seatRowCount and p.length, so these are the real inputs.
			[p.showsCrowd, p.seatRowCount, p.length],
		);
		const roofY = p.seatRowCount * ROW_RISE + 1.2;

		return (
			<group>
				{rows.map((row) => (
					<group key={row.z}>
						<Box
							size={[p.length, row.top, ROW_DEPTH]}
							position={[0, row.top / 2, row.z]}
							color={colors.structure}
						/>

						<Box
							size={[p.length - 0.1, 0.05, ROW_DEPTH * 0.55]}
							position={[0, row.top + 0.025, row.z - 0.05]}
							color={colors.seats}
							castShadow={false}
						/>
					</group>
				))}

				{spectators.length > 0 && <Crowd positions={spectators} />}

				{p.showsRoof && (
					<>
						{spread(Math.max(2, Math.round(p.length / 4)), p.length - 0.4).map((x) => (
							<Box
								key={x}
								size={[0.12, roofY, 0.12]}
								position={[x, roofY / 2, -depth / 2 + 0.1]}
								color={colors.structure}
							/>
						))}

						<Box
							size={[p.length + 0.3, 0.12, depth + 0.6]}
							position={[0, roofY, 0.1]}
							rotation={[0.08, 0, 0]}
							color={colors.structure}
						/>
					</>
				)}
			</group>
		);
	},
});
