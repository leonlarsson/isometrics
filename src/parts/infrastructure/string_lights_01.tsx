import { z } from "zod";

import { lightEmission } from "../lights";
import { Mat, spread } from "../primitives";
import { definePart } from "../types";

const StringLightsSchema = z.object({
	length: z.number().min(0.8).max(10).default(3),
	height: z.number().min(0.5).max(3).default(1.1),
});

/** How far the string sags in the middle, for each unit of its length. */
const SAG = 0.07;

/** About how far apart the bulbs hang. */
const BULB_SPACING = 0.22;

export const stringLights01 = definePart({
	kind: "string_lights_01",
	name: "String lights",
	category: "infrastructure",
	description: "A string of bulbs hanging between two poles, along X",
	keywords: ["festoon", "fairy lights", "party", "terrace", "garden", "light"],
	schema: StringLightsSchema,
	fields: [
		{ key: "length", label: "Length", type: "number", min: 0.8, max: 10, step: 0.1 },
		{ key: "height", label: "Height", type: "number", min: 0.5, max: 3, step: 0.1 },
	],
	colors: [{ id: "poles", name: "Poles", default: "#6b5a4a", legacy: "color" }],
	lights: [
		{
			id: "bulbs",
			name: "Bulbs",
			shape: "glow",
			color: "#ffd98a",
			comesOn: "gradually",
			// From the middle of the string, as far as it's long.
			realLight: (p) => ({
				at: [0, p.height - p.length * SAG, 0],
				reach: Math.max(1.5, p.length * 0.6),
			}),
		},
	],
	footprint: (p) => [p.length + 0.1, 0.2],
	height: (p) => p.height + 0.05,
	Component: ({ props: p, colors, lights }) => {
		const bulbs = Math.max(3, Math.round(p.length / BULB_SPACING));
		// The string sags like a chain: lowest in the middle, at the poles' tops at the ends.
		const sagAt = (x: number) => p.length * SAG * (1 - ((2 * x) / p.length) ** 2);
		return (
			<group>
				{[p.length / 2, -p.length / 2].map((x) => (
					<mesh key={x} position={[x, p.height / 2, 0]} castShadow>
						<cylinderGeometry args={[0.025, 0.03, p.height, 6]} />

						<Mat color={colors.poles} />
					</mesh>
				))}

				{spread(bulbs, p.length).map((x) => (
					<mesh key={x} position={[x, p.height - sagAt(x) - 0.03, 0]}>
						<sphereGeometry args={[0.035, 8, 6]} />

						<Mat color={lights.bulbs.color} {...lightEmission(lights.bulbs, 2.5)} />
					</mesh>
				))}
			</group>
		);
	},
});
