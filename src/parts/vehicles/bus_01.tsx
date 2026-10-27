import { z } from "zod";

import { Headlights, lightEmission, WindowGlowOnGround } from "../lights";
import { Box, RBox, Wheel } from "../primitives";
import { definePart } from "../types";

const BusSchema = z.object({
	length: z.number().min(2).max(6).default(3.3),
});

const BODY = { width: 0.78, height: 0.82, clearance: 0.14 };

export const bus01 = definePart({
	kind: "bus_01",
	name: "Bus",
	category: "vehicles",
	description:
		"City bus with a long window band and a lit destination sign; can drive along a road",
	keywords: ["coach", "public transport", "transit", "shuttle", "vehicle"],
	schema: BusSchema,
	fields: [{ key: "length", label: "Length", type: "number", min: 2, max: 6, step: 0.1 }],
	colors: [
		{ id: "body", name: "Body", default: "#e2603b", legacy: "color" },
		{ id: "roof", name: "Roof and stripe", default: "#f4f1ea", legacy: "accent" },
	],
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2.6,
			realLight: (p) => ({ at: [p.length / 2 + 0.7, 0.35, 0] }),
		},
		{
			id: "cabin",
			name: "Cabin lights",
			description: "The lights inside, through the windows and a little onto the street beside it.",
			shape: "glow",
			color: "#f4efdc",
			realLight: (p) => ({ at: [0, 0.7, 0], reach: p.length * 0.6 }),
		},
		{ id: "sign", name: "Destination sign", shape: "glow", color: "#ffb347" },
	],
	canFollowPath: true,
	footprint: (p) => [p.length, BODY.width],
	height: () => BODY.clearance + BODY.height + 0.05,
	Component: ({ props: p, colors, palette, lights }) => {
		const half = p.length / 2;
		const bodyY = BODY.clearance + BODY.height / 2;
		return (
			<group>
				<RBox
					size={[p.length, BODY.height, BODY.width]}
					position={[0, bodyY, 0]}
					color={colors.body}
					radius={0.08}
				/>

				<Box
					size={[p.length - 0.1, 0.05, BODY.width - 0.06]}
					position={[0, BODY.clearance + BODY.height + 0.01, 0]}
					color={colors.roof}
				/>

				{/* The window band down both sides, lit from inside after dark. */}
				<Box
					size={[p.length - 0.5, 0.32, BODY.width + 0.02]}
					position={[-0.1, BODY.clearance + BODY.height * 0.66, 0]}
					color={palette.glass}
					castShadow={false}
					{...lightEmission(lights.cabin, 1)}
				/>

				<Box
					size={[p.length + 0.01, 0.06, BODY.width + 0.02]}
					position={[0, BODY.clearance + BODY.height * 0.4, 0]}
					color={colors.roof}
					castShadow={false}
				/>

				{/* The windscreen and the destination sign over it. */}
				<Box
					size={[0.03, 0.4, BODY.width - 0.1]}
					position={[half, BODY.clearance + BODY.height * 0.6, 0]}
					color={palette.glass}
					castShadow={false}
				/>

				<Box
					size={[0.03, 0.09, BODY.width - 0.2]}
					position={[half + 0.005, BODY.clearance + BODY.height - 0.08, 0]}
					color={palette.tire}
					castShadow={false}
					{...lightEmission(lights.sign, 1.8)}
				/>

				{[half - 0.55, -half + 0.6].flatMap((x) =>
					[BODY.width / 2 - 0.04, -BODY.width / 2 + 0.04].map((z) => (
						<Wheel
							key={`${x}:${z}`}
							position={[x, 0.17, z]}
							radius={0.17}
							width={0.12}
							color={palette.tire}
						/>
					)),
				)}

				<WindowGlowOnGround light={lights.cabin} length={p.length} width={BODY.width} />

				<Headlights light={lights.headlights} position={[half, 0.3, 0]} spread={0.56} />
			</group>
		);
	},
});
