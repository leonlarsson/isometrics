import { z } from "zod";

import { Box, Mat, RBox, Wheel } from "../primitives";
import { definePart } from "../types";

/** Modelled at 2 units long; shown about 1.2× a road car's length, like a real F1 car. */
const CAR_SCALE = 0.75;

export const raceCar01 = definePart({
	kind: "race_car_01",
	name: "Race car",
	category: "vehicles",
	description: "Open-wheel race car; can drive along a road",
	keywords: ["f1", "formula", "racing", "vehicle"],
	schema: z.object({}),
	fields: [],
	defaultColor: "#d5232f",
	defaultAccent: "#1f1f24",
	colorLabel: "Livery",
	accentLabel: "Wings & details",
	canFollowPath: true,
	footprint: () => [2 * CAR_SCALE, 0.95 * CAR_SCALE],
	height: () => 0.65 * CAR_SCALE,
	Component: ({ color, accent, palette }) => (
		<group scale={CAR_SCALE}>
			{/* Floor, body and nose */}
			<Box size={[1.7, 0.06, 0.62]} position={[-0.05, 0.11, 0]} color={accent} />

			<RBox size={[1.2, 0.2, 0.34]} position={[0, 0.24, 0]} color={color} radius={0.08} />

			<Box size={[0.55, 0.11, 0.18]} position={[0.82, 0.19, 0]} color={color} />

			<Box size={[0.58, 0.17, 0.16]} position={[-0.12, 0.22, 0.27]} color={color} />

			<Box size={[0.58, 0.17, 0.16]} position={[-0.12, 0.22, -0.27]} color={color} />

			{/* Cockpit, helmet and engine cover */}
			<Box size={[0.32, 0.08, 0.22]} position={[0.12, 0.38, 0]} color={palette.tire} />

			<mesh position={[0.06, 0.44, 0]} castShadow>
				<sphereGeometry args={[0.08, 12, 12]} />

				<Mat color={accent} />
			</mesh>

			<Box size={[0.48, 0.2, 0.15]} position={[-0.36, 0.4, 0]} color={color} />

			{/* Wings */}
			<Box size={[0.16, 0.035, 0.84]} position={[1.04, 0.07, 0]} color={accent} />

			<Box size={[0.16, 0.035, 0.66]} position={[-0.84, 0.58, 0]} color={accent} />

			<Box size={[0.22, 0.22, 0.03]} position={[-0.84, 0.48, 0.33]} color={accent} />

			<Box size={[0.22, 0.22, 0.03]} position={[-0.84, 0.48, -0.33]} color={accent} />

			{[0.62, -0.62].flatMap((x) =>
				[0.42, -0.42].map((z) => (
					<Wheel
						key={`${x}:${z}`}
						position={[x, 0.16, z]}
						radius={0.16}
						width={0.16}
						color={palette.tire}
					/>
				)),
			)}
		</group>
	),
});
