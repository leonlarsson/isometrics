import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, GableRoof, Mat, spread } from "../primitives";
import { definePart } from "../types";

const ChurchSchema = z.object({
	width: z.number().min(1.2).max(5).default(1.8),
	depth: z.number().min(2).max(10).default(3.4),
	towerHeight: z.number().min(1.5).max(8).default(3.4),
});

const WALL_HEIGHT = 1.4;
/** The tower's side, and its spire's height. */
const TOWER = { side: 0.9, spire: 1.4 };

export const church01 = definePart({
	kind: "church_01",
	name: "Church",
	category: "buildings",
	description: "Stone church with a long nave and a tower with a spire at the front (+Z)",
	keywords: ["chapel", "cathedral", "steeple", "spire", "religious", "landmark", "village"],
	schema: ChurchSchema,
	renamedProps: { length: "depth" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1.2, max: 5, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 2, max: 10, step: 0.1 },
		{ key: "towerHeight", label: "Tower height", type: "number", min: 1.5, max: 8, step: 0.1 },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#d8d2c4", legacy: "color" },
		{ id: "roof", name: "Roof and spire", default: "#5b6470", legacy: "accent" },
		{ id: "door", name: "Door", default: "#5a3d2e" },
	],
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "Candles and lamps inside, through the tall windows.",
			shape: "glow",
			color: "#ffcf7d",
			comesOn: "gradually",
			realLight: (p) => ({ at: [0, 1, 0], reach: Math.max(p.width, p.depth) * 1.2 }),
		},
	],
	footprint: (p) => [p.width + 0.3, p.depth + TOWER.side / 2],
	height: (p) => p.towerHeight + TOWER.spire,
	Component: ({ props: p, colors, palette, lights }) => {
		// The nave runs along Z; the tower stands at its front end.
		const naveFront = p.depth / 2 - TOWER.side / 2;
		const windows = Math.max(2, Math.round((p.depth - TOWER.side) / 0.7));
		return (
			<group>
				<Box
					size={[p.width, WALL_HEIGHT, p.depth - TOWER.side / 2]}
					position={[0, WALL_HEIGHT / 2, -TOWER.side / 4]}
					color={colors.walls}
				/>

				{/* Its ridge runs along the nave. */}
				<group position={[0, WALL_HEIGHT, -TOWER.side / 4]} rotation={[0, Math.PI / 2, 0]}>
					<GableRoof
						width={p.depth - TOWER.side / 2 + 0.2}
						depth={p.width + 0.3}
						height={p.width * 0.6}
						color={colors.roof}
					/>
				</group>

				{/* Tall windows along both sides. */}
				{spread(windows, p.depth - TOWER.side * 1.2).flatMap((z) =>
					[1, -1].map((side) => (
						<Box
							key={`${z},${side}`}
							size={[0.04, 0.7, 0.24]}
							position={[side * (p.width / 2 + 0.02), 0.75, z - TOWER.side / 2]}
							color={palette.glass}
							castShadow={false}
							{...lightEmission(lights.windows, 1.6)}
						/>
					)),
				)}

				{/* The tower, its belfry openings, the spire. */}
				<group position={[0, 0, naveFront]}>
					<Box
						size={[TOWER.side, p.towerHeight, TOWER.side]}
						position={[0, p.towerHeight / 2, 0]}
						color={colors.walls}
					/>

					<Box
						size={[0.34, 0.6, 0.05]}
						position={[0, 0.3, TOWER.side / 2 + 0.025]}
						color={colors.door}
						castShadow={false}
					/>

					{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
						<group key={turn} rotation={[0, turn, 0]}>
							<Box
								size={[0.26, 0.4, 0.04]}
								position={[0, p.towerHeight - 0.4, TOWER.side / 2 + 0.02]}
								color={palette.glass}
								castShadow={false}
							/>
						</group>
					))}

					<mesh
						position={[0, p.towerHeight + TOWER.spire / 2, 0]}
						rotation={[0, Math.PI / 4, 0]}
						castShadow
					>
						<coneGeometry args={[TOWER.side * 0.72, TOWER.spire, 4]} />

						<Mat color={colors.roof} flat />
					</mesh>
				</group>
			</group>
		);
	},
});
