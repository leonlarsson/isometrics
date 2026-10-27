import { z } from "zod";

import { Box, jitter, Mat, spread } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const PlanterSchema = z.object({
	length: z.number().min(0.25).max(4).default(0.65),
});

/** Soil, under the shrubs. */
const SOIL = "#5a4030";

/** About how far apart the shrubs grow, in metres. */
const SHRUB_SPACING = 0.5;

export const planter01 = definePart({
	kind: "planter_01",
	name: "Planter",
	category: "furniture",
	description: "Long concrete planter box with shrubs",
	keywords: ["plants", "shrubs", "hedge", "flower box", "street furniture"],
	schema: PlanterSchema,
	fields: [{ key: "length", label: "Length", type: "number", min: 0.25, max: 4, step: 0.05 }],
	colors: [
		{ id: "box", name: "Box", default: "#a8a49a", legacy: "color" },
		{ id: "plants", name: "Plants", default: "#4b7f3a", legacy: "accent" },
	],
	footprint: (p) => [p.length, metres(0.5)],
	height: () => metres(0.85),
	Component: ({ props: p, colors }) => {
		// Drawn in metres.
		const length = p.length / UNITS_PER_METRE;
		const shrubs = Math.max(1, Math.round(length / SHRUB_SPACING));
		return (
			<group scale={UNITS_PER_METRE}>
				<Box size={[length, 0.5, 0.5]} position={[0, 0.25, 0]} color={colors.box} />

				<mesh position={[0, 0.505, 0]}>
					<boxGeometry args={[length - 0.08, 0.02, 0.42]} />

					<Mat color={SOIL} />
				</mesh>

				{spread(shrubs, length - 0.1).map((x, i) => (
					<mesh
						key={x}
						position={[x, 0.62, 0]}
						scale={[1, 0.75 + jitter(i) * 0.25, 1]}
						rotation={[0, jitter(i + 9) * Math.PI, 0]}
						castShadow
					>
						<icosahedronGeometry args={[0.24, 1]} />

						<Mat color={colors.plants} flat />
					</mesh>
				))}
			</group>
		);
	},
});
