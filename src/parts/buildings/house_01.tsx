import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, GableRoof } from "../primitives";
import { definePart } from "../types";

const HouseSchema = z.object({
	width: z.number().min(1).max(8).default(2.4),
	depth: z.number().min(1).max(8).default(2.2),
	height: z.number().min(0.6).max(5).default(1.3),
	roofHeight: z.number().min(0.2).max(4).default(0.9),
	showChimney: z.boolean().default(true),
});

export const house01 = definePart({
	kind: "house_01",
	name: "House",
	category: "buildings",
	lights: [{ id: "windows", name: "Windows", shape: "glow" }],
	description: "Small house with a pitched roof",
	keywords: ["home", "cottage", "villa", "residential"],
	schema: HouseSchema,
	renamedProps: { chimney: "showChimney" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "height", label: "Wall height", type: "number", min: 0.6, max: 5, step: 0.1 },
		{ key: "roofHeight", label: "Roof height", type: "number", min: 0.2, max: 4, step: 0.1 },
		{ key: "showChimney", label: "Show the chimney", type: "boolean" },
	],
	colors: [
		{ id: "roof", name: "Roof", default: "#f07b4f", legacy: "color" },
		{ id: "door", name: "Door", default: "#6b4a3a", legacy: "accent" },
	],
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height + p.roofHeight,
	Component: ({ props: p, colors, palette, lights }) => (
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
				color={colors.roof}
			/>

			<Box
				size={[0.42, Math.min(0.8, p.height * 0.7), 0.05]}
				position={[p.width * 0.22, Math.min(0.8, p.height * 0.7) / 2, p.depth / 2 + 0.025]}
				color={colors.door}
				castShadow={false}
			/>

			<Box
				size={[0.45, 0.4, 0.05]}
				position={[-p.width * 0.22, p.height * 0.58, p.depth / 2 + 0.025]}
				color={palette.glass}
				castShadow={false}
				{...lightEmission(lights.windows, 1.4)}
			/>

			{p.showChimney && (
				<Box
					size={[0.28, p.roofHeight * 0.9, 0.28]}
					position={[p.width * 0.28, p.height + p.roofHeight * 0.55, -p.depth * 0.15]}
					color={palette.trim}
				/>
			)}
		</group>
	),
});
