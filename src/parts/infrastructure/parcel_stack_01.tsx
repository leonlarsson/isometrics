import { z } from "zod";

import { Box, jitter } from "../primitives";
import { definePart } from "../types";

const ParcelsSchema = z.object({
	parcelCount: z.number().int().min(1).max(24).default(6),
});

export const parcelStack01 = definePart({
	kind: "parcel_stack_01",
	name: "Parcel stack",
	category: "infrastructure",
	description: "Pile of boxes on a pallet",
	keywords: ["boxes", "packages", "cargo", "pallet"],
	schema: ParcelsSchema,
	renamedProps: { count: "parcelCount" },
	fields: [
		{ key: "parcelCount", label: "Number of boxes", type: "number", min: 1, max: 24, step: 1 },
	],
	colors: [
		{ id: "boxes", name: "Boxes", default: (p) => p.cardboard, legacy: "color" },
		{ id: "pallet", name: "Pallet", default: "#c9b48f", legacy: "accent" },
	],
	footprint: () => [1.4, 1.4],
	height: (p) => 0.15 + Math.ceil(p.parcelCount / 4) * 0.42,
	Component: ({ props: p, colors }) => (
		<group>
			<Box size={[1.4, 0.12, 1.4]} position={[0, 0.06, 0]} color={colors.pallet} />

			{Array.from({ length: p.parcelCount }, (_, i) => {
				const layer = Math.floor(i / 4);
				const slot = i % 4;
				const x = (slot % 2 === 0 ? -0.32 : 0.32) + (jitter(i) - 0.5) * 0.08;
				const z = (slot < 2 ? -0.32 : 0.32) + (jitter(i + 50) - 0.5) * 0.08;
				const s = 0.52 + jitter(i + 100) * 0.12;
				return (
					<Box
						// biome-ignore lint/suspicious/noArrayIndexKey: boxes are positional
						key={i}
						size={[s, 0.38, s]}
						position={[x, 0.31 + layer * 0.42, z]}
						rotation={[0, (jitter(i + 7) - 0.5) * 0.3, 0]}
						color={colors.boxes}
					/>
				);
			})}
		</group>
	),
});
