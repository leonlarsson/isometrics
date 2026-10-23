import { z } from "zod";

import { Box, RBox, Wheel } from "../primitives";
import { definePart } from "../types";

export const truck = definePart({
	kind: "truck",
	name: "Truck",
	category: "vehicles",
	description: "Box truck; can drive along a route",
	keywords: ["lorry", "delivery", "vehicle"],
	schema: z.object({}),
	fields: [],
	defaultColor: "#f7f7f4",
	defaultAccent: "#e2603b",
	colorLabel: "Cargo box",
	accentLabel: "Cab",
	canFollowPath: true,
	footprint: () => [2.7, 1.05],
	height: () => 1.4,
	Component: ({ color, accent, palette }) => (
		<group>
			<RBox size={[0.8, 0.9, 0.98]} position={[0.92, 0.62, 0]} color={accent} radius={0.1} />

			<Box
				size={[0.05, 0.32, 0.84]}
				position={[1.32, 0.8, 0]}
				color={palette.glass}
				castShadow={false}
			/>

			<RBox size={[1.85, 1.15, 1.04]} position={[-0.4, 0.76, 0]} color={color} radius={0.06} />

			{[0.95, -0.15, -0.9].flatMap(
				(x) =>
					[0.46, -0.46].map((z) => (
						<Wheel key={`${x}:${z}`} position={[x, 0.18, z]} radius={0.18} color={palette.tire} />
					)),
				// No clipping, but looks odd...
				// [0.452, -0.452].map((z) => (
				// 	<Wheel key={`${x}:${z}`} position={[x, 0.18, z]} radius={0.18} color={palette.tire} />
				// )),
			)}
		</group>
	),
});
