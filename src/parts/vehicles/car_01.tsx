import { z } from "zod";

import { Headlights } from "../lights";
import { RBox, Wheel } from "../primitives";
import { definePart } from "../types";

export const car01 = definePart({
	kind: "car_01",
	name: "Car",
	category: "vehicles",
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2.4,
			// Ahead of the lamps, lighting the road and what's on it.
			realLight: () => ({ at: [0.63 + 0.7, 0.32, 0] }),
		},
	],
	description: "Small car; can drive along a road",
	keywords: ["taxi", "vehicle", "automobile"],
	schema: z.object({}),
	fields: [],
	colors: [
		{ id: "body", name: "Body", default: "#f2c230", legacy: "color" },
		{ id: "windows", name: "Windows", default: "#2f3a56", legacy: "accent" },
	],
	canFollowPath: true,
	footprint: () => [1.25, 0.66],
	height: () => 0.8,
	Component: ({ colors, palette, lights }) => (
		<group>
			<RBox size={[1.25, 0.34, 0.66]} position={[0, 0.3, 0]} color={colors.body} radius={0.1} />

			<RBox
				size={[0.66, 0.28, 0.58]}
				position={[-0.06, 0.6, 0]}
				color={colors.windows}
				radius={0.08}
			/>

			{[0.38, -0.38].flatMap((x) =>
				[0.3, -0.3].map((z) => (
					<Wheel
						key={`${x}:${z}`}
						position={[x, 0.14, z]}
						radius={0.14}
						width={0.1}
						color={palette.tire}
					/>
				)),
			)}

			<Headlights light={lights.headlights} position={[0.63, 0.32, 0]} spread={0.42} />
		</group>
	),
});
