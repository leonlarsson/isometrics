import { z } from "zod";

import { definePart } from "../types";

import {
	arcSteps,
	finishField,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	SweptShape,
	shapeLights,
	sideCountField,
	sideCountProp,
	sizeField,
	sizeProps,
} from "./shapeKit";

const BallSchema = z.object({
	...lookProps,
	...sizeProps(),
	sideCount: sideCountProp(12),
});

export const ball01 = definePart({
	kind: "ball_01",
	name: "Ball",
	category: "shapes",
	description:
		"A ball of any size, an egg or a lens if its width, depth and height differ; few sides for a cut-gem look",
	keywords: ["sphere", "globe", "orb", "egg", "ellipsoid", "primitive", "shape"],
	schema: BallSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		sideCountField("sideCount"),
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency, lights }) => (
		<SweptShape
			name="ball"
			options={{
				width: p.width,
				depth: p.depth,
				sideCount: p.sideCount,
				profile: arcSteps(Math.max(2, Math.round(p.sideCount / 2)), 0, Math.PI).map((angle) => ({
					out: Math.sin(angle),
					y: (p.height / 2) * (1 - Math.cos(angle)),
				})),
			}}
			look={lookOf({ props: p, colors, transparency, lights })}
		/>
	),
});
