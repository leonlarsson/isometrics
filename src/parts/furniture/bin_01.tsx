import { z } from "zod";

import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const BinSchema = z.object({});

/** The opening at the front, under the lid. */
const OPENING = "#1c1d1e";

export const bin01 = definePart({
	kind: "bin_01",
	name: "Litter bin",
	category: "furniture",
	description: "Round street bin with a lid; its opening faces +Z",
	keywords: ["trash", "rubbish", "waste", "garbage", "bin", "street furniture"],
	schema: BinSchema,
	fields: [],
	colors: [
		{ id: "body", name: "Body", default: "#3d6b4f", legacy: "color" },
		{ id: "lid", name: "Lid", default: "#2f3133", legacy: "accent" },
	],
	footprint: () => [metres(0.55), metres(0.55)],
	height: () => metres(0.88),
	Component: ({ colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<mesh position={[0, 0.4, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.24, 0.22, 0.8, 14]} />

				<Mat color={colors.body} />
			</mesh>

			<mesh position={[0, 0.83, 0]} castShadow>
				<cylinderGeometry args={[0.2, 0.26, 0.08, 14]} />

				<Mat color={colors.lid} />
			</mesh>

			<Box
				size={[0.22, 0.07, 0.03]}
				position={[0, 0.72, 0.235]}
				color={OPENING}
				castShadow={false}
			/>
		</group>
	),
});
