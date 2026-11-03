import { z } from "zod";

import { definePart } from "../types";

import { OPENINGS, OpeningSchema, openingGeometry, openingKey } from "./openingKit";
import {
	finishField,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	ShapeMesh,
	SIZE,
	shapeLights,
	sizeField,
	useShapeGeometry,
} from "./shapeKit";

const PanelSchema = z.object({
	width: z.number().min(SIZE.min).max(SIZE.max).default(1),
	height: z.number().min(SIZE.min).max(SIZE.max).default(1),
	thickness: z.number().min(0.01).max(SIZE.max).default(0.1),
	opening: OpeningSchema,
	openingWidth: z.number().min(SIZE.min).max(SIZE.max).default(0.5),
	openingHeight: z.number().min(SIZE.min).max(SIZE.max).default(0.75),
	...lookProps,
});

export const panel01 = definePart({
	kind: "panel_01",
	name: "Panel",
	category: "shapes",
	description:
		"A flat upright panel of any width, height and thickness, facing the front (+Z): a wall, with a door, a window, a round window or an arch through it; lay it down for a floor or a roof",
	keywords: [
		"wall",
		"plane",
		"sheet",
		"plate",
		"board",
		"sign",
		"floor",
		"arch",
		"door",
		"window",
		"primitive",
		"shape",
	],
	schema: PanelSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("height", "Height"),
		{ key: "thickness", label: "Thickness", type: "number", min: 0.01, max: 5, step: 0.01 },
		{ key: "opening", label: "Opening", type: "select", options: [...OPENINGS] },
		sizeField("openingWidth", "Opening width"),
		sizeField("openingHeight", "Opening height"),
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	footprint: (p) => [p.width, p.thickness],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency, lights }) => {
		const geometry = useShapeGeometry(openingKey("panel", p, p.thickness), () =>
			openingGeometry(p, p.thickness),
		);
		return (
			<ShapeMesh geometry={geometry} look={lookOf({ props: p, colors, transparency, lights })} />
		);
	},
});
