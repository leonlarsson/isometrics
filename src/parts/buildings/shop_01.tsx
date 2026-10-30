import { z } from "zod";

import { Box } from "../primitives";
import { definePart } from "../types";

import { Awning, FLOOR_HEIGHT, ShopFront, shopLights, UpperWindows } from "./shopKit";

const ShopSchema = z.object({
	width: z.number().min(1).max(8).default(1.8),
	depth: z.number().min(1).max(8).default(1.6),
	floorCount: z.number().int().min(1).max(5).default(2),
	showsAwning: z.boolean().default(true),
});

/** The low wall round the flat roof. */
const PARAPET = 0.08;

export const shop01 = definePart({
	kind: "shop_01",
	name: "Shop",
	category: "buildings",
	description: "Flat-roofed corner shop with a striped awning and flats above; its front faces +Z",
	keywords: ["store", "shop", "grocery", "boutique", "retail", "high street", "awning"],
	schema: ShopSchema,
	renamedProps: { showAwning: "showsAwning" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 1, max: 5, step: 1 },
		{ key: "showsAwning", label: "Show the awning", type: "boolean" },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#e8c9a0", legacy: "color" },
		{ id: "awning", name: "Awning", default: "#2f7a5d", legacy: "accent" },
		{ id: "sign", name: "Sign", default: "#2f3a56" },
		{ id: "door", name: "Door", default: "#5a3d2e" },
	],
	lights: shopLights<z.output<typeof ShopSchema>>((p) => [0, 0.4, p.depth / 2 + 0.5]),
	footprint: (p) => [p.width, p.depth + (p.showsAwning ? 0.4 : 0)],
	height: (p) => p.floorCount * FLOOR_HEIGHT + PARAPET,
	Component: ({ props: p, colors, palette, lights }) => {
		const height = p.floorCount * FLOOR_HEIGHT;
		const front = p.depth / 2;
		return (
			<group>
				<Box size={[p.width, height, p.depth]} position={[0, height / 2, 0]} color={colors.walls} />

				<Box
					size={[p.width + 0.06, PARAPET, p.depth + 0.06]}
					position={[0, height + PARAPET / 2, 0]}
					color={palette.trim}
				/>

				<ShopFront
					width={p.width}
					front={front}
					colors={colors}
					palette={palette}
					light={lights.shopWindow}
				/>

				{p.showsAwning && <Awning width={p.width * 0.66} front={front} color={colors.awning} />}

				<UpperWindows
					width={p.width}
					front={front}
					floors={p.floorCount}
					palette={palette}
					light={lights.upstairs}
				/>
			</group>
		);
	},
});
