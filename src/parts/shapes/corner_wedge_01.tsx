import { z } from "zod";

import { definePart } from "../types";

import {
	finishField,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	ShapeMesh,
	shapeLights,
	sizeField,
	sizeProps,
	solidGeometry,
	useShapeGeometry,
} from "./shapeKit";
import { cornerWedgeTop } from "./shapeTops";

const CornerWedgeSchema = z.object({
	...sizeProps(),
	...lookProps,
});

export const cornerWedge01 = definePart({
	kind: "corner_wedge_01",
	name: "Corner wedge",
	category: "shapes",
	description:
		"A corner piece of any size, its top at the back left corner (−X, −Z), sloping down to the front and the right: with wedges, a hip roof's corners; turned, a slope that turns a corner",
	keywords: [
		"hip roof",
		"roof corner",
		"corner",
		"slope",
		"ramp",
		"tetrahedron",
		"primitive",
		"shape",
	],
	schema: CornerWedgeSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	topHeightAt: cornerWedgeTop,
	Component: ({ props: p, colors, transparency, lights }) => {
		const [x, z] = [p.width / 2, p.depth / 2];
		const geometry = useShapeGeometry(`shape:cornerWedge:${p.width},${p.depth},${p.height}`, () =>
			solidGeometry(
				[
					[-x, 0, -z],
					[x, 0, -z],
					[x, 0, z],
					[-x, 0, z],
					[-x, p.height, -z],
				],
				[
					[0, 1, 2, 3],
					[0, 1, 4],
					[0, 3, 4],
					[1, 2, 4],
					[2, 3, 4],
				],
			),
		);
		return (
			<ShapeMesh geometry={geometry} look={lookOf({ props: p, colors, transparency, lights })} />
		);
	},
});
