import { z } from "zod";

import { Headlights } from "../lights";
import { Box, RBox, spread, Wheel } from "../primitives";
import { definePart } from "../types";

import { FlashingLightBar } from "./emergencyKit";

const FireEngineSchema = z.object({
	showsLadder: z.boolean().default(true),
});

const WIDTH = 0.92;
const CAB = { length: 0.72, height: 0.86, x: 0.84 };
const BODY = { length: 1.62, height: 0.84, x: -0.34 };
const CLEARANCE = 0.16;
/** Lockers down each side of the body: how many, and how tall. */
const LOCKERS = 3;

export const fireEngine01 = definePart({
	kind: "fire_engine_01",
	name: "Fire engine",
	category: "vehicles",
	// Its flashing lights take turns every frame.
	movesOnItsOwn: true,
	description:
		"Fire engine with a ladder on its roof, lockers down its sides and flashing blue lights; can drive along a road",
	keywords: ["fire truck", "fire brigade", "emergency", "rescue", "siren", "vehicle"],
	schema: FireEngineSchema,
	renamedProps: { showLadder: "showsLadder" },
	fields: [{ key: "showsLadder", label: "Show the ladder", type: "boolean" }],
	colors: [
		{ id: "body", name: "Body", default: "#c8202a", legacy: "color" },
		{ id: "stripe", name: "Stripe", default: "#f4f1ea", legacy: "accent" },
		{ id: "fittings", name: "Ladder and lockers", default: "#c9ccd0" },
	],
	lights: [
		{
			id: "headlights",
			name: "Headlights",
			shape: "beam",
			when: "driving",
			reach: 2.6,
			realLight: () => ({ at: [CAB.x + CAB.length / 2 + 0.7, 0.4, 0] }),
		},
		{
			id: "flashers",
			name: "Flashing lights",
			description: "The blue lights on the cab's roof, flashing in turn. Off to park it quietly.",
			shape: "lens",
			color: "#3d7bff",
			when: "always",
		},
	],
	canFollowPath: true,
	footprint: () => [CAB.length + BODY.length, WIDTH],
	height: () => CLEARANCE + BODY.height + 0.18,
	Component: ({ props: p, colors, palette, lights }) => {
		const front = CAB.x + CAB.length / 2;
		const rear = BODY.x - BODY.length / 2;
		const bodyTop = CLEARANCE + BODY.height;
		return (
			<group>
				<RBox
					size={[CAB.length, CAB.height, WIDTH]}
					position={[CAB.x, CLEARANCE + CAB.height / 2, 0]}
					color={colors.body}
					radius={0.08}
				/>

				{/* The windscreen, and the side windows of the crew cab. */}
				<Box
					size={[0.03, 0.32, WIDTH - 0.12]}
					position={[front, CLEARANCE + CAB.height * 0.68, 0]}
					color={palette.glass}
					castShadow={false}
				/>

				<Box
					size={[CAB.length - 0.22, 0.26, WIDTH + 0.01]}
					position={[CAB.x - 0.02, CLEARANCE + CAB.height * 0.68, 0]}
					color={palette.glass}
					castShadow={false}
				/>

				<RBox
					size={[BODY.length, BODY.height, WIDTH]}
					position={[BODY.x, CLEARANCE + BODY.height / 2, 0]}
					color={colors.body}
					radius={0.05}
				/>

				{/* Lockers down both sides, behind roller shutters. */}
				{spread(LOCKERS, BODY.length - 0.16).flatMap((along) => {
					const span = (BODY.length - 0.16) / LOCKERS;
					const x = BODY.x + along;
					return [1, -1].map((side) => (
						<Box
							key={`${x}:${side}`}
							size={[span - 0.05, BODY.height * 0.5, 0.02]}
							position={[x, CLEARANCE + BODY.height * 0.56, side * (WIDTH / 2 + 0.005)]}
							color={colors.fittings}
							castShadow={false}
						/>
					));
				})}

				{/* A stripe all round, low on the sides. */}
				<Box
					size={[front - rear + 0.01, 0.07, WIDTH + 0.02]}
					position={[(front + rear) / 2, CLEARANCE + 0.15, 0]}
					color={colors.stripe}
					castShadow={false}
				/>

				{/* The ladder on the roof: two rails and their rungs, on a turntable at the back. */}
				{p.showsLadder && (
					<group position={[BODY.x - 0.05, bodyTop + 0.1, 0]}>
						<Box
							size={[0.3, 0.08, 0.3]}
							position={[-BODY.length / 2 + 0.28, -0.05, 0]}
							color={colors.fittings}
						/>

						{[0.16, -0.16].map((z) => (
							<Box
								key={z}
								size={[2, 0.04, 0.035]}
								position={[0.3, 0.02, z]}
								color={colors.fittings}
							/>
						))}

						{spread(13, 13 * 0.16).map((x) => (
							<Box
								key={x}
								size={[0.025, 0.025, 0.3]}
								position={[0.3 + x, 0.02, 0]}
								color={colors.fittings}
								castShadow={false}
							/>
						))}
					</group>
				)}

				<FlashingLightBar
					light={lights.flashers}
					position={[CAB.x + 0.06, CLEARANCE + CAB.height, 0]}
					width={WIDTH * 0.72}
				/>

				{[CAB.x + 0.05, BODY.x - 0.25, BODY.x - 0.65].flatMap((x) =>
					[WIDTH / 2 - 0.05, -WIDTH / 2 + 0.05].map((z) => (
						<Wheel key={`${x}:${z}`} position={[x, 0.18, z]} radius={0.18} color={palette.tire} />
					)),
				)}

				<Headlights light={lights.headlights} position={[front, 0.38, 0]} spread={0.66} />
			</group>
		);
	},
});
