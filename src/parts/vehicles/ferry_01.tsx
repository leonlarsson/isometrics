import { useLayoutEffect, useMemo } from "react";
import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, Mat, spread } from "../primitives";
import { definePart } from "../types";

import { boatHullGeometry } from "./boatKit";

const FerrySchema = z.object({
	length: z.number().min(3).max(16).default(6.5),
});

const HULL_HEIGHT = 0.5;
const DECK_HEIGHT = 0.36;

export const ferry01 = definePart({
	kind: "ferry_01",
	name: "Ferry",
	category: "vehicles",
	description:
		"Passenger and car ferry with two cabin decks, a bridge and a funnel; can sail along a route",
	keywords: ["ship", "boat", "car ferry", "harbour", "crossing", "public transport"],
	schema: FerrySchema,
	fields: [{ key: "length", label: "Length", type: "number", min: 3, max: 16, step: 0.1 }],
	colors: [
		{ id: "hull", name: "Hull", default: "#1f2a6b", legacy: "color" },
		{ id: "funnel", name: "Funnel band", default: "#e2603b", legacy: "accent" },
		{ id: "decks", name: "Decks", default: "#f7f7f4" },
	],
	lights: [
		{
			id: "cabins",
			name: "Cabin lights",
			shape: "glow",
			realLight: (p) => ({ at: [0, HULL_HEIGHT + DECK_HEIGHT, 0], reach: p.length * 0.8 }),
		},
	],
	canFollowPath: true,
	wake: (p) => ({ width: p.length * 0.24, behind: p.length / 2 }),
	turnLean: { degreesPerAcceleration: 4, maxDegrees: 5 },
	footprint: (p) => [p.length, p.length * 0.24],
	height: () => HULL_HEIGHT + DECK_HEIGHT * 2 + 0.7,
	Component: ({ props: p, colors, palette, lights }) => {
		const width = p.length * 0.24;
		const hull = useMemo(() => boatHullGeometry(p.length, width, HULL_HEIGHT), [p.length, width]);
		useLayoutEffect(() => () => hull.dispose(), [hull]);
		const cabin = { length: p.length * 0.52, x: -p.length * 0.06 };
		const windows = Math.max(3, Math.round(cabin.length / 0.35));
		return (
			<group>
				<mesh geometry={hull} castShadow receiveShadow>
					<Mat color={colors.hull} />
				</mesh>

				{/* The car deck, open at the stern. */}
				<Box
					size={[p.length * 0.72, 0.03, width * 0.86]}
					position={[-p.length * 0.1, HULL_HEIGHT + 0.015, 0]}
					color={palette.trim}
				/>

				{/* Two cabin decks, a row of lit windows along each. */}
				{[0, 1].map((deck) => {
					const length = cabin.length * (1 - deck * 0.25);
					const y = HULL_HEIGHT + DECK_HEIGHT * (deck + 0.5) + 0.03;
					return (
						<group key={deck} position={[cabin.x + deck * p.length * 0.04, y, 0]}>
							<Box size={[length, DECK_HEIGHT, width * (0.8 - deck * 0.1)]} color={colors.decks} />

							{spread(windows - deck, length - 0.2).flatMap((x) =>
								[1, -1].map((side) => (
									<Box
										key={`${x},${side}`}
										size={[0.2, 0.14, 0.02]}
										position={[x, 0.04, side * (width * (0.4 - deck * 0.05) + 0.005)]}
										color={palette.glass}
										castShadow={false}
										{...lightEmission(lights.cabins, 1.2)}
									/>
								)),
							)}
						</group>
					);
				})}

				{/* The bridge at the front of the top deck, with windows all along its front. */}
				<group
					position={[cabin.x + cabin.length * 0.42, HULL_HEIGHT + DECK_HEIGHT * 2.3 + 0.03, 0]}
				>
					<Box size={[0.4, 0.22, width * 0.7]} color={colors.decks} />

					<Box
						size={[0.02, 0.1, width * 0.66]}
						position={[0.2, 0.03, 0]}
						color={palette.glass}
						castShadow={false}
						{...lightEmission(lights.cabins, 1.2)}
					/>
				</group>

				{/* The funnel, with a band in the company's colour. */}
				<group position={[cabin.x - cabin.length * 0.22, HULL_HEIGHT + DECK_HEIGHT * 2 + 0.03, 0]}>
					<mesh position={[0, 0.3, 0]} castShadow>
						<cylinderGeometry args={[0.14, 0.16, 0.6, 12]} />

						<Mat color={colors.decks} />
					</mesh>

					<mesh position={[0, 0.48, 0]}>
						<cylinderGeometry args={[0.145, 0.145, 0.14, 12]} />

						<Mat color={colors.funnel} />
					</mesh>
				</group>
			</group>
		);
	},
});
