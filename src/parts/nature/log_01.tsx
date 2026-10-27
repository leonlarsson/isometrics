import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

const LogSchema = z.object({
	length: z.number().min(0.3).max(3).default(0.8),
});

const RADIUS = 0.09;

export const log01 = definePart({
	kind: "log_01",
	name: "Log",
	category: "nature",
	description: "Fallen tree trunk lying along X",
	keywords: ["wood", "timber", "trunk", "forest", "nature"],
	schema: LogSchema,
	fields: [{ key: "length", label: "Length", type: "number", min: 0.3, max: 3, step: 0.05 }],
	colors: [
		{ id: "bark", name: "Bark", default: "#6e5442", legacy: "color" },
		{ id: "cutEnds", name: "Cut ends", default: "#d6b98c", legacy: "accent" },
	],
	footprint: (p) => [p.length, RADIUS * 2],
	height: () => RADIUS * 2,
	Component: ({ props: p, colors }) => (
		// Lying down: cylinders stand along Y, so turned onto X.
		<group position={[0, RADIUS, 0]} rotation={[0, 0, Math.PI / 2]}>
			<mesh castShadow receiveShadow>
				<cylinderGeometry args={[RADIUS, RADIUS, p.length, 10]} />

				<Mat color={colors.bark} flat />
			</mesh>

			{[1, -1].map((end) => (
				// A hair beyond the bark's own ends, so the two don't flicker.
				<mesh key={end} position={[0, end * (p.length / 2 + 0.003), 0]}>
					<cylinderGeometry args={[RADIUS * 0.85, RADIUS * 0.85, 0.01, 10]} />

					<Mat color={colors.cutEnds} />
				</mesh>
			))}
		</group>
	),
});
