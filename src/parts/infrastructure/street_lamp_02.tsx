import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const LanternSchema = z.object({
	height: z.number().min(0.6).max(4).default(1.4),
});

/** A warm old-town glow, unless it's set. */
const LANTERN_LIGHT = "#ffd27a";

/** The lantern on top: its glass box and its cap. */
const LANTERN = { width: 0.18, height: 0.24 };

export const streetLamp02 = definePart({
	kind: "street_lamp_02",
	name: "Street lamp",
	category: "infrastructure",
	description: "Old-town lantern on a dark post",
	keywords: ["light", "lantern", "old town", "historic", "street light", "gas lamp"],
	schema: LanternSchema,
	fields: [{ key: "height", label: "Height", type: "number", min: 0.6, max: 4, step: 0.1 }],
	colors: [{ id: "post", name: "Post and lantern", default: "#2f3b34", legacy: "color" }],
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			shape: "pool",
			color: LANTERN_LIGHT,
			reach: 1.9,
			realLight: (p) => ({ at: [0, p.height + LANTERN.height / 2, 0] }),
		},
	],
	footprint: () => [0.4, 0.4],
	height: (p) => p.height + LANTERN.height + 0.12,
	Component: ({ props: p, colors, lights }) => (
		<group>
			{/* A wider foot, the post, and a collar under the lantern. */}
			<mesh position={[0, 0.08, 0]} castShadow>
				<cylinderGeometry args={[0.07, 0.09, 0.16, 8]} />

				<Mat color={colors.post} />
			</mesh>

			<mesh position={[0, p.height / 2, 0]} castShadow>
				<cylinderGeometry args={[0.035, 0.045, p.height, 8]} />

				<Mat color={colors.post} />
			</mesh>

			<Box size={[0.14, 0.03, 0.14]} position={[0, p.height, 0]} color={colors.post} />

			{/* The glass, glowing in the lamp's colour (a pale glass by day). */}
			<Box
				size={[LANTERN.width, LANTERN.height, LANTERN.width]}
				position={[0, p.height + LANTERN.height / 2 + 0.015, 0]}
				color={lights.lamp.color}
				{...lightEmission(lights.lamp, 2.2)}
			/>

			<mesh
				position={[0, p.height + LANTERN.height + 0.07, 0]}
				rotation={[0, Math.PI / 4, 0]}
				castShadow
			>
				<coneGeometry args={[0.16, 0.12, 4]} />

				<Mat color={colors.post} flat />
			</mesh>

			<LightPool light={lights.lamp} />
		</group>
	),
});
