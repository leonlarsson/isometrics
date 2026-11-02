import { z } from "zod";

import { definePart } from "../types";

import type { IProfilePoint } from "./shapeKit";
import {
	arcAngleField,
	arcAngleProp,
	SHAPE_COLORS,
	SweptShape,
	sideCountField,
	sideCountProp,
	sizeField,
	sizeProps,
	wallThicknessField,
	wallThicknessFor,
	wallThicknessProp,
} from "./shapeKit";

const ConeSchema = z.object({
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
	],
	colors: SHAPE_COLORS,
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency }) => (
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
			color={colors.surface}
			transparency={transparency.surface}
		/>
	),
});
