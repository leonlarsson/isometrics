import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Mat } from "../primitives";
import { definePart } from "../types";

const BollardLightSchema = z.object({});

const HEIGHT = 0.34;

export const bollardLight01 = definePart({
	kind: "bollard_light_01",
	name: "Bollard light",
	category: "infrastructure",
	description: "Knee-high post light for paths and parks",
	keywords: ["light", "path", "park", "garden", "bollard", "walkway"],
	schema: BollardLightSchema,
	fields: [],
	colors: [{ id: "body", name: "Body", default: "#3a3b3d", legacy: "color" }],
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			shape: "pool",
			reach: 0.75,
			realLight: () => ({ at: [0, HEIGHT - 0.06, 0] }),
		},
	],
	footprint: () => [0.16, 0.16],
	height: () => HEIGHT + 0.02,
	Component: ({ colors, lights }) => (
		<group>
			<mesh position={[0, (HEIGHT - 0.08) / 2, 0]} castShadow>
				<cylinderGeometry args={[0.05, 0.055, HEIGHT - 0.08, 10]} />

				<Mat color={colors.body} />
			</mesh>

			{/* The glowing band near the top, under a cap. */}
			<mesh position={[0, HEIGHT - 0.055, 0]}>
				<cylinderGeometry args={[0.046, 0.046, 0.05, 10]} />

				<Mat color={lights.lamp.color} {...lightEmission(lights.lamp, 2.2)} />
			</mesh>

			<mesh position={[0, HEIGHT - 0.015, 0]} castShadow>
				<cylinderGeometry args={[0.06, 0.055, 0.03, 10]} />

				<Mat color={colors.body} />
			</mesh>

			<LightPool light={lights.lamp} />
		</group>
	),
});
