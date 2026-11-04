import { z } from "zod";

import { definePart } from "../types";

import {
	finishField,
	lookOf,
	lookProps,
	prismGeometry,
	SHAPE_COLORS,
	ShapeMesh,
	shapeLights,
	sizeField,
	sizeProps,
	useShapeGeometry,
} from "./shapeKit";
import { wedgeTop } from "./shapeTops";

const WedgeSchema = z.object({
	...lookProps,
	...sizeProps(),
	ridgeShare: z.number().min(0).max(1).default(1),
});

export const wedge01 = definePart({
	kind: "wedge_01",
	name: "Wedge",
	category: "shapes",
	description:
		"A wedge of any size, its top edge running across (along X) from the front to the back (Ridge): at the back a ramp rising away from the front, in the middle a gable roof",
	keywords: ["ramp", "slope", "prism", "roof", "gable", "triangle", "primitive", "shape"],
	schema: WedgeSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		{
			key: "ridgeShare",
			label: "Ridge, front to back",
			type: "number",
			min: 0,
			max: 1,
			step: 0.05,
			presets: [
				{ label: "Front", value: 0 },
				{ label: "Middle", value: 0.5 },
				{ label: "Back", value: 1 },
			],
		},
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	topHeightAt: wedgeTop,
	Component: ({ props: p, colors, transparency, lights }) => {
		const ridge = p.depth / 2 - p.ridgeShare * p.depth;
		const geometry = useShapeGeometry(
			`shape:wedge:${p.width},${p.depth},${p.height},${ridge}`,
			() =>
				prismGeometry(
					[
						[p.depth / 2, 0],
						[ridge, p.height],
						[-p.depth / 2, 0],
					],
					p.width,
				),
		);
		return (
			<ShapeMesh geometry={geometry} look={lookOf({ props: p, colors, transparency, lights })} />
		);
	},
});
