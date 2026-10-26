import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, RBox, spread } from "../primitives";
import { definePart } from "../types";

const WarehouseSchema = z.object({
	width: z.number().min(2).max(30).default(8),
	depth: z.number().min(2).max(30).default(5),
	height: z.number().min(1).max(10).default(3),
	doorCount: z.number().int().min(0).max(8).default(3),
	showSolarPanels: z.boolean().default(true),
});

export const warehouse01 = definePart({
	kind: "warehouse_01",
	name: "Warehouse",
	category: "buildings",
	lights: [
		{
			id: "doorways",
			name: "Doorways",
			shape: "glow",
			// In front of the loading doors, at the front.
			realLight: (p) => ({
				at: [0, Math.min(1.8, p.height * 0.6) * 0.6, p.depth / 2 + 0.8],
				reach: p.width * 0.6,
			}),
		},
	],
	description: "Large hall with loading doors and solar roof",
	keywords: ["factory", "hall", "storage", "logistics", "industrial"],
	schema: WarehouseSchema,
	renamedProps: { doors: "doorCount", solar: "showSolarPanels" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 2, max: 30, step: 0.5 },
		{ key: "depth", label: "Depth", type: "number", min: 2, max: 30, step: 0.5 },
		{ key: "height", label: "Height", type: "number", min: 1, max: 10, step: 0.25 },
		{ key: "doorCount", label: "Number of doors", type: "number", min: 0, max: 8, step: 1 },
		{ key: "showSolarPanels", label: "Show solar panels", type: "boolean" },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#3d4fd6", legacy: "color" },
		{ id: "roof", name: "Roof", default: "#e3e6f7", legacy: "accent" },
	],
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height + 0.4,
	Component: ({ props: p, colors, palette, lights }) => {
		const { width: w, depth: d, height: h } = p;
		const cols = Math.max(1, Math.floor((w - 1) / 1.5));
		const rows = Math.max(1, Math.floor((d - 1) / 1.5));
		const doorWidth = p.doorCount > 0 ? Math.min(1.3, ((w - 1) / p.doorCount) * 0.7) : 0;
		return (
			<group>
				<RBox size={[w, h, d]} position={[0, h / 2, 0]} color={colors.walls} radius={0.1} />

				<Box size={[w + 0.2, 0.22, d + 0.2]} position={[0, h + 0.11, 0]} color={colors.roof} />

				{p.showSolarPanels &&
					spread(cols, w - 0.8).flatMap((x) =>
						spread(rows, d - 0.8).map((z) => (
							<Box
								key={`${x}:${z}`}
								size={[1.15, 0.08, 0.95]}
								position={[x, h + 0.26, z]}
								rotation={[-0.12, 0, 0]}
								color={palette.panel}
								roughness={0.4}
							/>
						)),
					)}

				{spread(p.doorCount, w - 1).map((x) => (
					<Box
						key={x}
						size={[doorWidth, Math.min(1.8, h * 0.6), 0.06]}
						position={[x, Math.min(1.8, h * 0.6) / 2, d / 2 + 0.03]}
						color={palette.glass}
						castShadow={false}
						{...lightEmission(lights.doorways, 0.9)}
					/>
				))}

				<Box
					size={[0.9, 0.4, 0.06]}
					position={[w / 2 - 0.9, h * 0.82, d / 2 + 0.03]}
					color={palette.signal}
					castShadow={false}
				/>
			</group>
		);
	},
});
