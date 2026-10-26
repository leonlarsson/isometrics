import { z } from "zod";

import { Headlights } from "../lights";
import { Box, RBox, Wheel } from "../primitives";
import { definePart } from "../types";

export const truck01 = definePart({
	kind: "truck_01",
	name: "Truck",
	category: "vehicles",
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2.4,
			// Ahead of the lamps, lighting the road and what's on it.
			realLight: () => ({ at: [1.33 + 0.7, 0.45, 0] }),
		},
	],
	description: "Box truck; can drive along a road",
	keywords: ["lorry", "delivery", "vehicle"],
	schema: z.object({}),
	fields: [],
	colors: [
		{ id: "box", name: "Cargo box", default: "#f7f7f4", legacy: "color" },
		{ id: "cab", name: "Cab", default: "#e2603b", legacy: "accent" },
	],
	canFollowPath: true,
	footprint: () => [2.7, 1.05],
	height: () => 1.4,
	Component: ({ colors, palette, lights }) => (
		<group>
			<RBox size={[0.8, 0.9, 0.98]} position={[0.92, 0.62, 0]} color={colors.cab} radius={0.1} />

			<Box
				size={[0.05, 0.32, 0.84]}
				position={[1.32, 0.8, 0]}
				color={palette.glass}
				castShadow={false}
			/>

			{/* The wheels' outer faces (z ±0.52) stand a little proud of the cargo box's sides
			(±0.5): flush faces would flicker through each other. */}
			<RBox size={[1.85, 1.15, 1]} position={[-0.4, 0.76, 0]} color={colors.box} radius={0.06} />

			{[0.95, -0.15, -0.9].flatMap((x) =>
				[0.46, -0.46].map((z) => (
					<Wheel key={`${x}:${z}`} position={[x, 0.18, z]} radius={0.18} color={palette.tire} />
				)),
			)}

			<Headlights light={lights.headlights} position={[1.33, 0.45, 0]} spread={0.7} />
		</group>
	),
});
