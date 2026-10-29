import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const RoundTableSchema = z.object({
	diameter: z.number().min(0.2).max(1.2).default(0.34),
});

const HEIGHT = 0.74;

export const roundTable01 = definePart({
	kind: "round_table_01",
	name: "Round table",
	category: "furniture",
	description: "A round table on one pedestal, for café terraces and gardens",
	keywords: ["table", "cafe", "bistro", "terrace", "garden", "street furniture"],
	schema: RoundTableSchema,
	fields: [{ key: "diameter", label: "Width", type: "number", min: 0.2, max: 1.2, step: 0.02 }],
	colors: [
		{ id: "top", name: "Top", default: "#f4f1ea", legacy: "color" },
		{ id: "base", name: "Pedestal", default: "#3d3f42", legacy: "accent" },
	],
	footprint: (p) => [p.diameter, p.diameter],
	height: () => metres(HEIGHT + 0.03),
	Component: ({ props: p, colors }) => {
		// Drawn in metres.
		const radius = p.diameter / UNITS_PER_METRE / 2;
		return (
			<group scale={UNITS_PER_METRE}>
				<mesh position={[0, HEIGHT, 0]} castShadow receiveShadow>
					<cylinderGeometry args={[radius, radius, 0.035, 20]} />

					<Mat color={colors.top} />
				</mesh>

				<mesh position={[0, HEIGHT / 2, 0]} castShadow>
					<cylinderGeometry args={[0.035, 0.035, HEIGHT, 8]} />

					<Mat color={colors.base} />
				</mesh>

				<mesh position={[0, 0.02, 0]} castShadow receiveShadow>
					<cylinderGeometry
						args={[Math.min(0.3, radius * 0.7), Math.min(0.32, radius * 0.75), 0.04, 16]}
					/>

					<Mat color={colors.base} />
				</mesh>
			</group>
		);
	},
});
