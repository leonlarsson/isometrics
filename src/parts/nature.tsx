import { z } from "zod";

import { Mat } from "./primitives";
import { definePart } from "./types";

const TreeSchema = z.object({
	size: z.number().min(0.3).max(4).default(1),
});

const sizeField = [
	{ key: "size", label: "Size", type: "number" as const, min: 0.3, max: 4, step: 0.1 },
];

export const tree = definePart({
	kind: "tree",
	name: "Round tree",
	category: "nature",
	description: "Leafy tree",
	keywords: ["oak", "plant", "nature", "park"],
	schema: TreeSchema,
	fields: sizeField,
	defaultColor: (p) => p.foliage,
	defaultAccent: (p) => p.trunk,
	colorLabel: "Leaves",
	accentLabel: "Trunk",
	footprint: (p) => [p.size, p.size],
	height: (p) => 1.45 * p.size,
	Component: ({ props: { size: s }, color, accent }) => (
		<group scale={s}>
			<mesh position={[0, 0.3, 0]} castShadow>
				<cylinderGeometry args={[0.07, 0.1, 0.6, 8]} />

				<Mat color={accent} />
			</mesh>

			<mesh position={[0, 0.95, 0]} castShadow receiveShadow>
				<icosahedronGeometry args={[0.48, 1]} />

				<Mat color={color} flat />
			</mesh>
		</group>
	),
});

export const pine = definePart({
	kind: "pine",
	name: "Pine tree",
	category: "nature",
	description: "Conifer made of stacked cones",
	keywords: ["fir", "spruce", "forest", "plant", "nature"],
	schema: TreeSchema,
	fields: sizeField,
	defaultColor: (p) => p.foliage,
	defaultAccent: (p) => p.trunk,
	colorLabel: "Needles",
	accentLabel: "Trunk",
	footprint: (p) => [p.size, p.size],
	height: (p) => 1.7 * p.size,
	Component: ({ props: { size: s }, color, accent }) => (
		<group scale={s}>
			<mesh position={[0, 0.2, 0]} castShadow>
				<cylinderGeometry args={[0.06, 0.08, 0.4, 8]} />

				<Mat color={accent} />
			</mesh>

			{[
				[0.5, 0.55, 0.62],
				[0.38, 0.5, 0.95],
				[0.26, 0.42, 1.27],
			].map(([radius, height, y]) => (
				<mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
					<coneGeometry args={[radius, height, 8]} />

					<Mat color={color} flat />
				</mesh>
			))}
		</group>
	),
});
