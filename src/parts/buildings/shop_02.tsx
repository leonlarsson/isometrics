import { z } from "zod";

import { Box, GableRoof } from "../primitives";
import { definePart } from "../types";

import { Awning, FLOOR_HEIGHT, ShopFront, shopLights, UpperWindows } from "./shopKit";

const TownShopSchema = z.object({
	width: z.number().min(0.8).max(4).default(1.2),
	depth: z.number().min(1).max(6).default(1.8),
	floorCount: z.number().int().min(1).max(5).default(3),
	showAwning: z.boolean().default(true),
});

export const shop02 = definePart({
	kind: "shop_02",
	name: "Shop",
	category: "buildings",
	description:
		"Narrow old-town shop with its gable to the street and rooms above; its front faces +Z",
	keywords: ["store", "shop", "bakery", "boutique", "old town", "townhouse", "awning"],
	schema: TownShopSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 0.8, max: 4, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 6, step: 0.1 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 1, max: 5, step: 1 },
		{ key: "showAwning", label: "Show the awning", type: "boolean" },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#d98f6a", legacy: "color" },
		{ id: "awning", name: "Awning", default: "#c8553d", legacy: "accent" },
		{ id: "roof", name: "Roof", default: "#7a4a3a" },
		{ id: "sign", name: "Sign", default: "#2f3a56" },
		{ id: "door", name: "Door", default: "#3d4f6b" },
	],
	lights: shopLights<z.output<typeof TownShopSchema>>((p) => [0, 0.4, p.depth / 2 + 0.5]),
	footprint: (p) => [p.width + 0.1, p.depth + 0.1 + (p.showAwning ? 0.4 : 0)],
	height: (p) => p.floorCount * FLOOR_HEIGHT + p.width * 0.55,
	Component: ({ props: p, colors, palette, lights }) => {
		const height = p.floorCount * FLOOR_HEIGHT;
		const front = p.depth / 2;
		return (
			<group>
				<Box size={[p.width, height, p.depth]} position={[0, height / 2, 0]} color={colors.walls} />

				{/* Its ridge runs back from the street, so the gable faces the front. */}
				<group position={[0, height, 0]} rotation={[0, Math.PI / 2, 0]}>
					<GableRoof
						width={p.depth + 0.1}
						depth={p.width + 0.1}
						height={p.width * 0.55}
						color={colors.roof}
					/>
				</group>

				<ShopFront
					width={p.width}
					front={front}
					colors={colors}
					palette={palette}
					light={lights.shopWindow}
				/>

				{p.showAwning && <Awning width={p.width * 0.9} front={front} color={colors.awning} />}

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
