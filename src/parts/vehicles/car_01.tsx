import { z } from "zod";

import { Headlights } from "../nightLights";
import { RBox, Wheel } from "../primitives";
import { definePart } from "../types";

export const car01 = definePart({
	kind: "car_01",
	name: "Car",
	category: "vehicles",
	description: "Small car; can drive along a road",
	keywords: ["taxi", "vehicle", "automobile"],
	schema: z.object({}),
	fields: [],
	defaultColor: "#f2c230",
	defaultAccent: "#2f3a56",
	colorLabel: "Body",
	accentLabel: "Windows",
	canFollowPath: true,
	footprint: () => [1.25, 0.66],
	height: () => 0.8,
	Component: ({ color, accent, palette, driving }) => (
		<group>
			<RBox size={[1.25, 0.34, 0.66]} position={[0, 0.3, 0]} color={color} radius={0.1} />

			<RBox size={[0.66, 0.28, 0.58]} position={[-0.06, 0.6, 0]} color={accent} radius={0.08} />

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

			<Headlights palette={palette} driving={driving} position={[0.63, 0.32, 0]} spread={0.42} />
		</group>
	),
});
