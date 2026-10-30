import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, Mat, spread } from "../primitives";
import { definePart } from "../types";

const FactorySchema = z.object({
	width: z.number().min(2).max(16).default(5),
	depth: z.number().min(2).max(12).default(3),
	showsChimney: z.boolean().default(true),
	chimneyHeight: z.number().min(1).max(10).default(4),
});

const WALL_HEIGHT = 1.4;
/** The sawtooth roof: each tooth's rise, and how many fit along. */
const TOOTH_RISE = 0.5;
const TOOTH_LENGTH = 1.1;

export const factory01 = definePart({
	kind: "factory_01",
	name: "Factory",
	category: "buildings",
	description: "Brick factory hall with a sawtooth roof and a tall chimney; its teeth face +Z",
	keywords: ["industry", "plant", "mill", "works", "industrial", "chimney", "warehouse"],
	schema: FactorySchema,
	renamedProps: { showChimney: "showsChimney" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 2, max: 16, step: 0.25 },
		{ key: "depth", label: "Depth", type: "number", min: 2, max: 12, step: 0.25 },
		{ key: "showsChimney", label: "Show the chimney", type: "boolean" },
		{ key: "chimneyHeight", label: "Chimney height", type: "number", min: 1, max: 10, step: 0.1 },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#a8553f", legacy: "color" },
		{ id: "roof", name: "Roof", default: "#6b6f73", legacy: "accent" },
		{ id: "chimney", name: "Chimney", default: "#8c4636" },
	],
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "The night shift, through the roof lights and the high windows.",
			shape: "glow",
			color: "#ffe6b0",
			realLight: (p) => ({ at: [0, 1.2, p.depth / 2 + 1], reach: p.width }),
		},
	],
	footprint: (p) => [p.width, p.depth],
	height: (p) => Math.max(WALL_HEIGHT + TOOTH_RISE, p.showsChimney ? p.chimneyHeight : 0),
	Component: ({ props: p, colors, palette, lights }) => {
		const teeth = Math.max(1, Math.round(p.depth / TOOTH_LENGTH));
		const tooth = p.depth / teeth;
		// The sloping face of each tooth: from the top of its glazing down to the next one.
		const slope = Math.hypot(tooth, TOOTH_RISE);
		const pitch = Math.atan2(TOOTH_RISE, tooth);
		const glow = lightEmission(lights.windows, 1.4);
		return (
			<group>
				<Box
					size={[p.width, WALL_HEIGHT, p.depth]}
					position={[0, WALL_HEIGHT / 2, 0]}
					color={colors.walls}
				/>

				{/* The teeth: a sloping roof down towards the back, and upright glazing facing the front. */}
				{spread(teeth, p.depth).map((z) => (
					<group key={z} position={[0, WALL_HEIGHT, z]}>
						<Box
							size={[p.width, 0.06, slope]}
							position={[0, TOOTH_RISE / 2, 0]}
							rotation={[-pitch, 0, 0]}
							color={colors.roof}
						/>

						<Box
							size={[p.width - 0.1, TOOTH_RISE, 0.04]}
							position={[0, TOOTH_RISE / 2, tooth / 2 - 0.02]}
							color={palette.glass}
							castShadow={false}
							{...glow}
						/>
					</group>
				))}

				{/* High windows along the front. */}
				{spread(Math.max(2, Math.round(p.width / 0.9)), p.width - 0.4).map((x) => (
					<Box
						key={x}
						size={[0.5, 0.35, 0.04]}
						position={[x, WALL_HEIGHT - 0.35, p.depth / 2 + 0.02]}
						color={palette.glass}
						castShadow={false}
						{...glow}
					/>
				))}

				{p.showsChimney && (
					<group position={[p.width / 2 - 0.4, 0, -p.depth / 2 + 0.4]}>
						<mesh position={[0, p.chimneyHeight / 2, 0]} castShadow>
							<cylinderGeometry args={[0.16, 0.24, p.chimneyHeight, 10]} />

							<Mat color={colors.chimney} />
						</mesh>

						{/* A darker band near the top. */}
						<mesh position={[0, p.chimneyHeight - 0.2, 0]}>
							<cylinderGeometry args={[0.175, 0.18, 0.12, 10]} />

							<Mat color={palette.tire} />
						</mesh>
					</group>
				)}
			</group>
		);
	},
});
