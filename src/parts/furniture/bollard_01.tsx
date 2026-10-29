import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const BollardSchema = z.object({});

const HEIGHT = 0.95;

export const bollard01 = definePart({
	kind: "bollard_01",
	name: "Bollard",
	category: "furniture",
	description: "A short post that keeps cars off a pavement or square, with a reflective band",
	keywords: ["post", "barrier", "pavement", "pedestrian", "traffic", "street furniture"],
	schema: BollardSchema,
	fields: [],
	colors: [
		{ id: "post", name: "Post", default: "#2f3133", legacy: "color" },
		{ id: "band", name: "Band", default: "#e8e6df", legacy: "accent" },
	],
	footprint: () => [metres(0.26), metres(0.26)],
	height: () => metres(HEIGHT + 0.06),
	Component: ({ colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.1, 0.12, HEIGHT, 12]} />

				<Mat color={colors.post} />
			</mesh>

			<mesh position={[0, HEIGHT - 0.16, 0]}>
				<cylinderGeometry args={[0.104, 0.106, 0.08, 12]} />

				<Mat color={colors.band} roughness={0.3} />
			</mesh>

			{/* A rounded cap. */}
			<mesh position={[0, HEIGHT, 0]} castShadow>
				<sphereGeometry args={[0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />

				<Mat color={colors.post} />
			</mesh>
		</group>
	),
});
