import { z } from "zod";

import { definePart } from "../types";

import {
	arcAngleField,
	arcAngleProp,
	arcSteps,
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

const DomeSchema = z.object({
	...lookProps,
	...sizeProps({ height: 0.5 }),
	sideCount: sideCountProp(16),
	isHollow: z.boolean().default(false),
	wallThickness: wallThicknessProp,
	arcAngle: arcAngleProp,
});

/** A dome's outline from the side: a quarter of an oval, from its foot's edge to its top. */
const domeProfile = (height: number, sideCount: number, wall: number | null): IProfilePoint[] => {
	const steps = arcSteps(Math.max(2, Math.round(sideCount / 4)), 0, Math.PI / 2);
	const outer = steps.map((angle) => ({ out: Math.cos(angle), y: height * Math.sin(angle) }));
	if (wall === null) {
		return [{ out: 0, y: 0 }, ...outer];
	}
	const inner = [...steps].reverse().map((angle) => ({
		out: Math.cos(angle),
		inset: wall,
		y: Math.max(0, height - wall) * Math.sin(angle),
	}));
	return [...outer, ...inner];
};

export const dome01 = definePart({
	kind: "dome_01",
	name: "Dome",
	category: "shapes",
	description:
		"Half a ball of any size: a dome, a cupola, a mound; hollow, a shell or a bowl turned over",
	keywords: [
		"half ball",
		"hemisphere",
		"cupola",
		"mound",
		"bowl",
		"shell",
		"igloo",
		"primitive",
		"shape",
	],
	schema: DomeSchema,
	fields: [
		sizeField("width", "Width"),
		sizeField("depth", "Depth"),
		sizeField("height", "Height"),
		sideCountField("sideCount"),
		{ key: "isHollow", label: "Hollow (only its walls)", type: "boolean" },
		wallThicknessField("wallThickness"),
		arcAngleField("arcAngle"),
		finishField("finish"),
	],
	colors: SHAPE_COLORS,
	lights: shapeLights(),
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height,
	Component: ({ props: p, colors, transparency, lights }) => (
		<SweptShape
			name="dome"
			options={{
				width: p.width,
				depth: p.depth,
				sideCount: p.sideCount,
				arcAngle: p.arcAngle,
				profile: domeProfile(
					p.height,
					p.sideCount,
					p.isHollow
						? Math.min(wallThicknessFor(p.width, p.depth, p.wallThickness), p.height - 0.005)
						: null,
				),
			}}
			look={lookOf({ props: p, colors, transparency, lights })}
		/>
	),
});
