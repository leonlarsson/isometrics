import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

const RocksSchema = z.object({
	rockCount: z.number().int().min(1).max(5).default(3),
});

/** The rocks, biggest first: [x, z, radius, turn]. */
const ROCKS = [
	[0, 0, 0.22, 0.2],
	[0.27, 0.12, 0.15, 1.1],
	[-0.22, 0.16, 0.12, 2.3],
	[0.1, -0.24, 0.1, 0.7],
	[-0.2, -0.18, 0.08, 1.8],
] as const;

/** How much flatter than round they are. */
const FLAT = 0.7;

export const rocks01 = definePart({
	kind: "rocks_01",
	name: "Rocks",
	category: "nature",
	description: "A few weathered rocks lying together",
	keywords: ["stone", "boulder", "pebbles", "garden", "nature"],
	schema: RocksSchema,
	fields: [{ key: "rockCount", label: "Number of rocks", type: "number", min: 1, max: 5, step: 1 }],
	colors: [{ id: "stone", name: "Stone", default: "#8d8a85", legacy: "color" }],
	footprint: (p) => (p.rockCount === 1 ? [0.45, 0.45] : [0.8, 0.7]),
	height: () => 0.22 * FLAT * 2,
	Component: ({ props: p, colors }) => (
		<group>
			{ROCKS.slice(0, p.rockCount).map(([x, z, radius, turn]) => (
				<mesh
					key={turn}
					position={[x, radius * FLAT * 0.8, z]}
					rotation={[turn * 0.3, turn, 0]}
					scale={[1, FLAT, 1]}
					castShadow
					receiveShadow
				>
					<dodecahedronGeometry args={[radius, 0]} />

					<Mat color={colors.stone} flat />
				</mesh>
			))}
		</group>
	),
});
