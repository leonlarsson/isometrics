import { z } from "zod";

import { Headlights, lightEmission } from "../lights";
import { Box, RBox, spread, Wheel } from "../primitives";
import { definePart } from "../types";

import { FlashingLightBar } from "./emergencyKit";

const WIDTH = 0.86;
const CLEARANCE = 0.15;
/** The cab at the front, low, and the tall box behind it. */
const CAB = { length: 0.5, height: 0.62, x: 0.66 };
const BOX = { length: 1.32, height: 0.92, x: -0.25 };
/** The band of checks down the sides: how many, and how tall. */
const CHECKS = 10;
const CHECK_HEIGHT = 0.14;

export const ambulance01 = definePart({
	kind: "ambulance_01",
	name: "Ambulance",
	category: "vehicles",
	// Its flashing lights take turns every frame.
	movesOnItsOwn: true,
	description:
		"Ambulance with a tall box behind the cab, a band of checks down its sides and flashing blue lights; can drive along a road",
	keywords: ["emergency", "paramedic", "hospital", "rescue", "siren", "vehicle"],
	schema: z.object({}),
	fields: [],
	colors: [
		{ id: "body", name: "Body", default: "#f7f7f4", legacy: "color" },
		{ id: "checks", name: "Checks", default: "#2f9e44", legacy: "accent" },
		{ id: "checksBetween", name: "Checks between", default: "#f2d11c" },
	],
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2.4,
			realLight: () => ({ at: [CAB.x + CAB.length / 2 + 0.7, 0.36, 0] }),
		},
		{
			id: "flashers",
			name: "Flashing lights",
			description: "The blue lights over the cab, flashing in turn. Off to park it quietly.",
			shape: "lens",
			color: "#3d7bff",
			when: "always",
		},
		{
			id: "cabin",
			name: "Cabin lights",
			description: "The lights in the back, through its windows.",
			shape: "glow",
			color: "#eef3ff",
		},
	],
	canFollowPath: true,
	footprint: () => [CAB.length + BOX.length, WIDTH],
	height: () => CLEARANCE + BOX.height + 0.12,
	Component: ({ colors, palette, lights }) => {
		const front = CAB.x + CAB.length / 2;
		const span = BOX.length + CAB.length;
		const rear = front - span;
		const checkY = CLEARANCE + 0.3;
		return (
			<group>
				<RBox
					size={[CAB.length, CAB.height, WIDTH]}
					position={[CAB.x, CLEARANCE + CAB.height / 2, 0]}
					color={colors.body}
					radius={0.1}
				/>

				<Box
					size={[0.03, 0.24, WIDTH - 0.12]}
					position={[front - 0.02, CLEARANCE + CAB.height * 0.72, 0]}
					color={palette.glass}
					castShadow={false}
				/>

				<RBox
					size={[BOX.length, BOX.height, WIDTH]}
					position={[BOX.x, CLEARANCE + BOX.height / 2, 0]}
					color={colors.body}
					radius={0.06}
				/>

				{/* A window each side of the box, lit from inside after dark. */}
				<Box
					size={[0.3, 0.2, WIDTH + 0.01]}
					position={[BOX.x + 0.25, CLEARANCE + BOX.height * 0.72, 0]}
					color={palette.glass}
					castShadow={false}
					{...lightEmission(lights.cabin, 1.2)}
				/>

				{/* The band of checks, from the cab's nose to the back doors. */}
				{spread(CHECKS, span).map((x, i) => (
					<Box
						key={x}
						size={[span / CHECKS, CHECK_HEIGHT, WIDTH + 0.02]}
						position={[rear + span / 2 + x, checkY, 0]}
						color={i % 2 === 0 ? colors.checks : colors.checksBetween}
						castShadow={false}
					/>
				))}

				<FlashingLightBar
					light={lights.flashers}
					position={[BOX.x + BOX.length / 2 - 0.08, CLEARANCE + BOX.height, 0]}
					width={WIDTH * 0.8}
				/>

				{[CAB.x - 0.02, BOX.x - BOX.length * 0.28].flatMap((x) =>
					[WIDTH / 2 - 0.05, -WIDTH / 2 + 0.05].map((z) => (
						<Wheel key={`${x}:${z}`} position={[x, 0.16, z]} radius={0.16} color={palette.tire} />
					)),
				)}

				<Headlights light={lights.headlights} position={[front, 0.34, 0]} spread={0.6} />
			</group>
		);
	},
});
