import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, Mat, spread } from "../primitives";
import { definePart } from "../types";

import { AWNING_SLOPE, Awning } from "./shopKit";

const CafeSchema = z.object({
	width: z.number().min(1.2).max(8).default(2.2),
	depth: z.number().min(1).max(6).default(1.6),
	showStringLights: z.boolean().default(true),
});

const HEIGHT = 1.2;

/** The awning: where it starts on the wall, and how far it reaches out. */
const AWNING = { top: 0.9, depth: 0.34 };

/** Where the string of bulbs hangs: just under the awning's front edge. */
const STRING = {
	y: AWNING.top - Math.sin(AWNING_SLOPE) * AWNING.depth - 0.04,
	out: Math.cos(AWNING_SLOPE) * AWNING.depth,
};

export const cafe01 = definePart({
	kind: "cafe_01",
	name: "Café",
	category: "buildings",
	description:
		"Single-storey café with tall windows, a striped awning and a string of lights; its front faces +Z",
	keywords: ["coffee", "bistro", "restaurant", "bakery", "terrace", "awning"],
	schema: CafeSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1.2, max: 8, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 6, step: 0.1 },
		{ key: "showStringLights", label: "Show the string of lights", type: "boolean" },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#f3e3c3", legacy: "color" },
		{ id: "awning", name: "Awning", default: "#c8553d", legacy: "accent" },
		{ id: "frames", name: "Window frames and door", default: "#3d3f42" },
		{ id: "roof", name: "Roof", default: "#6f6a62" },
	],
	lights: [
		{
			id: "inside",
			name: "Inside",
			shape: "glow",
			// Through the windows, onto the terrace in front.
			realLight: (p) => ({ at: [0, 0.4, p.depth / 2 + 0.6], reach: Math.max(1.8, p.width) }),
		},
		{ id: "stringLights", name: "String of lights", shape: "glow", color: "#ffd98a" },
	],
	footprint: (p) => [p.width, p.depth + AWNING.depth],
	height: () => HEIGHT + 0.1,
	Component: ({ props: p, colors, palette, lights }) => {
		const front = p.depth / 2;
		const panes = Math.max(2, Math.round((p.width - 0.5) / 0.55));
		const bulbs = Math.max(4, Math.round(p.width / 0.18));
		return (
			<group>
				<Box size={[p.width, HEIGHT, p.depth]} position={[0, HEIGHT / 2, 0]} color={colors.walls} />

				<Box
					size={[p.width + 0.1, 0.1, p.depth + 0.1]}
					position={[0, HEIGHT + 0.05, 0]}
					color={colors.roof}
				/>

				{/* Tall windows across the front, the door at the right. */}
				{spread(panes, p.width - 0.5).map((x) => (
					<Box
						key={x}
						size={[0.4, 0.62, 0.04]}
						position={[x - 0.2, 0.39, front + 0.02]}
						color={palette.glass}
						castShadow={false}
						{...lightEmission(lights.inside, 1.4)}
					/>
				))}

				<Box
					size={[0.28, 0.7, 0.04]}
					position={[p.width / 2 - 0.25, 0.35, front + 0.02]}
					color={colors.frames}
					castShadow={false}
				/>

				<Box
					size={[p.width, 0.04, 0.03]}
					position={[0, 0.74, front + 0.02]}
					color={colors.frames}
					castShadow={false}
				/>

				<Awning
					width={p.width - 0.1}
					front={front}
					color={colors.awning}
					depth={AWNING.depth}
					top={AWNING.top}
				/>

				{/* Bulbs along the awning's edge, glowing after dark. */}
				{p.showStringLights &&
					spread(bulbs, p.width - 0.2).map((x, i) => (
						<mesh key={x} position={[x, STRING.y - (i % 2) * 0.03, front + STRING.out]}>
							<sphereGeometry args={[0.04, 8, 6]} />

							<Mat color={lights.stringLights.color} {...lightEmission(lights.stringLights, 2.5)} />
						</mesh>
					))}
			</group>
		);
	},
});
