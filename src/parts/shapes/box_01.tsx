import { z } from "zod";

import { definePart } from "../types";

import {
	BoxMesh,
	SHAPE_COLORS,
	SweptShape,
	sizeField,
	sizeProps,
	wallsProfile,
	wallThicknessField,
	wallThicknessFor,
	wallThicknessProp,
} from "./shapeKit";

const BoxSchema = z.object({
	...sizeProps(),
	isHollow: z.boolean().default(false),
	wallThickness: wallThicknessProp,
});

export const box01 = definePart({
	kind: "box_01",
	name: "Box",
	category: "shapes",
	description:
		"A plain box of any width, depth and height: a block, a slab, a wall, a floor; hollow, only its four walls",
	keywords: ["cube", "block", "cuboid", "slab", "brick", "primitive", "shape", "wall", "floor"],
	schema: BoxSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		{ key: "isHollow", label: "Hollow (only its walls)", type: "boolean" },
		wallThicknessField("wallThickness"),
	],
	colors: SHAPE_COLORS,
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency }) =>
		p.isHollow ? (
			<SweptShape
				name="box"
				options={{
					width: p.width,
					depth: p.depth,
					sideCount: 4,
					profile: wallsProfile(p.height, wallThicknessFor(p.width, p.depth, p.wallThickness)),
				}}
				color={colors.surface}
				transparency={transparency.surface}
			/>
		) : (
			<BoxMesh
				size={[p.width, p.height, p.depth]}
				color={colors.surface}
				transparency={transparency.surface}
			/>
		),
});
