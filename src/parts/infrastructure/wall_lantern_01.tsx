import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const WallLanternSchema = z.object({
	height: z.number().min(0.3).max(4).default(0.85),
});

/** A warm glow, unless it's set. */
const LANTERN_LIGHT = "#ffd27a";
/** How far the bracket holds the lantern out from the wall. */
const REACH = 0.16;
const LANTERN = { width: 0.09, height: 0.13 };

export const wallLantern01 = definePart({
	kind: "wall_lantern_01",
	name: "Wall lantern",
	category: "infrastructure",
	description:
		"A lantern on a bracket, to hang on a wall by a door; its back goes against the wall (−Z), it lights the ground in front (+Z)",
	keywords: ["light", "lantern", "wall", "door", "porch", "facade", "sconce"],
	schema: WallLanternSchema,
	fields: [{ key: "height", label: "Height", type: "number", min: 0.3, max: 4, step: 0.05 }],
	colors: [{ id: "metal", name: "Bracket and lantern", default: "#2b2d30", legacy: "color" }],
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			shape: "pool",
			color: LANTERN_LIGHT,
			reach: 0.9,
			strength: 0.9,
			// In front of the glass, away from the wall it hangs on.
			realLight: (p) => ({ at: [0, p.height - LANTERN.height / 2, REACH + 0.12] }),
		},
	],
	footprint: () => [0.16, REACH + 0.1],
	// It hangs on the wall: nothing of it stands on the ground.
	overhang: (p) => ({ foot: [0.04, 0.04], from: p.height - LANTERN.height - 0.05 }),
	height: (p) => p.height + 0.08,
	Component: ({ props: p, colors, lights }) => {
		const back = -(REACH + 0.1) / 2;
		const lanternZ = back + REACH;
		return (
			<group>
				{/* The plate on the wall, and the arm out from it. */}
				<Box size={[0.08, 0.14, 0.015]} position={[0, p.height, back]} color={colors.metal} />

				<Box
					size={[0.02, 0.02, REACH]}
					position={[0, p.height + 0.03, back + REACH / 2]}
					color={colors.metal}
				/>

				{/* The lantern hanging from the arm's end: a cap, the glass, a little base. */}
				<group position={[0, p.height - LANTERN.height / 2, lanternZ]}>
					<mesh
						position={[0, LANTERN.height / 2 + 0.03, 0]}
						rotation={[0, Math.PI / 4, 0]}
						castShadow
					>
						<coneGeometry args={[0.08, 0.06, 4]} />

						<Mat color={colors.metal} flat />
					</mesh>

					<Box
						size={[LANTERN.width, LANTERN.height, LANTERN.width]}
						color={lights.lamp.color}
						{...lightEmission(lights.lamp, 2.2)}
					/>

					<Box
						size={[LANTERN.width + 0.02, 0.02, LANTERN.width + 0.02]}
						position={[0, -LANTERN.height / 2 - 0.01, 0]}
						color={colors.metal}
					/>
				</group>

				<LightPool light={lights.lamp} at={[0, lanternZ + 0.15]} />
			</group>
		);
	},
});
