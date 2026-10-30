import { z } from "zod";

import { Box } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";
import { Rod } from "./playKit";

const SlideSchema = z.object({});

/** The platform at the top of the ladder, in metres, and how far out the slide runs. */
const DECK = { height: 1.5, size: 0.8 };
const RUN = 2.4;

export const slide01 = definePart({
	kind: "slide_01",
	name: "Slide",
	category: "furniture",
	description:
		"A playground slide: a ladder up to a little deck with a roof, and the slide down along +X",
	keywords: ["playground", "slide", "children", "kids", "park", "play", "street furniture"],
	schema: SlideSchema,
	fields: [],
	colors: [
		{ id: "slide", name: "Slide", default: "#e8b83a", legacy: "color" },
		{ id: "frame", name: "Frame", default: "#3d6fd6", legacy: "accent" },
		{ id: "roof", name: "Roof", default: "#d6402f" },
	],
	footprint: () => [metres(DECK.size + RUN + 0.6), metres(DECK.size + 0.2)],
	height: () => metres(DECK.height + 1.4),
	Component: ({ colors }) => {
		const half = DECK.size / 2;
		const deckX = -(RUN + 0.6) / 2;
		return (
			// Drawn in metres.
			<group scale={UNITS_PER_METRE}>
				<group position={[deckX, 0, 0]}>
					{/* Four posts up to the roof, the deck between them, a ladder at the back. */}
					{[half, -half].flatMap((x) =>
						[half, -half].map((z) => (
							<Rod
								key={`${x}:${z}`}
								from={[x, 0, z]}
								to={[x, DECK.height + 1.1, z]}
								color={colors.frame}
								thickness={0.08}
							/>
						)),
					)}

					<Box
						size={[DECK.size + 0.08, 0.06, DECK.size + 0.08]}
						position={[0, DECK.height, 0]}
						color={colors.frame}
					/>

					{[0.25, 0.65, 1.05].map((y) => (
						<Box
							key={y}
							size={[0.05, 0.05, DECK.size - 0.1]}
							position={[-half - 0.25, y * (DECK.height / 1.3), 0]}
							color={colors.frame}
						/>
					))}

					{[half - 0.04, -half + 0.04].map((z) => (
						<Rod
							key={z}
							from={[-half - 0.45, 0, z]}
							to={[-half, DECK.height, z]}
							color={colors.frame}
							thickness={0.06}
						/>
					))}

					{/* A little pointed roof. */}
					<mesh position={[0, DECK.height + 1.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
						<coneGeometry args={[DECK.size * 0.85, 0.5, 4]} />

						<meshStandardMaterial color={colors.roof} roughness={0.8} flatShading />
					</mesh>
				</group>

				{/* The slide: its chute down to the ground, with low sides. */}
				<group
					position={[deckX + half, DECK.height, 0]}
					rotation={[0, 0, -Math.atan2(DECK.height - 0.25, RUN)]}
				>
					<Box
						size={[Math.hypot(RUN, DECK.height - 0.25), 0.04, 0.5]}
						position={[Math.hypot(RUN, DECK.height - 0.25) / 2, 0, 0]}
						color={colors.slide}
					/>

					{[0.26, -0.26].map((z) => (
						<Box
							key={z}
							size={[Math.hypot(RUN, DECK.height - 0.25), 0.14, 0.03]}
							position={[Math.hypot(RUN, DECK.height - 0.25) / 2, 0.07, z]}
							color={colors.slide}
						/>
					))}
				</group>
			</group>
		);
	},
});
