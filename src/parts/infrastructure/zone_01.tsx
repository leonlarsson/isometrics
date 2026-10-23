import { z } from "zod";

import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const ZoneSchema = z.object({
	width: z.number().min(0.5).max(200).default(6),
	depth: z.number().min(0.5).max(200).default(4),
	shape: z.enum(["rect", "circle"]).default("rect"),
});

export const zone01 = definePart({
	kind: "zone_01",
	name: "Zone",
	category: "infrastructure",
	flat: true,
	description: "Flat coloured area: parking, lawn, water, plaza",
	keywords: ["area", "parking", "marker", "region"],
	schema: ZoneSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 0.5, max: 200, step: 0.5 },
		{ key: "depth", label: "Depth", type: "number", min: 0.5, max: 200, step: 0.5 },
		{
			key: "shape",
			label: "Shape",
			type: "select",
			options: [
				{ value: "rect", label: "Rectangle" },
				{ value: "circle", label: "Circle / oval" },
			],
		},
	],
	defaultColor: "#cfe3f2",
	defaultAccent: "#ffffff",
	colorLabel: "Fill",
	accentLabel: "Unused",
	footprint: (p) => [p.width, p.depth],
	height: () => 0.05,
	Component: ({ props: p, color }) =>
		p.shape === "circle" ? (
			<mesh position={[0, 0.015, 0]} scale={[p.width / 2, 1, p.depth / 2]} receiveShadow>
				<cylinderGeometry args={[1, 1, 0.03, 48]} />

				<Mat color={color} />
			</mesh>
		) : (
			<Box
				size={[p.width, 0.03, p.depth]}
				position={[0, 0.015, 0]}
				color={color}
				castShadow={false}
			/>
		),
});
