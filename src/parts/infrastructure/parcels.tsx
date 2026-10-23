import { z } from "zod";

import { Box, jitter } from "../primitives";
import { definePart } from "../types";

const ParcelsSchema = z.object({
	count: z.number().int().min(1).max(24).default(6),
});

export const parcels = definePart({
	kind: "parcels",
	name: "Parcel stack",
	category: "infrastructure",
	description: "Pile of boxes on a pallet",
	keywords: ["boxes", "packages", "cargo", "pallet"],
	schema: ParcelsSchema,
	fields: [{ key: "count", label: "Boxes", type: "number", min: 1, max: 24, step: 1 }],
	defaultColor: (p) => p.cardboard,
	defaultAccent: "#c9b48f",
	colorLabel: "Boxes",
	accentLabel: "Pallet",
	footprint: () => [1.4, 1.4],
	height: (p) => 0.15 + Math.ceil(p.count / 4) * 0.42,
	Component: ({ props: p, color, accent }) => (
		<group>
			<Box size={[1.4, 0.12, 1.4]} position={[0, 0.06, 0]} color={accent} />

			{Array.from({ length: p.count }, (_, i) => {
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
						color={color}
					/>
				);
			})}
		</group>
	),
});
