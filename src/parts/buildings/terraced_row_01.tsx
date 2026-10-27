import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, GableRoof, spread } from "../primitives";
import { definePart } from "../types";

const TerraceSchema = z.object({
	houseCount: z.number().int().min(1).max(10).default(4),
	houseWidth: z.number().min(0.8).max(2).default(1.1),
	depth: z.number().min(1).max(4).default(1.7),
});

const WALL_HEIGHT = 1.5;
const ROOF_HEIGHT = 0.75;

export const terracedRow01 = definePart({
	kind: "terraced_row_01",
	name: "Terraced houses",
	category: "buildings",
	description:
		"A row of narrow houses joined side by side under one roof, in two colours; along X, fronts facing +Z",
	keywords: ["row houses", "townhouses", "terrace", "homes", "residential", "street"],
	schema: TerraceSchema,
	fields: [
		{ key: "houseCount", label: "Number of houses", type: "number", min: 1, max: 10, step: 1 },
		{ key: "houseWidth", label: "House width", type: "number", min: 0.8, max: 2, step: 0.05 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 4, step: 0.1 },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#c9785a", legacy: "color" },
		{ id: "otherWalls", name: "Every other house's walls", default: "#e3c9a2", legacy: "accent" },
		{ id: "roof", name: "Roof", default: "#5d4a44" },
		{ id: "doors", name: "Doors", default: "#2f4a3c" },
	],
	lights: [
		{
			id: "windows",
			name: "Windows",
			shape: "glow",
			comesOn: "gradually",
			realLight: (p) => ({
				at: [0, 0.8, p.depth / 2 + 0.8],
				reach: p.houseCount * p.houseWidth,
			}),
		},
	],
	footprint: (p) => [p.houseCount * p.houseWidth + 0.2, p.depth + 0.3],
	height: () => WALL_HEIGHT + ROOF_HEIGHT,
	Component: ({ props: p, colors, palette, lights }) => {
		const width = p.houseCount * p.houseWidth;
		const front = p.depth / 2;
		return (
			<group>
				{spread(p.houseCount, width).map((x, i) => (
					<group key={x} position={[x, 0, 0]}>
						<Box
							size={[p.houseWidth, WALL_HEIGHT, p.depth]}
							position={[0, WALL_HEIGHT / 2, 0]}
							color={i % 2 === 0 ? colors.walls : colors.otherWalls}
						/>

						{/* A door and a window downstairs, two windows upstairs. */}
						<Box
							size={[0.24, 0.62, 0.05]}
							position={[p.houseWidth * 0.25, 0.31, front + 0.025]}
							color={colors.doors}
							castShadow={false}
						/>

						{[
							[-p.houseWidth * 0.2, 0.5],
							[-p.houseWidth * 0.2, 1.1],
							[p.houseWidth * 0.25, 1.1],
						].map(([wx, wy]) => (
							<Box
								key={`${wx},${wy}`}
								size={[0.26, 0.32, 0.04]}
								position={[wx, wy, front + 0.02]}
								color={palette.glass}
								castShadow={false}
								{...lightEmission(lights.windows, 1.3)}
							/>
						))}

						{/* A chimney on every other party wall. */}
						{i % 2 === 1 && (
							<Box
								size={[0.22, ROOF_HEIGHT, 0.26]}
								position={[-p.houseWidth / 2, WALL_HEIGHT + ROOF_HEIGHT * 0.55, -p.depth * 0.1]}
								color={palette.trim}
							/>
						)}
					</group>
				))}

				<GableRoof
					width={width + 0.2}
					depth={p.depth + 0.3}
					height={ROOF_HEIGHT}
					position={[0, WALL_HEIGHT, 0]}
					color={colors.roof}
				/>
			</group>
		);
	},
});
