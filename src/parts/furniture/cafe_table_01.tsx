import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const CafeTableSchema = z.object({});

export const cafeTable01 = definePart({
	kind: "cafe_table_01",
	name: "Café table",
	category: "furniture",
	description: "Small round bistro table on one leg",
	keywords: ["table", "cafe", "bistro", "terrace", "restaurant", "street furniture"],
	schema: CafeTableSchema,
	fields: [],
	colors: [
		{ id: "top", name: "Top", default: "#e8e2d6", legacy: "color" },
		{ id: "frame", name: "Leg and base", default: "#3a3b3d", legacy: "accent" },
	],
	footprint: () => [metres(0.7), metres(0.7)],
	height: () => metres(0.76),
	Component: ({ colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<mesh position={[0, 0.74, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.35, 0.35, 0.03, 20]} />

				<Mat color={colors.top} />
			</mesh>

			<mesh position={[0, 0.37, 0]} castShadow>
				<cylinderGeometry args={[0.03, 0.03, 0.72, 8]} />

				<Mat color={colors.frame} />
			</mesh>

			<mesh position={[0, 0.015, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.2, 0.22, 0.03, 16]} />

				<Mat color={colors.frame} />
			</mesh>
		</group>
	),
});
