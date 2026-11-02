import { z } from "zod";

import { definePart } from "../types";

import { BoxMesh, SHAPE_COLORS, sizeField, sizeProps } from "./shapeKit";

const StairsSchema = z.object({
	...sizeProps(),
	stepCount: z.number().int().min(1).max(40).default(5),
});

export const stairs01 = definePart({
	kind: "stairs_01",
	name: "Stairs",
	category: "shapes",
	description:
		"A flight of solid steps of any size, rising from the front (+Z) to the back; any number of steps",
	keywords: ["steps", "staircase", "stair", "terrace", "tiers", "primitive", "shape"],
	schema: StairsSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		{ key: "stepCount", label: "Steps", type: "number", min: 1, max: 40, step: 1 },
	],
	colors: SHAPE_COLORS,
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency }) => {
		const tread = p.depth / p.stepCount;
		const rise = p.height / p.stepCount;
		return (
			<group>
				{Array.from({ length: p.stepCount }, (_, i) => i + 1).map((step) => (
					<BoxMesh
						key={step}
						size={[p.width, rise * step, tread]}
						position={[0, 0, p.depth / 2 - tread * (step - 0.5)]}
						color={colors.surface}
						transparency={transparency.surface}
					/>
				))}
			</group>
		);
	},
});
