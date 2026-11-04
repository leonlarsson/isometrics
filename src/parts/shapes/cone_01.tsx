import { z } from "zod";

import { definePart } from "../types";

import {
	arcAngleField,
	arcAngleProp,
	finishField,
	type IProfilePoint,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	SweptShape,
	shapeLights,
	sideCountField,
	sideCountProp,
	sizeField,
	sizeProps,
	wallThicknessField,
	wallThicknessFor,
	wallThicknessProp,
} from "./shapeKit";
import { coneTop } from "./shapeTops";

const ConeSchema = z.object({
	...lookProps,
	...sizeProps(),
	topWidthShare: z.number().min(0).max(1).default(0),
	sideCount: sideCountProp(16),
	isHollow: z.boolean().default(false),
	wallThickness: wallThicknessProp,
	arcAngle: arcAngleProp,
});

/** A cone's outline from the side, cut off at the top while `top` (a share of its foot) is above 0. */
const coneProfile = (height: number, top: number, wall: number | null): IProfilePoint[] => {
	const outer: IProfilePoint[] = [
		{ out: 1, y: 0 },
		{ out: top, y: height },
	];
	if (wall !== null) {
		return [...outer, { out: top, inset: wall, y: height }, { out: 1, inset: wall, y: 0 }];
	}
	return [{ out: 0, y: 0 }, ...outer, ...(top > 0 ? [{ out: 0, y: height }] : [])];
};

export const cone01 = definePart({
	kind: "cone_01",
	name: "Cone",
	category: "shapes",
	description:
		"A cone of any size, to a point or cut off flat (Top width); few sides make a pyramid of that many. Hollow it's a funnel or a lampshade",
	keywords: ["spire", "funnel", "frustum", "lampshade", "tip", "primitive", "shape"],
	schema: ConeSchema,
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
		sideCountField("sideCount"),
		{ key: "isHollow", label: "Hollow (only its walls)", type: "boolean" },
		wallThicknessField("wallThickness"),
		arcAngleField("arcAngle"),
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	topHeightAt: coneTop,
	Component: ({ props: p, colors, transparency, lights }) => (
		<SweptShape
			name="cone"
			options={{
				width: p.width,
				depth: p.depth,
				sideCount: p.sideCount,
				arcAngle: p.arcAngle,
				profile: coneProfile(
					p.height,
					p.topWidthShare,
					p.isHollow ? wallThicknessFor(p.width, p.depth, p.wallThickness) : null,
				),
			}}
			look={lookOf({ props: p, colors, transparency, lights })}
		/>
	),
});
