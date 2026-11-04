import { z } from "zod";

import { definePart } from "../types";

import {
	BoxMesh,
	finishField,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	shapeLights,
	sizeField,
	sizeProps,
} from "./shapeKit";
import { stairsTop } from "./shapeTops";

const StairsSchema = z.object({
	...lookProps,
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
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	topHeightAt: stairsTop,
	Component: ({ props: p, colors, transparency, lights }) => {
		const tread = p.depth / p.stepCount;
		const rise = p.height / p.stepCount;
		return (
			<group>
				{Array.from({ length: p.stepCount }, (_, i) => i + 1).map((step) => (
					<BoxMesh
						key={step}
						size={[p.width, rise * step, tread]}
						position={[0, 0, p.depth / 2 - tread * (step - 0.5)]}
						look={lookOf({ props: p, colors, transparency, lights })}
					/>
				))}
			</group>
		);
	},
});
