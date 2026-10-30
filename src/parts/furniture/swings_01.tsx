import { z } from "zod";

import { Box, spread } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";
import { Rod } from "./playKit";

const SwingsSchema = z.object({
	seatCount: z.number().int().min(1).max(4).default(2),
});

/** The frame, in metres: how tall, and how far its legs spread at the foot. */
const FRAME = { height: 2.2, spread: 0.8 };
/** Each seat's share of the beam. */
const SEAT_SPACING = 0.9;

export const swings01 = definePart({
	kind: "swings_01",
	name: "Swings",
	category: "furniture",
	description:
		"A playground swing set: an A-frame at each end, a beam, seats on chains; they swing along Z",
	keywords: ["playground", "swing", "children", "kids", "park", "play", "street furniture"],
	schema: SwingsSchema,
	fields: [{ key: "seatCount", label: "Seats", type: "number", min: 1, max: 4, step: 1 }],
	colors: [
		{ id: "frame", name: "Frame", default: "#3d8f5b", legacy: "color" },
		{ id: "seats", name: "Seats", default: "#d6402f", legacy: "accent" },
	],
	footprint: (p) => [metres(p.seatCount * SEAT_SPACING + 0.6), metres(FRAME.spread * 2 + 0.2)],
	height: () => metres(FRAME.height + 0.1),
	Component: ({ props: p, colors }) => {
		const length = p.seatCount * SEAT_SPACING + 0.4;
		return (
			// Drawn in metres.
			<group scale={UNITS_PER_METRE}>
				{/* An A-frame at each end, and the beam along the top. */}
				{[length / 2, -length / 2].flatMap((x) =>
					[FRAME.spread, -FRAME.spread].map((z) => (
						<Rod
							key={`${x}:${z}`}
							from={[x, 0, z]}
							to={[x, FRAME.height, 0]}
							color={colors.frame}
							thickness={0.08}
						/>
					)),
				)}

				<Rod
					from={[-length / 2 - 0.05, FRAME.height, 0]}
					to={[length / 2 + 0.05, FRAME.height, 0]}
					color={colors.frame}
					thickness={0.1}
				/>

				{/* The seats on their chains. */}
				{spread(p.seatCount, p.seatCount * SEAT_SPACING).map((x) => (
					<group key={x}>
						{[0.2, -0.2].map((dx) => (
							<Rod
								key={dx}
								from={[x + dx, FRAME.height, 0]}
								to={[x + dx, 0.48, 0]}
								color="#8a9096"
								thickness={0.02}
								castShadow={false}
							/>
						))}

						<Box size={[0.48, 0.05, 0.2]} position={[x, 0.46, 0]} color={colors.seats} />
					</group>
				))}
			</group>
		);
	},
});
