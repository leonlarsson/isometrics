import { z } from "zod";

import { definePart } from "../types";

import { openingGeometry, openingKey } from "./openingKit";
import {
	finishField,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	ShapeMesh,
	SIZE,
	shapeLights,
	sizeField,
	sizeProps,
	useShapeGeometry,
} from "./shapeKit";
import { flatTop } from "./shapeTops";

const ArchSchema = z.object({
	...sizeProps({ width: 1.5, depth: 0.5, height: 1.5 }),
	openingWidth: z.number().min(SIZE.min).max(SIZE.max).default(0.75),
	openingHeight: z.number().min(SIZE.min).max(SIZE.max).default(1),
	sideCount: z.number().int().min(2).max(32).default(8),
	...lookProps,
});

export const arch01 = definePart({
	kind: "arch_01",
	name: "Arch",
	category: "shapes",
	description:
		"A block of any size with an arched way through it from the front (+Z) to the back: a gateway, a bridge's span, an arcade (several side by side); straight sides up to a round top, as wide and tall as set",
	keywords: [
		"archway",
		"gate",
		"gateway",
		"arcade",
		"vault",
		"bridge",
		"opening",
		"primitive",
		"shape",
	],
	schema: ArchSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		sizeField("openingWidth", "Opening width"),
		sizeField("openingHeight", "Opening height"),
		{ key: "sideCount", label: "Sides of the curve", type: "number", min: 2, max: 32, step: 1 },
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	topHeightAt: flatTop,
	Component: ({ props: p, colors, transparency, lights }) => {
		const outline = { ...p, opening: "arch" as const };
		const geometry = useShapeGeometry(openingKey("arch", outline, p.depth, p.sideCount), () =>
			openingGeometry(outline, p.depth, p.sideCount),
		);
		return (
			<ShapeMesh geometry={geometry} look={lookOf({ props: p, colors, transparency, lights })} />
		);
	},
});
