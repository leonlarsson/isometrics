import { z } from "zod";

import { Box, Mat, Taper } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const SignpostSchema = z.object({
	armCount: z.number().int().min(1).max(4).default(3),
});

const HEIGHT = 2.6;
/** A fingerboard: its length and height, and how far apart they're stacked. */
const ARM = { length: 0.95, height: 0.17, step: 0.24 };
/** Which way each arm points, a quarter turn and a bit from the one above. */
const TURNS = [0, 2.2, 4.1, 1.1];

export const signpost01 = definePart({
	kind: "signpost_01",
	name: "Signpost",
	category: "furniture",
	description: "A fingerpost with arms pointing different ways, for paths and village crossroads",
	keywords: ["sign", "fingerpost", "direction", "waymarker", "path", "street furniture"],
	schema: SignpostSchema,
	fields: [{ key: "armCount", label: "Arms", type: "number", min: 1, max: 4, step: 1 }],
	colors: [
		{ id: "post", name: "Post", default: "#3d3f42", legacy: "color" },
		{ id: "arms", name: "Arms", default: "#f4f1ea", legacy: "accent" },
		{ id: "lettering", name: "Lettering", default: "#2f3133" },
	],
	footprint: () => [metres(ARM.length * 2), metres(ARM.length * 2)],
	// Its arms reach out above head height: only its post stands on the ground.
	overhang: () => ({ foot: [metres(0.12), metres(0.12)], from: metres(HEIGHT - 1.2) }),
	height: () => metres(HEIGHT + 0.08),
	Component: ({ props: p, colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.045, 0.05, HEIGHT, 10]} />

				<Mat color={colors.post} />
			</mesh>

			{/* A ball on the top. */}
			<mesh position={[0, HEIGHT + 0.04, 0]} castShadow>
				<sphereGeometry args={[0.07, 10, 8]} />

				<Mat color={colors.post} />
			</mesh>

			{TURNS.slice(0, p.armCount).map((turn, i) => (
				<group key={turn} position={[0, HEIGHT - 0.2 - i * ARM.step, 0]} rotation={[0, turn, 0]}>
					<Box
						size={[ARM.length, ARM.height, 0.03]}
						position={[ARM.length / 2 + 0.04, 0, 0]}
						color={colors.arms}
					/>

					{/* Its pointed end. */}
					<Taper
						length={0.12}
						back={[ARM.height, 0.03]}
						front={[0.01, 0.03]}
						position={[ARM.length + 0.1, 0, 0]}
						color={colors.arms}
					/>

					{/* A line of lettering on each face. */}
					{[1, -1].map((side) => (
						<Box
							key={side}
							size={[ARM.length * 0.7, 0.04, 0.004]}
							position={[ARM.length / 2, 0, side * 0.017]}
							color={colors.lettering}
							castShadow={false}
						/>
					))}
				</group>
			))}
		</group>
	),
});
