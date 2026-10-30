import { z } from "zod";

import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const StatueSchema = z.object({
	plinthHeight: z.number().min(0.2).max(4).default(1.3),
});

export const statue01 = definePart({
	kind: "statue_01",
	name: "Statue",
	category: "furniture",
	description: "A figure in bronze on a stone plinth, for a square or a park; it faces +Z",
	keywords: ["statue", "monument", "memorial", "sculpture", "bronze", "square", "street furniture"],
	schema: StatueSchema,
	fields: [
		{ key: "plinthHeight", label: "Plinth height", type: "number", min: 0.2, max: 4, step: 0.1 },
	],
	colors: [
		{ id: "figure", name: "Figure", default: "#5d7a63", legacy: "color" },
		{ id: "plinth", name: "Plinth", default: "#c9c2b5", legacy: "accent" },
	],
	footprint: () => [metres(1.3), metres(1.3)],
	height: (p) => metres(p.plinthHeight + 1.9),
	Component: ({ props: p, colors }) => {
		// Drawn in metres.
		const top = p.plinthHeight;
		return (
			<group scale={UNITS_PER_METRE}>
				{/* A stepped plinth with a plaque on its front. */}
				<Box size={[1.3, 0.15, 1.3]} position={[0, 0.075, 0]} color={colors.plinth} />

				<Box
					size={[1, top - 0.25, 1]}
					position={[0, 0.15 + (top - 0.25) / 2, 0]}
					color={colors.plinth}
				/>

				<Box size={[1.15, 0.1, 1.15]} position={[0, top - 0.05, 0]} color={colors.plinth} />

				<Box
					size={[0.5, 0.3, 0.02]}
					position={[0, top * 0.55, 0.51]}
					color={colors.figure}
					castShadow={false}
				/>

				{/* The figure standing on it: legs, a coat, an arm raised, a head. */}
				<group position={[0, top, 0]}>
					{[0.1, -0.1].map((x) => (
						<Box key={x} size={[0.14, 0.8, 0.16]} position={[x, 0.4, 0]} color={colors.figure} />
					))}

					<mesh position={[0, 1.15, 0]} castShadow>
						<cylinderGeometry args={[0.2, 0.3, 0.85, 8]} />

						<Mat color={colors.figure} roughness={0.5} />
					</mesh>

					<Box
						size={[0.11, 0.6, 0.11]}
						position={[-0.26, 1.15, 0]}
						rotation={[0, 0, -0.15]}
						color={colors.figure}
					/>

					<Box
						size={[0.11, 0.6, 0.11]}
						position={[0.32, 1.65, 0.05]}
						rotation={[0.2, 0, -0.6]}
						color={colors.figure}
					/>

					<mesh position={[0, 1.75, 0]} castShadow>
						<sphereGeometry args={[0.15, 10, 8]} />

						<Mat color={colors.figure} roughness={0.5} />
					</mesh>
				</group>
			</group>
		);
	},
});
