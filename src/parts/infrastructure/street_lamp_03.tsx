import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const DoubleLampSchema = z.object({
	height: z.number().min(1).max(6).default(2.2),
	armLength: z.number().min(0.2).max(1.5).default(0.5),
	headTilt: z.number().min(0).max(40).default(0),
});

/** A cool white street light, unless it's set. */
const STREET_LIGHT = "#f4efe0";

/** How far out past its head each light lands: under it, or further to its side as it tilts up. */
const poolOffset = (p: { height: number; headTilt: number }) =>
	p.height * Math.tan((p.headTilt * Math.PI) / 180);

export const streetLamp03 = definePart({
	kind: "street_lamp_03",
	name: "Street lamp",
	category: "infrastructure",
	description:
		"Tall street light with two arms, lighting both sides; its arms point along X and its heads can tilt",
	keywords: ["light", "street light", "road", "double", "highway", "boulevard"],
	schema: DoubleLampSchema,
	fields: [
		{ key: "height", label: "Height", type: "number", min: 1, max: 6, step: 0.1 },
		{ key: "armLength", label: "Arm length", type: "number", min: 0.2, max: 1.5, step: 0.05 },
		{ key: "headTilt", label: "Head tilt (°)", type: "number", min: 0, max: 40, step: 1 },
	],
	colors: [{ id: "post", name: "Post and arms", default: "#8f9294", legacy: "color" }],
	lights: [
		{
			id: "lamp",
			name: "Lamps",
			shape: "pool",
			color: STREET_LIGHT,
			// Two heads side by side: each dimmer and smaller than a single lamp's, so where their light
			// overlaps it isn't twice as bright.
			strength: 0.6,
			reach: 1.6,
			// One under each lamp.
			realLight: (p) => [
				{ at: [p.armLength, p.height - 0.05, 0] },
				{ at: [-p.armLength, p.height - 0.05, 0] },
			],
		},
	],
	footprint: (p) => [p.armLength * 2 + 0.3, 0.4],
	height: (p) => p.height + 0.1,
	Component: ({ props: p, colors, lights }) => {
		const tilt = (p.headTilt * Math.PI) / 180;
		return (
			<group>
				<mesh position={[0, p.height / 2, 0]} castShadow>
					<cylinderGeometry args={[0.04, 0.06, p.height, 8]} />

					<Mat color={colors.post} />
				</mesh>

				<Box
					size={[p.armLength * 2, 0.04, 0.05]}
					position={[0, p.height + 0.02, 0]}
					color={colors.post}
				/>

				{[1, -1].map((side) => (
					<group key={side}>
						{/* Each head, tilted up towards its side: a housing that glows softly when it's on
						(seen from above), its lamp underneath. */}
						<group
							position={[side * p.armLength, p.height + 0.02, 0]}
							rotation={[0, 0, side * tilt]}
						>
							<Box
								size={[0.3, 0.06, 0.14]}
								color={colors.post}
								{...lightEmission(lights.lamp, 0.45)}
							/>

							<Box
								size={[0.24, 0.02, 0.1]}
								position={[0, -0.04, 0]}
								color={lights.lamp.color}
								castShadow={false}
								{...lightEmission(lights.lamp, 2.5)}
							/>
						</group>

						<LightPool light={lights.lamp} at={[side * (p.armLength + poolOffset(p)), 0]} />
					</group>
				))}
			</group>
		);
	},
});
