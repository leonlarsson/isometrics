import { z } from "zod";

import { definePart } from "../types";

import {
	arcAngleField,
	arcAngleProp,
	SHAPE_COLORS,
	SweptShape,
	sideCountField,
	sideCountProp,
	sizeField,
	sizeProps,
	wallsProfile,
	wallThicknessField,
	wallThicknessFor,
	wallThicknessProp,
} from "./shapeKit";

const CylinderSchema = z.object({
	...sizeProps(),
	sideCount: sideCountProp(16),
	isHollow: z.boolean().default(false),
	wallThickness: wallThicknessProp,
	arcAngle: arcAngleProp,
});

export const cylinder01 = definePart({
	kind: "cylinder_01",
	name: "Cylinder",
	category: "shapes",
	description:
		"A round column, disc or drum of any size, oval if its width and depth differ; few sides make a prism (six: a hexagon). Hollow it's a tube or pipe; part of the way round, a slice (a pie chart's)",
	keywords: [
		"column",
		"pillar",
		"disc",
		"drum",
		"prism",
		"hexagon",
		"tube",
		"pipe",
		"ring",
		"pie",
		"slice",
		"primitive",
		"shape",
	],
	schema: CylinderSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
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
			name="cylinder"
			options={{
				width: p.width,
				depth: p.depth,
				sideCount: p.sideCount,
				arcAngle: p.arcAngle,
				profile: p.isHollow
					? wallsProfile(p.height, wallThicknessFor(p.width, p.depth, p.wallThickness))
					: [
							{ out: 0, y: 0 },
							{ out: 1, y: 0 },
							{ out: 1, y: p.height },
							{ out: 0, y: p.height },
						],
			}}
			color={colors.surface}
			transparency={transparency.surface}
		/>
	),
});
