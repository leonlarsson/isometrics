import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Mat } from "../primitives";
import { definePart } from "../types";

const ParkLampSchema = z.object({
	height: z.number().min(0.5).max(3).default(1.05),
});

/** A soft white, a little warm, unless it's set. */
const GLOBE_LIGHT = "#fff0d2";
const GLOBE_RADIUS = 0.13;

export const streetLamp04 = definePart({
	kind: "street_lamp_04",
	name: "Street lamp",
	category: "infrastructure",
	description: "Park lamp: a glowing globe on a slim post, for paths, parks and promenades",
	keywords: ["light", "park", "globe", "path", "promenade", "garden", "street light"],
	schema: ParkLampSchema,
	fields: [{ key: "height", label: "Height", type: "number", min: 0.5, max: 3, step: 0.05 }],
	colors: [{ id: "post", name: "Post", default: "#33383c", legacy: "color" }],
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			shape: "pool",
			color: GLOBE_LIGHT,
			reach: 1.3,
			strength: 0.85,
			realLight: (p) => ({ at: [0, p.height + GLOBE_RADIUS, 0] }),
		},
	],
	footprint: () => [0.3, 0.3],
	height: (p) => p.height + GLOBE_RADIUS * 2,
	Component: ({ props: p, colors, lights }) => (
		<group>
			{/* A stepped foot, the post with a ring halfway up, and a cup under the globe. */}
			<mesh position={[0, 0.06, 0]} castShadow>
				<cylinderGeometry args={[0.06, 0.08, 0.12, 10]} />

				<Mat color={colors.post} />
			</mesh>

			<mesh position={[0, p.height / 2, 0]} castShadow>
				<cylinderGeometry args={[0.025, 0.035, p.height, 8]} />

				<Mat color={colors.post} />
			</mesh>

			<mesh position={[0, p.height * 0.55, 0]}>
				<cylinderGeometry args={[0.045, 0.045, 0.04, 10]} />

				<Mat color={colors.post} />
			</mesh>

			<mesh position={[0, p.height + 0.01, 0]} castShadow>
				<cylinderGeometry args={[0.07, 0.035, 0.05, 10]} />

				<Mat color={colors.post} />
			</mesh>

			{/* The globe: milky glass by day, glowing in the lamp's colour after dark. */}
			<mesh position={[0, p.height + GLOBE_RADIUS + 0.02, 0]} castShadow>
				<icosahedronGeometry args={[GLOBE_RADIUS, 2]} />

				<Mat color="#f1eee6" roughness={0.3} {...lightEmission(lights.lamp, 2)} />
			</mesh>

			<LightPool light={lights.lamp} />
		</group>
	),
});
