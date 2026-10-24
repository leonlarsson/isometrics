import { z } from "zod";

import { Headlights } from "../lights";
import { Box, RBox, Wheel } from "../primitives";
import { definePart } from "../types";

export const deliveryVan01 = definePart({
	kind: "delivery_van_01",
	name: "Delivery van",
	category: "vehicles",
	lights: [{ id: "headlights", name: "Headlights", shape: "beam", when: "driving", reach: 2.4 }],
	description: "Small van; can drive along a road",
	keywords: ["delivery", "vehicle"],
	schema: z.object({}),
	fields: [],
	defaultColor: "#f7f7f4",
	defaultAccent: "#3d4fd6",
	colorLabel: "Body",
	accentLabel: "Stripe & roof",
	canFollowPath: true,
	footprint: () => [1.7, 0.85],
	height: () => 1.05,
	Component: ({ color, accent, palette, lights }) => {
		const L = 1.7;
		const W = 0.85;
		const H = 0.8;
		return (
			<group>
				<RBox size={[L, H, W]} position={[0, H / 2 + 0.15, 0]} color={color} radius={0.12} />

				<Box
					size={[0.05, H * 0.36, W * 0.84]}
					position={[L / 2, H * 0.74 + 0.15, 0]}
					color={palette.glass}
					castShadow={false}
				/>

				<Box
					size={[L * 0.72, 0.11, W + 0.02]}
					position={[-0.12, 0.42, 0]}
					color={accent}
					castShadow={false}
				/>

				<Box size={[L * 0.6, 0.05, W * 0.86]} position={[-0.2, H + 0.17, 0]} color={accent} />

				{[L * 0.3, -L * 0.3].flatMap((x) =>
					[W / 2 - 0.04, -W / 2 + 0.04].map((z) => (
						<Wheel key={`${x}:${z}`} position={[x, 0.17, z]} color={palette.tire} />
					)),
				)}

				<Headlights light={lights.headlights} position={[0.86, 0.35, 0]} spread={0.58} />
			</group>
		);
	},
});
