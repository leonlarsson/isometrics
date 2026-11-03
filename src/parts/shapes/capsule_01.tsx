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

const CapsuleSchema = z.object({
	...lookProps,
	...sizeProps({ width: 0.5, depth: 0.5 }),
	sideCount: sideCountProp(16),
});

export const capsule01 = definePart({
	kind: "capsule_01",
	name: "Capsule",
	category: "shapes",
	description:
		"A cylinder with rounded ends, of any size: a pill, a tank, a post with a round top; lay it down for a pipe or a fuel tank",
	keywords: ["pill", "tank", "silo", "rounded", "primitive", "shape"],
	schema: CapsuleSchema,
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
	Component: ({ props: p, colors, transparency, lights }) => {
		// Its ends are as round as its narrower side allows, at most half its height each.
		const end = Math.min(Math.min(p.width, p.depth) / 2, p.height / 2);
		const steps = Math.max(2, Math.round(p.sideCount / 4));
		return (
			<SweptShape
				name="capsule"
				options={{
					width: p.width,
					depth: p.depth,
					sideCount: p.sideCount,
					profile: [
						...arcSteps(steps, 0, Math.PI / 2).map((angle) => ({
							out: Math.sin(angle),
							y: end * (1 - Math.cos(angle)),
						})),
						...arcSteps(steps, 0, Math.PI / 2).map((angle) => ({
							out: Math.cos(angle),
							y: p.height - end + end * Math.sin(angle),
						})),
					],
				}}
				look={lookOf({ props: p, colors, transparency, lights })}
			/>
		);
	},
});
