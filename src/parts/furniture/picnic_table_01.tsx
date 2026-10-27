import { z } from "zod";

import { Box } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const PicnicTableSchema = z.object({
	length: z.number().min(0.4).max(3).default(0.75),
});

/** How far the legs splay out, in radians. */
const SPLAY = 0.42;

export const picnicTable01 = definePart({
	kind: "picnic_table_01",
	name: "Picnic table",
	category: "furniture",
	description: "Wooden table with a bench on each side",
	keywords: ["table", "bench", "park", "garden", "street furniture"],
	schema: PicnicTableSchema,
	fields: [{ key: "length", label: "Length", type: "number", min: 0.4, max: 3, step: 0.05 }],
	colors: [{ id: "wood", name: "Wood", default: "#b07d4b", legacy: "color" }],
	footprint: (p) => [p.length, metres(1.5)],
	height: () => metres(0.77),
	Component: ({ props: p, colors }) => {
		// Drawn in metres.
		const length = p.length / UNITS_PER_METRE;
		const legX = length / 2 - 0.2;
		return (
			<group scale={UNITS_PER_METRE}>
				{/* The top: three planks. */}
				{[-0.24, 0, 0.24].map((z) => (
					<Box key={z} size={[length, 0.04, 0.22]} position={[0, 0.75, z]} color={colors.wood} />
				))}

				{/* A bench on each side. */}
				{[-0.62, 0.62].map((z) => (
					<Box key={z} size={[length, 0.04, 0.26]} position={[0, 0.45, z]} color={colors.wood} />
				))}

				{/* At each end: two legs splayed out under the top, and the bar that carries the benches. */}
				{[legX, -legX].map((x) => (
					<group key={x} position={[x, 0, 0]}>
						{[1, -1].map((side) => (
							<Box
								key={side}
								size={[0.06, 0.8, 0.07]}
								position={[0, 0.37, side * 0.3]}
								rotation={[-side * SPLAY, 0, 0]}
								color={colors.wood}
							/>
						))}

						<Box size={[0.06, 0.05, 1.5]} position={[0, 0.41, 0]} color={colors.wood} />
					</group>
				))}
			</group>
		);
	},
});
