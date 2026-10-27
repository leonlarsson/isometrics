import { z } from "zod";

import { Headlights, lightEmission, WindowGlowOnGround } from "../lights";
import { Box, RBox, Wheel } from "../primitives";
import { definePart } from "../types";

const TramSchema = z.object({
	length: z.number().min(2.5).max(9).default(4.4),
});

const BODY = { width: 0.72, height: 0.9, floor: 0.18 };
/** Its bogies underneath: how far in from each end, and their wheels. */
const BOGIE = { inset: 0.75, length: 0.6, wheel: 0.08, track: 0.26 };
/** The pantograph on the roof: its arms' length and how far they lean. */
const PANTOGRAPH = { arm: 0.34, lean: 0.75 };

export const tram01 = definePart({
	kind: "tram_01",
	name: "Tram",
	category: "vehicles",
	description:
		"Low-floor city tram in two colours with a pantograph on its roof; can run along a road or route",
	keywords: ["streetcar", "light rail", "trolley", "public transport", "vehicle"],
	schema: TramSchema,
	fields: [{ key: "length", label: "Length", type: "number", min: 2.5, max: 9, step: 0.1 }],
	colors: [
		{ id: "body", name: "Body", default: "#3d4fd6", legacy: "color" },
		{ id: "skirt", name: "Lower band", default: "#f4f1ea", legacy: "accent" },
	],
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2.4,
			realLight: (p) => ({ at: [p.length / 2 + 0.7, 0.3, 0] }),
		},
		{
			id: "cabin",
			name: "Cabin lights",
			description: "The lights inside, through the windows and a little onto the street beside it.",
			shape: "glow",
			color: "#f4efdc",
			realLight: (p) => ({ at: [0, 0.75, 0], reach: p.length * 0.6 }),
		},
	],
	canFollowPath: true,
	footprint: (p) => [p.length, BODY.width],
	height: () => BODY.floor + BODY.height + 0.35,
	Component: ({ props: p, colors, palette, lights }) => {
		const half = p.length / 2;
		const top = BODY.floor + BODY.height;
		return (
			<group>
				<RBox
					size={[p.length, BODY.height, BODY.width]}
					position={[0, BODY.floor + BODY.height / 2, 0]}
					color={colors.body}
					radius={0.14}
				/>

				<Box
					size={[p.length - 0.1, 0.2, BODY.width + 0.01]}
					position={[0, BODY.floor + 0.12, 0]}
					color={colors.skirt}
					castShadow={false}
				/>

				{/* Big windows from end to end, lit from inside after dark. */}
				<Box
					size={[p.length - 0.25, 0.42, BODY.width + 0.02]}
					position={[0, BODY.floor + BODY.height * 0.58, 0]}
					color={palette.glass}
					castShadow={false}
					{...lightEmission(lights.cabin, 1)}
				/>

				{/* The pantograph: a base on the roof and two arms leaning up to its collector bar. */}
				<group position={[0, top, 0]}>
					<Box size={[0.4, 0.06, 0.3]} position={[0, 0.03, 0]} color={palette.trim} />

					{[1, -1].map((side) => (
						<Box
							key={side}
							size={[PANTOGRAPH.arm, 0.025, 0.025]}
							position={[
								(side * PANTOGRAPH.arm * Math.cos(PANTOGRAPH.lean)) / 2,
								0.06 + (PANTOGRAPH.arm * Math.sin(PANTOGRAPH.lean)) / 2,
								0,
							]}
							// Leaning in, so the two arms meet under the collector bar.
							rotation={[0, 0, -side * PANTOGRAPH.lean]}
							color={palette.tire}
						/>
					))}

					<Box
						size={[0.04, 0.025, 0.4]}
						position={[0, 0.06 + PANTOGRAPH.arm * Math.sin(PANTOGRAPH.lean), 0]}
						color={palette.tire}
					/>
				</group>

				{/* A windscreen at each end: a tram drives either way. */}
				{[1, -1].map((end) => (
					<Box
						key={end}
						size={[0.03, 0.46, BODY.width - 0.14]}
						position={[end * (half - 0.005), BODY.floor + BODY.height * 0.62, 0]}
						color={palette.glass}
						castShadow={false}
					/>
				))}

				{/* A bogie near each end: a frame with its wheels on the rails. */}
				{[half - BOGIE.inset, -half + BOGIE.inset].map((x) => (
					<group key={x} position={[x, 0, 0]}>
						{/* From just over the rails up to the body's floor, which rests on it. */}
						<Box
							size={[BOGIE.length, BODY.floor - 0.03, BOGIE.track * 2 - 0.04]}
							position={[0, 0.03 + (BODY.floor - 0.03) / 2, 0]}
							color={palette.tire}
						/>

						{[BOGIE.length / 2 - 0.1, -BOGIE.length / 2 + 0.1].flatMap((wx) =>
							[BOGIE.track, -BOGIE.track].map((z) => (
								<Wheel
									key={`${wx}:${z}`}
									position={[wx, BOGIE.wheel, z]}
									radius={BOGIE.wheel}
									width={0.05}
									color={palette.trim}
								/>
							)),
						)}
					</group>
				))}

				<WindowGlowOnGround light={lights.cabin} length={p.length} width={BODY.width} />

				<Headlights light={lights.headlights} position={[half, 0.36, 0]} spread={0.5} />
			</group>
		);
	},
});
