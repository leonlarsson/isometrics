import { z } from "zod";

import { Headlights } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const TractorSchema = z.object({});

/** The big rear wheels and the small front ones: where they are and how big. */
const REAR = { x: -0.28, radius: 0.3, width: 0.18 };
const FRONT = { x: 0.42, radius: 0.18, width: 0.12 };
const TRACK = 0.36;

/** A wheel and its rim, its axle along Z. */
const TractorWheel = ({
	x,
	z,
	radius,
	width,
	tire,
	rim,
}: {
	x: number;
	z: number;
	radius: number;
	width: number;
	tire: string;
	rim: string;
}) => (
	<group position={[x, radius, z]} rotation={[Math.PI / 2, 0, 0]}>
		<mesh castShadow>
			<cylinderGeometry args={[radius, radius, width, 14]} />

			<Mat color={tire} roughness={0.95} />
		</mesh>

		<mesh>
			<cylinderGeometry args={[radius * 0.55, radius * 0.55, width + 0.01, 10]} />

			<Mat color={rim} />
		</mesh>
	</group>
);

export const tractor01 = definePart({
	kind: "tractor_01",
	name: "Tractor",
	category: "vehicles",
	description: "Farm tractor with big rear wheels and a glass cab; can drive along a road or track",
	keywords: ["farm", "agriculture", "field", "countryside", "vehicle"],
	schema: TractorSchema,
	fields: [],
	colors: [
		{ id: "body", name: "Body", default: "#3f8f3a", legacy: "color" },
		{ id: "rims", name: "Wheel rims", default: "#f2c230", legacy: "accent" },
	],
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2,
			realLight: () => ({ at: [1.2, 0.35, 0] }),
		},
	],
	canFollowPath: true,
	footprint: () => [1.25, TRACK * 2 + REAR.width],
	height: () => 1.05,
	Component: ({ colors, palette, lights }) => (
		<group>
			{/* The bonnet in front, and the body under the cab. */}
			<Box size={[0.62, 0.32, 0.36]} position={[0.3, 0.42, 0]} color={colors.body} />

			<Box size={[0.42, 0.3, 0.5]} position={[-0.26, 0.47, 0]} color={colors.body} />

			{/* The cab: glass all round under a roof. */}
			<Box
				size={[0.38, 0.4, 0.46]}
				position={[-0.26, 0.82, 0]}
				color={palette.glass}
				castShadow={false}
			/>

			<Box size={[0.46, 0.05, 0.54]} position={[-0.26, 1.04, 0]} color={colors.body} />

			{/* The exhaust, up beside the bonnet. */}
			<mesh position={[0.48, 0.75, 0.12]} castShadow>
				<cylinderGeometry args={[0.025, 0.025, 0.4, 6]} />

				<Mat color={palette.tire} />
			</mesh>

			{[TRACK, -TRACK].flatMap((z) => [
				<TractorWheel
					key={`rear${z}`}
					x={REAR.x}
					z={z}
					radius={REAR.radius}
					width={REAR.width}
					tire={palette.tire}
					rim={colors.rims}
				/>,
				<TractorWheel
					key={`front${z}`}
					x={FRONT.x}
					z={z * 0.85}
					radius={FRONT.radius}
					width={FRONT.width}
					tire={palette.tire}
					rim={colors.rims}
				/>,
			])}

			<Headlights light={lights.headlights} position={[0.62, 0.42, 0]} spread={0.26} />
		</group>
	),
});
