import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Box, spread } from "../primitives";
import { definePart } from "../types";

const PetrolStationSchema = z.object({
	pumpCount: z.number().int().min(1).max(4).default(2),
	showsShop: z.boolean().default(true),
});

const CANOPY = { height: 1.15, depth: 2, thickness: 0.18 };
/** How far apart the pump islands stand along X. */
const ISLAND_SPACING = 1.3;

export const petrolStation01 = definePart({
	kind: "petrol_station_01",
	name: "Petrol station",
	category: "buildings",
	description: "Filling station: pump islands under a lit canopy, with a small shop behind (-Z)",
	keywords: ["gas station", "fuel", "garage", "service station", "pumps", "filling station"],
	schema: PetrolStationSchema,
	renamedProps: { showShop: "showsShop" },
	fields: [
		{ key: "pumpCount", label: "Number of pump islands", type: "number", min: 1, max: 4, step: 1 },
		{ key: "showsShop", label: "Show the shop", type: "boolean" },
	],
	colors: [
		{ id: "brand", name: "Canopy band and pumps", default: "#d83a2e", legacy: "color" },
		{ id: "canopy", name: "Canopy", default: "#f4f4f2", legacy: "accent" },
		{ id: "shop", name: "Shop walls", default: "#e8e4dc" },
	],
	lights: [
		{
			id: "canopyLights",
			name: "Canopy lights",
			description: "Bright downlights under the canopy.",
			shape: "pool",
			color: "#f8f6ee",
			reach: 1.6,
			realLight: () => ({ at: [0, CANOPY.height - 0.1, 0] }),
		},
		{ id: "shopWindow", name: "Shop window", shape: "glow" },
	],
	footprint: (p) => [
		Math.max(2.6, p.pumpCount * ISLAND_SPACING + 0.6),
		CANOPY.depth + (p.showsShop ? 1.6 : 0),
	],
	height: () => CANOPY.height + CANOPY.thickness,
	Component: ({ props: p, colors, palette, lights }) => {
		const width = Math.max(2.6, p.pumpCount * ISLAND_SPACING + 0.6);
		const islands = spread(p.pumpCount, p.pumpCount * ISLAND_SPACING);
		return (
			<group>
				{/* The canopy: a white slab with a band round it, on a post at each island's ends. */}
				<Box
					size={[width, CANOPY.thickness, CANOPY.depth]}
					position={[0, CANOPY.height + CANOPY.thickness / 2, 0]}
					color={colors.canopy}
				/>

				<Box
					size={[width + 0.02, CANOPY.thickness * 0.6, CANOPY.depth + 0.02]}
					position={[0, CANOPY.height + CANOPY.thickness * 0.55, 0]}
					color={colors.brand}
				/>

				{/* Its lamps underneath, glowing when on. */}
				<Box
					size={[width - 0.3, 0.02, CANOPY.depth - 0.3]}
					position={[0, CANOPY.height - 0.01, 0]}
					color={colors.canopy}
					castShadow={false}
					{...lightEmission(lights.canopyLights, 1.5)}
				/>

				{islands.map((x) => (
					<group key={x} position={[x, 0, 0]}>
						<Box size={[0.4, 0.08, 1.2]} position={[0, 0.04, 0]} color={palette.trim} />

						{[0.35, -0.35].map((z) => (
							<Box key={z} size={[0.2, 0.5, 0.14]} position={[0, 0.33, z]} color={colors.brand} />
						))}

						<Box
							size={[0.08, CANOPY.height, 0.08]}
							position={[0, CANOPY.height / 2, 0]}
							color={palette.trim}
						/>

						<LightPool light={lights.canopyLights} />
					</group>
				))}

				{p.showsShop && (
					<group position={[0, 0, -CANOPY.depth / 2 - 0.8]}>
						<Box size={[width * 0.7, 0.9, 1.2]} position={[0, 0.45, 0]} color={colors.shop} />

						<Box
							size={[width * 0.7 + 0.06, 0.08, 1.26]}
							position={[0, 0.94, 0]}
							color={colors.brand}
						/>

						<Box
							size={[width * 0.45, 0.45, 0.04]}
							position={[0, 0.4, 0.62]}
							color={palette.glass}
							castShadow={false}
							{...lightEmission(lights.shopWindow, 1.3)}
						/>
					</group>
				)}
			</group>
		);
	},
});
