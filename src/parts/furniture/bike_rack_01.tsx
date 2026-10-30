import { z } from "zod";

import { Mat, spread } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const BikeRackSchema = z.object({
	standCount: z.number().int().min(1).max(12).default(4),
});

/** A stand's hoop, in metres: how tall its legs are before the bend, and half its width. */
const HOOP = { legs: 0.5, half: 0.32, tube: 0.025 };
/** How far apart the stands are along the row. */
const STEP = 0.8;

export const bikeRack01 = definePart({
	kind: "bike_rack_01",
	name: "Bike rack",
	category: "furniture",
	description: "A row of hoop stands to lock bikes to; the row runs along X",
	keywords: ["bicycle", "cycle", "parking", "stand", "hoop", "street furniture"],
	schema: BikeRackSchema,
	fields: [{ key: "standCount", label: "Stands", type: "number", min: 1, max: 12, step: 1 }],
	colors: [{ id: "hoops", name: "Hoops", default: "#7d8489", legacy: "color" }],
	footprint: (p) => [metres(p.standCount * STEP), metres(HOOP.half * 2 + 0.1)],
	height: () => metres(HOOP.legs + HOOP.half),
	Component: ({ props: p, colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			{spread(p.standCount, p.standCount * STEP).map((x) => (
				// Each hoop stands across the row, so bikes lean along it from either side.
				<group key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
					{[HOOP.half, -HOOP.half].map((side) => (
						<mesh key={side} position={[side, HOOP.legs / 2, 0]} castShadow>
							<cylinderGeometry args={[HOOP.tube, HOOP.tube, HOOP.legs, 8]} />

							<Mat color={colors.hoops} roughness={0.4} />
						</mesh>
					))}

					<mesh position={[0, HOOP.legs, 0]} castShadow>
						<torusGeometry args={[HOOP.half, HOOP.tube, 6, 16, Math.PI]} />

						<Mat color={colors.hoops} roughness={0.4} />
					</mesh>
				</group>
			))}
		</group>
	),
});
