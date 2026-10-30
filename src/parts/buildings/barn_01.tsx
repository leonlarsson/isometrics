import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Box, GableRoof, Mat } from "../primitives";
import { definePart } from "../types";

const BarnSchema = z.object({
	width: z.number().min(1.5).max(8).default(2.4),
	depth: z.number().min(2).max(10).default(3.2),
});

const WALL_HEIGHT = 1.3;

/** The lamp over the doors: how high it hangs, and how far its bracket reaches out. */
const LAMP = { height: 1.17, reach: 0.16 };

export const barn01 = definePart({
	kind: "barn_01",
	name: "Barn",
	category: "buildings",
	description: "Red farm barn with big crossed doors and a lamp over them at the front (+Z)",
	keywords: ["farm", "stable", "shed", "countryside", "agriculture", "rural"],
	schema: BarnSchema,
	renamedProps: { length: "depth" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1.5, max: 8, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 2, max: 10, step: 0.1 },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#b23a2e", legacy: "color" },
		{ id: "trim", name: "Door trim", default: "#f2ede4", legacy: "accent" },
		{ id: "roof", name: "Roof", default: "#4a4e55" },
	],
	lights: [
		{
			id: "lamp",
			name: "Lamp over the doors",
			shape: "pool",
			reach: 1.2,
			realLight: (p) => ({ at: [0, LAMP.height - 0.12, p.depth / 2 + LAMP.reach] }),
		},
	],
	footprint: (p) => [p.width + 0.3, p.depth + 0.3],
	height: (p) => WALL_HEIGHT + p.width * 0.55,
	Component: ({ props: p, colors, lights }) => {
		const front = p.depth / 2;
		const door = { width: Math.min(1.2, p.width * 0.5), height: WALL_HEIGHT * 0.8 };
		const diagonal = Math.hypot(door.width / 2, door.height);
		const lean = Math.atan2(door.width / 2, door.height);
		return (
			<group>
				<Box
					size={[p.width, WALL_HEIGHT, p.depth]}
					position={[0, WALL_HEIGHT / 2, 0]}
					color={colors.walls}
				/>

				{/* Its ridge runs back from the front, so the gable faces the doors. */}
				<group position={[0, WALL_HEIGHT, 0]} rotation={[0, Math.PI / 2, 0]}>
					<GableRoof
						width={p.depth + 0.3}
						depth={p.width + 0.3}
						height={p.width * 0.55}
						color={colors.roof}
					/>
				</group>

				{/* Two doors, each framed and crossed in the trim colour. */}
				{[door.width / 4, -door.width / 4].map((x) => (
					<group key={x} position={[x, door.height / 2, front + 0.03]}>
						<Box
							size={[door.width / 2, door.height, 0.03]}
							color={colors.walls}
							castShadow={false}
						/>

						{[1, -1].map((side) => (
							<Box
								key={side}
								size={[0.05, diagonal, 0.02]}
								position={[0, 0, 0.025]}
								rotation={[0, 0, side * lean]}
								color={colors.trim}
								castShadow={false}
							/>
						))}

						{[door.height / 2, -door.height / 2].map((y) => (
							<Box
								key={y}
								size={[door.width / 2, 0.06, 0.02]}
								position={[0, y, 0.025]}
								color={colors.trim}
								castShadow={false}
							/>
						))}
					</group>
				))}

				{/* The lamp over the doors: a bracket out from the wall, a dark shade, and its bulb
				underneath, glowing when it's on. */}
				<group position={[0, LAMP.height, front]}>
					<Box
						size={[0.03, 0.03, LAMP.reach]}
						position={[0, 0, LAMP.reach / 2]}
						color={colors.roof}
					/>

					<Box size={[0.08, 0.12, 0.02]} position={[0, -0.02, 0.01]} color={colors.roof} />

					<mesh position={[0, -0.04, LAMP.reach]} castShadow>
						<coneGeometry args={[0.09, 0.07, 10, 1, true]} />

						<Mat color={colors.roof} />
					</mesh>

					<mesh position={[0, -0.08, LAMP.reach]}>
						<sphereGeometry args={[0.035, 8, 6]} />

						<Mat color={lights.lamp.color} {...lightEmission(lights.lamp, 2.5)} />
					</mesh>
				</group>

				<LightPool light={lights.lamp} at={[0, front + 0.6]} />
			</group>
		);
	},
});
