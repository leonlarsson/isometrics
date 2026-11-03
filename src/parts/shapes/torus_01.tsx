import { z } from "zod";

import { definePart } from "../types";

import {
	arcAngleField,
	arcAngleProp,
	finishField,
	lookOf,
	lookProps,
	SHAPE_COLORS,
	SIZE,
	SweptShape,
	shapeLights,
	sideCountField,
	sideCountProp,
	sizeField,
	sizeProps,
} from "./shapeKit";

const TorusSchema = z.object({
	...lookProps,
	...sizeProps({ height: 0.25 }),
	ringThickness: z.number().min(SIZE.min).max(25).default(0.25),
	sideCount: sideCountProp(24),
	ringSideCount: z.number().int().min(3).max(32).default(8),
	arcAngle: arcAngleProp,
});

export const torus01 = definePart({
	kind: "torus_01",
	name: "Ring",
	category: "shapes",
	description:
		"A ring (a torus, a donut) lying flat, of any size, its band Ring thickness across and Height tall; part of the way round, an arc (a gauge, a donut chart's piece); turned up, an arch or a hoop",
	keywords: [
		"torus",
		"donut",
		"doughnut",
		"ring",
		"hoop",
		"tyre",
		"tire",
		"gauge",
		"primitive",
		"shape",
	],
	schema: TorusSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		{
			key: "ringThickness",
			label: "Ring thickness",
			type: "number",
			min: SIZE.min,
			max: 10,
			step: 0.05,
		},
		sideCountField("sideCount"),
		{ key: "ringSideCount", label: "Sides of the band", type: "number", min: 3, max: 32, step: 1 },
		arcAngleField("arcAngle"),
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	sizeAlong: { x: "width", y: "height", z: "depth" },
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency, lights }) => {
		// Half the band across, leaving a hole in the middle.
		const band = Math.min(p.ringThickness, Math.min(p.width, p.depth) / 2 - 0.005) / 2;
		return (
			<SweptShape
				name="torus"
				options={{
					width: p.width,
					depth: p.depth,
					sideCount: p.sideCount,
					arcAngle: p.arcAngle,
					profile: Array.from({ length: p.ringSideCount }, (_, i) => {
						const angle = (Math.PI * 2 * i) / p.ringSideCount;
						return {
							out: 1,
							inset: band * (1 - Math.cos(angle)),
							y: (p.height / 2) * (1 + Math.sin(angle)),
						};
					}),
				}}
				look={lookOf({ props: p, colors, transparency, lights })}
			/>
		);
	},
});
