import { z } from "zod";

import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const ChairSchema = z.object({});

/** Where the legs stand, from the middle, in metres. */
const LEG = 0.18;

export const chair01 = definePart({
	kind: "chair_01",
	name: "Café chair",
	category: "furniture",
	description: "Bistro chair for a café terrace; you sit facing +Z",
	keywords: ["seat", "cafe", "terrace", "restaurant", "street furniture"],
	schema: ChairSchema,
	fields: [],
	colors: [
		{ id: "seat", name: "Seat and back", default: "#2f7a5d", legacy: "color" },
		{ id: "frame", name: "Frame", default: "#3a3b3d", legacy: "accent" },
	],
	footprint: () => [metres(0.45), metres(0.47)],
	height: () => metres(0.85),
	Component: ({ colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<Box size={[0.42, 0.04, 0.42]} position={[0, 0.45, 0]} color={colors.seat} />

			<Box
				size={[0.4, 0.3, 0.03]}
				position={[0, 0.66, -0.21]}
				rotation={[-0.1, 0, 0]}
				color={colors.seat}
			/>

			{[
				[LEG, LEG],
				[-LEG, LEG],
				[LEG, -LEG],
				[-LEG, -LEG],
			].map(([x, z]) => (
				<mesh key={`${x},${z}`} position={[x, 0.225, z]} castShadow>
					<cylinderGeometry args={[0.015, 0.015, 0.45, 6]} />

					<Mat color={colors.frame} />
				</mesh>
			))}

			{/* The back legs carry on up to the backrest. */}
			{[LEG, -LEG].map((x) => (
				<mesh key={x} position={[x, 0.63, -0.2]} rotation={[-0.1, 0, 0]} castShadow>
					<cylinderGeometry args={[0.015, 0.015, 0.36, 6]} />

					<Mat color={colors.frame} />
				</mesh>
			))}
		</group>
	),
});
