import { z } from "zod";

import { Box, jitter, Mat } from "../primitives";
import { definePart } from "../types";

const FlowerBedSchema = z.object({
	length: z.number().min(0.3).max(6).default(1.2),
	width: z.number().min(0.3).max(3).default(0.6),
});

/** Soil, between the plants. */
const SOIL = "#5a4030";
const EDGE_HEIGHT = 0.08;

/** At most this many flowers, however big the bed (they get further apart). */
const MOST_FLOWERS = 160;

/** How far apart flowers grow, until a big bed would need more than MOST_FLOWERS. */
const FLOWER_SPACING = 0.14;

export const flowerBed01 = definePart({
	kind: "flower_bed_01",
	name: "Flower bed",
	category: "nature",
	description: "Low bed of flowers in two colours, edged with stone",
	keywords: ["flowers", "garden", "park", "plants", "tulips", "nature"],
	schema: FlowerBedSchema,
	fields: [
		{ key: "length", label: "Length", type: "number", min: 0.3, max: 6, step: 0.05 },
		{ key: "width", label: "Width", type: "number", min: 0.3, max: 3, step: 0.05 },
	],
	colors: [
		{ id: "flowers", name: "Flowers", default: "#e9578a", legacy: "color" },
		{ id: "otherFlowers", name: "Other flowers", default: "#f2c94c", legacy: "accent" },
		{ id: "leaves", name: "Leaves", default: "#4e8a3e" },
		{ id: "edging", name: "Edging", default: "#a59f94" },
	],
	footprint: (p) => [p.length, p.width],
	height: () => 0.2,
	Component: ({ props: p, colors }) => {
		const spacing = Math.max(FLOWER_SPACING, Math.sqrt((p.length * p.width) / MOST_FLOWERS));
		const across = Math.max(1, Math.floor((p.length - 0.1) / spacing));
		const deep = Math.max(1, Math.floor((p.width - 0.1) / spacing));
		const flowers = Array.from({ length: across * deep }, (_, i) => {
			const column = i % across;
			const row = Math.floor(i / across);
			return {
				x: (column + 0.5) * ((p.length - 0.1) / across) - (p.length - 0.1) / 2,
				z: (row + 0.5) * ((p.width - 0.1) / deep) - (p.width - 0.1) / 2,
				y: 0.14 + jitter(i) * 0.04,
				// Rows of each colour, a little mixed.
				other: (row + (jitter(i + 77) < 0.15 ? 1 : 0)) % 2 === 1,
			};
		});
		return (
			<group>
				{/* The stone edging, and the soil and leaves inside it. */}
				<Box
					size={[p.length, EDGE_HEIGHT, p.width]}
					position={[0, EDGE_HEIGHT / 2, 0]}
					color={colors.edging}
				/>

				<mesh position={[0, EDGE_HEIGHT + 0.002, 0]}>
					<boxGeometry args={[p.length - 0.06, 0.004, p.width - 0.06]} />

					<Mat color={SOIL} />
				</mesh>

				<mesh position={[0, EDGE_HEIGHT + 0.03, 0]} castShadow receiveShadow>
					<boxGeometry args={[p.length - 0.1, 0.05, p.width - 0.1]} />

					<Mat color={colors.leaves} />
				</mesh>

				{flowers.map(({ x, y, z, other }) => (
					<mesh key={`${x},${z}`} position={[x, y, z]}>
						<icosahedronGeometry args={[0.04, 0]} />

						<Mat color={other ? colors.otherFlowers : colors.flowers} flat />
					</mesh>
				))}
			</group>
		);
	},
});
