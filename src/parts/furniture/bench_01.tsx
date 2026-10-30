import { z } from "zod";

import { Box } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const BenchSchema = z.object({
	length: z.number().min(0.3).max(3).default(0.75),
	showsBackrest: z.boolean().default(true),
});

/** The backrest's lean, in radians. */
const LEAN = -0.15;

export const bench01 = definePart({
	kind: "bench_01",
	name: "Bench",
	category: "furniture",
	description: "Park bench with wooden slats; you sit facing +Z",
	keywords: ["seat", "park", "sit", "street furniture"],
	schema: BenchSchema,
	renamedProps: { showBackrest: "showsBackrest" },
	fields: [
		{ key: "length", label: "Length", type: "number", min: 0.3, max: 3, step: 0.05 },
		{ key: "showsBackrest", label: "Show the backrest", type: "boolean" },
	],
	colors: [
		{ id: "slats", name: "Slats", default: "#a8743f", legacy: "color" },
		{ id: "frame", name: "Frame", default: "#3d3f42", legacy: "accent" },
	],
	footprint: (p) => [p.length, metres(0.5)],
	height: (p) => metres(p.showsBackrest ? 0.86 : 0.47),
	Component: ({ props: p, colors }) => {
		// Drawn in metres.
		const length = p.length / UNITS_PER_METRE;
		const legX = length / 2 - 0.12;
		return (
			<group scale={UNITS_PER_METRE}>
				{/* The seat: three slats. */}
				{[0.15, 0, -0.15].map((z) => (
					<Box key={z} size={[length, 0.035, 0.13]} position={[0, 0.45, z]} color={colors.slats} />
				))}

				{p.showsBackrest &&
					[0.6, 0.76].map((y) => (
						<Box
							key={y}
							size={[length, 0.11, 0.035]}
							position={[0, y, -0.24 + (y - 0.6) * LEAN]}
							rotation={[LEAN, 0, 0]}
							color={colors.slats}
						/>
					))}

				{/* A frame at each end: the leg, and the post that holds the backrest. */}
				{[legX, -legX].map((x) => (
					<group key={x} position={[x, 0, 0]}>
						<Box size={[0.05, 0.43, 0.42]} position={[0, 0.215, 0]} color={colors.frame} />

						{p.showsBackrest && (
							<Box
								size={[0.05, 0.42, 0.05]}
								position={[0, 0.66, -0.26]}
								rotation={[LEAN, 0, 0]}
								color={colors.frame}
							/>
						)}
					</group>
				))}
			</group>
		);
	},
});
