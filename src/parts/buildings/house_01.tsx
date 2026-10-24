import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, GableRoof } from "../primitives";
import { definePart } from "../types";

const HouseSchema = z.object({
	width: z.number().min(1).max(8).default(2.4),
	depth: z.number().min(1).max(8).default(2.2),
	height: z.number().min(0.6).max(5).default(1.3),
	roofHeight: z.number().min(0.2).max(4).default(0.9),
	chimney: z.boolean().default(true),
});

export const house01 = definePart({
	kind: "house_01",
	name: "House",
	category: "buildings",
	lights: [{ id: "windows", name: "Windows", shape: "glow" }],
	description: "Small house with a pitched roof",
	keywords: ["home", "cottage", "villa", "residential"],
	schema: HouseSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "height", label: "Wall height", type: "number", min: 0.6, max: 5, step: 0.1 },
		{ key: "roofHeight", label: "Roof height", type: "number", min: 0.2, max: 4, step: 0.1 },
		{ key: "chimney", label: "Chimney", type: "boolean" },
	],
	defaultColor: "#f07b4f",
	defaultAccent: "#6b4a3a",
	colorLabel: "Roof",
	accentLabel: "Door",
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height + p.roofHeight,
	Component: ({ props: p, color, accent, palette, lights }) => (
		<group>
			<Box
				size={[p.width, p.height, p.depth]}
				position={[0, p.height / 2, 0]}
				color={palette.wall}
			/>

			<GableRoof
				width={p.width + 0.3}
				depth={p.depth + 0.4}
				height={p.roofHeight}
				position={[0, p.height, 0]}
				color={color}
			/>

			<Box
				size={[0.42, Math.min(0.8, p.height * 0.7), 0.05]}
				position={[p.width * 0.22, Math.min(0.8, p.height * 0.7) / 2, p.depth / 2 + 0.025]}
				color={accent}
				castShadow={false}
			/>

			<Box
				size={[0.45, 0.4, 0.05]}
				position={[-p.width * 0.22, p.height * 0.58, p.depth / 2 + 0.025]}
				color={palette.glass}
				castShadow={false}
				{...lightEmission(lights.windows, 1.4)}
			/>

			{p.chimney && (
				<Box
					size={[0.28, p.roofHeight * 0.9, 0.28]}
					position={[p.width * 0.28, p.height + p.roofHeight * 0.55, -p.depth * 0.15]}
					color={palette.trim}
				/>
			)}
		</group>
	),
});
