import { z } from "zod";

import { definePart } from "../types";

import {
	finishField,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	SweptShape,
	shapeLights,
	sizeField,
	sizeProps,
} from "./shapeKit";

const PyramidSchema = z.object({
	...lookProps,
	...sizeProps(),
	topWidthShare: z.number().min(0).max(1).default(0),
});

export const pyramid01 = definePart({
	kind: "pyramid_01",
	name: "Pyramid",
	category: "shapes",
	description:
		"A four-sided pyramid on a rectangle of any size, to a point or cut off flat (Top width): a spire, a hip roof's top, a plinth",
	keywords: ["spire", "obelisk", "plinth", "frustum", "roof", "hip roof", "primitive", "shape"],
	schema: PyramidSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		{
			key: "topWidthShare",
			label: "Top width (share of the foot)",
			type: "number",
			min: 0,
			max: 1,
			step: 0.05,
		},
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency, lights }) => (
		<SweptShape
			name="pyramid"
			options={{
				width: p.width,
				depth: p.depth,
				sideCount: 4,
				profile: [
					{ out: 0, y: 0 },
					{ out: 1, y: 0 },
					{ out: p.topWidthShare, y: p.height },
					...(p.topWidthShare > 0 ? [{ out: 0, y: p.height }] : []),
				],
			}}
			look={lookOf({ props: p, colors, transparency, lights })}
		/>
	),
});
