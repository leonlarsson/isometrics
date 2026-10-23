import { z } from "zod";

import { Box, RBox } from "../primitives";
import { definePart } from "../types";

const ShedSchema = z.object({
	width: z.number().min(1).max(16).default(3.6),
	depth: z.number().min(1).max(16).default(3),
	height: z.number().min(0.5).max(6).default(1.6),
	garageDoor: z.boolean().default(true),
});

export const shed = definePart({
	kind: "shed",
	name: "Depot",
	category: "buildings",
	description: "Low flat-roofed building",
	keywords: ["garage", "depot", "workshop", "shop", "kiosk", "café", "store"],
	schema: ShedSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 16, step: 0.25 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 16, step: 0.25 },
		{ key: "height", label: "Height", type: "number", min: 0.5, max: 6, step: 0.1 },
		{ key: "garageDoor", label: "Garage door", type: "boolean" },
	],
	defaultColor: "#8a5cf0",
	defaultAccent: "#ece6fb",
	colorLabel: "Walls",
	accentLabel: "Roof",
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height + 0.2,
	Component: ({ props: p, color, accent, palette }) => (
		<group>
			<RBox
				size={[p.width, p.height, p.depth]}
				position={[0, p.height / 2, 0]}
				color={color}
				radius={0.08}
			/>

			<Box
				size={[p.width + 0.15, 0.16, p.depth + 0.15]}
				position={[0, p.height + 0.08, 0]}
				color={accent}
			/>

			{p.garageDoor && (
				<Box
					size={[Math.min(1.6, p.width * 0.5), p.height * 0.65, 0.05]}
					position={[0, (p.height * 0.65) / 2, p.depth / 2 + 0.025]}
					color={palette.trim}
					castShadow={false}
				/>
			)}
		</group>
	),
});
