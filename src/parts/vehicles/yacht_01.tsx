import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const YachtSchema = z.object({
	length: z.number().min(1.5).max(12).default(3.4),
	deckCount: z.number().int().min(1).max(4).default(2),
});

/** Hull outline seen from above: square stern, pointed bow towards +X. */
const hullGeometry = (length: number, width: number, height: number) => {
	const shape = new THREE.Shape();
	shape.moveTo(-length / 2, -width / 2);
	shape.lineTo(length * 0.2, -width / 2);
	shape.quadraticCurveTo(length * 0.45, -width / 2, length / 2, 0);
	shape.quadraticCurveTo(length * 0.45, width / 2, length * 0.2, width / 2);
	shape.lineTo(-length / 2, width / 2);
	shape.closePath();
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
	// Extruded along +Z; turn it so the extrusion goes up and the outline lies on the ground.
	geometry.rotateX(-Math.PI / 2);
	geometry.computeVertexNormals();
	return geometry;
};

const HULL_HEIGHT = 0.42;
const DECK_HEIGHT = 0.3;

export const yacht01 = definePart({
	kind: "yacht_01",
	name: "Yacht",
	category: "vehicles",
	lights: [
		{
			id: "cabins",
			name: "Cabin lights",
			shape: "glow",
			// Among the cabins, lighting the deck and the water round the yacht.
			realLight: (p) => ({
				at: [0, HULL_HEIGHT + p.deckCount * DECK_HEIGHT * 0.6, 0],
				reach: p.length * 0.9,
			}),
		},
	],
	description: "Motor yacht for harbours and the sea; can cruise along a route",
	keywords: ["boat", "ship", "ferry", "vessel"],
	schema: YachtSchema,
	renamedProps: { decks: "deckCount" },
	fields: [
		{ key: "length", label: "Length", type: "number", min: 1.5, max: 12, step: 0.1 },
		{ key: "deckCount", label: "Number of decks", type: "number", min: 1, max: 4, step: 1 },
	],
	colors: [
		{ id: "hull", name: "Hull", default: "#f7f7f4", legacy: "color" },
		{ id: "stripe", name: "Stripe", default: "#1f2a6b", legacy: "accent" },
	],
	canFollowPath: true,
	// From the square stern, as wide as the hull.
	wake: (p) => ({ width: p.length * 0.32, behind: p.length / 2 }),
	// Into the turn, like a motor boat: a few degrees in Lantern Bay's corners.
	turnLean: { degreesPerAcceleration: 8, maxDegrees: 10 },
	footprint: (p) => [p.length, p.length * 0.32],
	height: (p) => HULL_HEIGHT + p.deckCount * DECK_HEIGHT + 0.25,
	Component: ({ props: p, colors, palette, lights }) => {
		const width = p.length * 0.32;
		const hull = useMemo(() => hullGeometry(p.length, width, HULL_HEIGHT), [p.length, width]);
		const stripe = useMemo(
			() => hullGeometry(p.length * 1.01, width * 1.03, 0.07),
			[p.length, width],
		);
		useLayoutEffect(
			() => () => {
				hull.dispose();
				stripe.dispose();
			},
			[hull, stripe],
		);

		return (
			<group>
				<mesh geometry={hull} castShadow receiveShadow>
					<Mat color={colors.hull} />
				</mesh>

				<mesh geometry={stripe} position={[0, HULL_HEIGHT - 0.14, 0]}>
					<Mat color={colors.stripe} />
				</mesh>

				{Array.from({ length: p.deckCount }, (_, d) => {
					const deckLength = p.length * (0.5 - d * 0.1);
					const y = HULL_HEIGHT + DECK_HEIGHT * (d + 0.5);
					const x = -p.length * 0.06 - d * p.length * 0.04;
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: decks are positional
						<group key={d}>
							<Box
								size={[deckLength, DECK_HEIGHT, width * (0.72 - d * 0.08)]}
								position={[x, y, 0]}
								color={palette.wall}
							/>

							<Box
								size={[deckLength * 1.01, DECK_HEIGHT * 0.38, width * (0.72 - d * 0.08) + 0.02]}
								position={[x, y + 0.02, 0]}
								color={palette.glass}
								castShadow={false}
								// Cabin lights after dark, the lower decks a little brighter.
								{...lightEmission(lights.cabins, 1.1 - d * 0.15)}
							/>
						</group>
					);
				})}

				<Box
					size={[0.05, 0.25, 0.05]}
					position={[-p.length * 0.12, HULL_HEIGHT + p.deckCount * DECK_HEIGHT + 0.12, 0]}
					color={palette.trim}
				/>
			</group>
		);
	},
});
