import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const CafeTableSchema = z.object({
	// 0.294 is the 0.7 m top it always had.
	diameter: z.number().min(0.2).max(1.2).default(0.294),
});

export const cafeTable01 = definePart({
	kind: "cafe_table_01",
	name: "Café table",
	category: "furniture",
	description: "Small round bistro table on one leg",
	keywords: ["table", "cafe", "bistro", "terrace", "restaurant", "round", "street furniture"],
	schema: CafeTableSchema,
	fields: [{ key: "diameter", label: "Width", type: "number", min: 0.2, max: 1.2, step: 0.02 }],
	colors: [
		{ id: "top", name: "Top", default: "#e8e2d6", legacy: "color" },
		{ id: "frame", name: "Leg and base", default: "#3a3b3d", legacy: "accent" },
	],
	footprint: (p) => [p.diameter, p.diameter],
	height: () => metres(0.76),
	Component: ({ props: p, colors }) => {
		// Drawn in metres; the base grows with a wider top so it stays steady.
		const radius = p.diameter / UNITS_PER_METRE / 2;
		const base = Math.max(1, radius / 0.35);
		return (
			<group scale={UNITS_PER_METRE}>
				<mesh position={[0, 0.74, 0]} castShadow receiveShadow>
					<cylinderGeometry args={[radius, radius, 0.03, 20]} />

					<Mat color={colors.top} />
				</mesh>

				<mesh position={[0, 0.37, 0]} castShadow>
					<cylinderGeometry args={[0.03, 0.03, 0.72, 8]} />

					<Mat color={colors.frame} />
				</mesh>

				<mesh position={[0, 0.015, 0]} castShadow receiveShadow>
					<cylinderGeometry args={[0.2 * base, 0.22 * base, 0.03, 16]} />

					<Mat color={colors.frame} />
				</mesh>
			</group>
		);
	},
});
