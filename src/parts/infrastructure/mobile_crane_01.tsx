import { z } from "zod";

import { Headlights, LightLens } from "../lights";
import { Box, Mat, RBox, Strut, Wheel } from "../primitives";
import { definePart } from "../types";

const MobileCraneSchema = z.object({
	boomAngle: z.number().min(0).max(80).default(50),
	boomLength: z.number().min(2).max(9).default(4),
	showsOutriggers: z.boolean().default(true),
});

/** The carrier: how long and wide, how high its deck stands. */
const CARRIER = { length: 2.6, width: 0.82, deck: 0.42 };
/** The cab at the front, and the crane's turntable behind it. */
const CAB = { length: 0.55, height: 0.5, x: 1.0 };
const TURNTABLE = { x: -0.35, height: 0.32 };
/** Where the boom is pinned on the superstructure, and how thick it is where it starts. */
const PIVOT = { x: -0.65, y: 0.62 };
const BOOM = 0.2;

export const mobileCrane01 = definePart({
	kind: "mobile_crane_01",
	name: "Mobile crane",
	category: "infrastructure",
	description:
		"Truck crane with a telescopic boom over its back and outriggers to stand on; can drive along a road (it drives towards +X)",
	keywords: ["crane", "truck crane", "lift", "construction", "site", "boom", "vehicle"],
	schema: MobileCraneSchema,
	renamedLights: { warningLamp: "warningLight" },
	renamedProps: { showOutriggers: "showsOutriggers" },
	fields: [
		{ key: "boomAngle", label: "Boom angle (°)", type: "number", min: 0, max: 80, step: 1 },
		{ key: "boomLength", label: "Boom length", type: "number", min: 2, max: 9, step: 0.1 },
		{ key: "showsOutriggers", label: "Outriggers down", type: "boolean" },
	],
	colors: [
		{ id: "body", name: "Carrier and cab", default: "#e8b83a", legacy: "color" },
		{ id: "boom", name: "Boom", default: "#e8b83a", legacy: "accent" },
		{ id: "chassis", name: "Chassis", default: "#3d3f42" },
	],
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2.4,
			realLight: () => ({ at: [CARRIER.length / 2 + 0.7, 0.36, 0] }),
		},
		{
			id: "warningLight",
			name: "Warning light",
			description: "An amber lamp on the cab's roof.",
			shape: "lens",
			color: "#ffae1a",
			when: "always",
		},
	],
	canFollowPath: true,
	footprint: () => [CARRIER.length, CARRIER.width + 0.5],
	height: (p) =>
		PIVOT.y + CARRIER.deck + Math.sin((p.boomAngle * Math.PI) / 180) * p.boomLength + BOOM,
	Component: ({ props: p, colors, palette, lights }) => {
		const angle = (p.boomAngle * Math.PI) / 180;
		const half = CARRIER.length / 2;
		// The boom points forward over the cab, from its pivot at the back of the superstructure.
		const tip: [number, number, number] = [
			TURNTABLE.x + PIVOT.x + Math.cos(angle) * p.boomLength,
			CARRIER.deck + PIVOT.y + Math.sin(angle) * p.boomLength,
			0,
		];
		const hookY = Math.max(0.6, tip[1] - 1.4);
		return (
			<group>
				{/* The chassis and its deck. */}
				<Box
					size={[CARRIER.length, 0.18, CARRIER.width * 0.8]}
					position={[0, CARRIER.deck - 0.08, 0]}
					color={colors.chassis}
				/>

				<Box
					size={[CARRIER.length - 0.1, 0.08, CARRIER.width]}
					position={[-0.05, CARRIER.deck + 0.04, 0]}
					color={colors.body}
				/>

				<RBox
					size={[CAB.length, CAB.height, CARRIER.width * 0.48]}
					position={[CAB.x, CARRIER.deck + CAB.height / 2, CARRIER.width * 0.25]}
					color={colors.body}
					radius={0.06}
				/>

				<Box
					size={[0.03, 0.22, CARRIER.width * 0.4]}
					position={[
						CAB.x + CAB.length / 2,
						CARRIER.deck + CAB.height * 0.66,
						CARRIER.width * 0.25,
					]}
					color={palette.glass}
					castShadow={false}
				/>

				<LightLens
					light={lights.warningLight}
					size={[0.06, 0.05, 0.06]}
					position={[CAB.x, CARRIER.deck + CAB.height + 0.03, CARRIER.width * 0.25]}
				/>

				{/* The superstructure on its turntable: an operator's cab beside the boom, and a counterweight. */}
				<group position={[TURNTABLE.x, CARRIER.deck + 0.08, 0]}>
					<mesh position={[0, 0.06, 0]} castShadow>
						<cylinderGeometry args={[0.36, 0.36, 0.12, 16]} />

						<Mat color={colors.chassis} />
					</mesh>

					<Box
						size={[0.9, TURNTABLE.height, 0.5]}
						position={[-0.2, 0.12 + TURNTABLE.height / 2, -0.08]}
						color={colors.body}
					/>

					<Box size={[0.32, 0.3, 0.22]} position={[0.1, 0.27, 0.27]} color={colors.body} />

					<Box
						size={[0.03, 0.14, 0.18]}
						position={[0.26, 0.32, 0.27]}
						color={palette.glass}
						castShadow={false}
					/>

					<Box size={[0.3, 0.26, 0.56]} position={[-0.72, 0.25, -0.08]} color={colors.chassis} />
				</group>

				{/* The telescopic boom: a wide section, and a slimmer one out of it to the tip. */}
				<Strut
					from={[TURNTABLE.x + PIVOT.x, CARRIER.deck + PIVOT.y, -0.08]}
					to={[
						TURNTABLE.x + PIVOT.x + Math.cos(angle) * p.boomLength * 0.55,
						CARRIER.deck + PIVOT.y + Math.sin(angle) * p.boomLength * 0.55,
						-0.08,
					]}
					color={colors.boom}
					thickness={BOOM}
				/>

				<Strut
					from={[TURNTABLE.x + PIVOT.x, CARRIER.deck + PIVOT.y, -0.08]}
					to={[tip[0], tip[1], -0.08]}
					color={colors.boom}
					thickness={BOOM * 0.65}
				/>

				{/* The hook on its cable, under the tip. */}
				<Strut
					from={[tip[0], tip[1], -0.08]}
					to={[tip[0], hookY, -0.08]}
					color={colors.chassis}
					thickness={0.015}
					castShadow={false}
				/>

				<Box
					size={[0.1, 0.12, 0.08]}
					position={[tip[0], hookY - 0.06, -0.08]}
					color={colors.chassis}
				/>

				{/* Outriggers out to both sides, front and back, each on a pad. */}
				{p.showsOutriggers &&
					[half - 0.35, -half + 0.3].flatMap((x) =>
						[1, -1].map((side) => (
							<group key={`${x}:${side}`}>
								<Box
									size={[0.1, 0.08, 0.42]}
									position={[x, CARRIER.deck - 0.08, side * (CARRIER.width / 2 + 0.1)]}
									color={colors.body}
								/>

								<Strut
									from={[x, CARRIER.deck - 0.08, side * (CARRIER.width / 2 + 0.28)]}
									to={[x, 0.04, side * (CARRIER.width / 2 + 0.28)]}
									color={colors.chassis}
									thickness={0.05}
								/>

								<Box
									size={[0.16, 0.03, 0.16]}
									position={[x, 0.015, side * (CARRIER.width / 2 + 0.28)]}
									color={colors.chassis}
								/>
							</group>
						)),
					)}

				{[0.85, 0.35, -0.5, -0.95].flatMap((x) =>
					[CARRIER.width / 2 - 0.06, -CARRIER.width / 2 + 0.06].map((z) => (
						<Wheel key={`${x}:${z}`} position={[x, 0.18, z]} radius={0.18} color={palette.tire} />
					)),
				)}

				<Headlights light={lights.headlights} position={[half, 0.36, 0]} spread={0.62} />
			</group>
		);
	},
});
