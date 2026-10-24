import { z } from "zod";

import { HexColorSchema } from "#/scene/schema";

import { Box, Taper } from "../primitives";
import { definePart } from "../types";

import { Helmet, RaceWheel, RainLight, Strut, Wing } from "./raceCarKit";

/** Modelled at 2 units long; shown about 1.2× a road car's length, like a real F1 car. */
const CAR_SCALE = 0.75;

/** The rain light's colour unless one is set. */
const RAIN_RED = "#ff2a2a";

/**
 * Heights and widths relative to the length. The body below is modelled on a
 * wheel 0.33 across; a real car is about 7.8 wheels long, so at 2 units long
 * everything across and up is scaled by this (the wheels are drawn at that
 * size separately, so they stay round).
 */
const CROSS_SECTION = 0.82;

/** Where the wheels are, in the body's modelling units: axles along X, wheel centres either side. */
const FRONT_AXLE = 0.6;
const REAR_AXLE = -0.62;
const TRACK = 0.39;
const WHEELS = [
	{ x: FRONT_AXLE, radius: 0.165, width: 0.15 },
	{ x: REAR_AXLE, radius: 0.175, width: 0.17 },
];

/**
 * A modern F1 car (the ground-effect cars of 2022 on): a long nose dropping
 * to a multi-element front wing, sculpted sidepods narrowing towards the back,
 * the halo over the cockpit, an airbox above the driver's head, a rear wing
 * with its flap and endplates, and covered wheels. Other eras are other
 * variants (race_car_02…), built from the same kit (raceCarKit).
 */
export const raceCar01 = definePart({
	kind: "race_car_01",
	name: "Race car",
	category: "vehicles",
	description: "Modern open-wheel race car (2022 on, with the halo); can drive along a road",
	keywords: ["f1", "formula", "racing", "vehicle", "modern", "halo"],
	schema: z.object({
		rainLight: HexColorSchema.nullable()
			.default(null)
			.describe("The rain light's colour as #rrggbb; null = red, like a real car's."),
	}),
	fields: [{ key: "rainLight", label: "Rain light", type: "color", default: RAIN_RED }],
	defaultColor: "#d5232f",
	defaultAccent: "#1f1f24",
	colorLabel: "Livery",
	accentLabel: "Wings & details",
	canFollowPath: true,
	// No headlights, like a real F1 car: a red rain light at the back, on while it races after dark.
	lights: { whileDriving: true, label: "Rain light on" },
	footprint: () => [2 * CAR_SCALE, 0.95 * CROSS_SECTION * CAR_SCALE],
	// The top of the airbox and the rear wing; a real car is about 1.3 wheels tall.
	height: () => 0.45 * CROSS_SECTION * CAR_SCALE,
	Component: ({ props, color, accent, palette, lightsOn }) => {
		const carbon = palette.tire;
		return (
			<group scale={CAR_SCALE}>
				<group scale={[1, CROSS_SECTION, CROSS_SECTION]}>
					{/* Floor: carbon, narrower at the front, just off the ground under everything. */}
					<Taper
						length={1.3}
						back={[0.035, 0.62]}
						front={[0.035, 0.46]}
						position={[-0.17, 0.0425, 0]}
						color={carbon}
					/>

					{/* The tub around the driver, and the nose dropping to the front wing. */}
					<Taper
						length={0.56}
						back={[0.22, 0.34]}
						front={[0.2, 0.27]}
						position={[0.07, 0.16, 0]}
						color={color}
					/>

					<Taper
						length={0.64}
						back={[0.18, 0.25]}
						front={[0.05, 0.1]}
						lift={-0.06}
						position={[0.67, 0.17, 0]}
						color={color}
					/>

					{/* Sidepods: tall at their mouths with an undercut below, narrowing and dropping towards the back. */}
					{[1, -1].map((side) => (
						<group key={side}>
							<Taper
								length={0.78}
								back={[0.13, 0.1]}
								front={[0.18, 0.19]}
								lift={0.05}
								position={[-0.21, 0.125, side * 0.245]}
								color={color}
							/>

							<Box
								size={[0.02, 0.1, 0.14]}
								position={[0.18, 0.19, side * 0.245]}
								color={carbon}
								castShadow={false}
							/>

							{/* Mirror on a stalk above the sidepod. */}
							<Strut
								from={[0.14, 0.22, side * 0.17]}
								to={[0.13, 0.31, side * 0.26]}
								color={carbon}
							/>

							<Box size={[0.035, 0.035, 0.07]} position={[0.13, 0.31, side * 0.27]} color={color} />
						</group>
					))}

					{/* Engine cover, rising from the back to the airbox over the driver's head. */}
					<Taper
						length={0.8}
						back={[0.08, 0.1]}
						front={[0.22, 0.24]}
						lift={0.1}
						position={[-0.45, 0.2, 0]}
						color={color}
					/>

					<Box size={[0.12, 0.06, 0.12]} position={[-0.1, 0.405, 0]} color={color} />

					<Box
						size={[0.012, 0.045, 0.08]}
						position={[-0.036, 0.405, 0]}
						color={carbon}
						castShadow={false}
					/>

					{/* Gearbox and crash structure at the back, carrying the rain light, the rear wing's pylon and the rear suspension. */}
					<Taper
						length={0.57}
						back={[0.09, 0.08]}
						front={[0.13, 0.14]}
						position={[-0.685, 0.13, 0]}
						color={carbon}
					/>

					<RainLight
						position={[-0.98, 0.13, 0]}
						color={props.rainLight ?? RAIN_RED}
						on={lightsOn}
						night={palette.night}
					/>

					{/* Cockpit opening, driver and halo. */}
					<Box
						size={[0.3, 0.008, 0.2]}
						position={[0.12, 0.272, 0]}
						color={carbon}
						castShadow={false}
					/>

					<Helmet position={[0.1, 0.345, 0]} color={accent} visor={carbon} />

					<mesh position={[0.1, 0.38, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 2]} castShadow>
						<torusGeometry args={[0.14, 0.018, 6, 12, Math.PI]} />

						<meshStandardMaterial color={accent} roughness={0.6} />
					</mesh>

					{/* The halo's centre pillar and legs reach into the bodywork. */}
					<Strut from={[0.24, 0.38, 0]} to={[0.37, 0.22, 0]} thickness={0.032} color={accent} />

					{[1, -1].map((side) => (
						<Strut
							key={side}
							from={[0.1, 0.38, side * 0.14]}
							to={[0.06, 0.24, side * 0.14]}
							thickness={0.028}
							color={accent}
						/>
					))}

					{/* Front wing, low under the nose tip. */}
					<Wing
						position={[0.93, 0.075, 0]}
						span={0.86}
						chord={0.14}
						endplateHeight={0.09}
						flapTilt={0.35}
						color={accent}
					/>

					{/* Rear wing at about the airbox's height, on its pylon from the gearbox, with the beam wing below. */}
					<Wing
						position={[-0.86, 0.37, 0]}
						span={0.6}
						chord={0.15}
						endplateHeight={0.08}
						color={accent}
					/>

					{[1, -1].map((side) => (
						<Box
							key={side}
							size={[0.26, 0.24, 0.022]}
							position={[-0.88, 0.32, side * 0.31]}
							color={accent}
						/>
					))}

					<Box size={[0.05, 0.2, 0.03]} position={[-0.84, 0.27, 0]} color={accent} />

					<Box size={[0.08, 0.02, 0.44]} position={[-0.86, 0.22, 0]} color={accent} />

					{/* Suspension arms from the nose and the gearbox into the wheels, and the wheels with their covers. */}
					{[1, -1].map((side) => (
						<group key={side}>
							<Strut
								from={[0.42, 0.22, side * 0.08]}
								to={[FRONT_AXLE, 0.19, side * 0.33]}
								color={carbon}
							/>

							<Strut
								from={[0.42, 0.12, side * 0.08]}
								to={[FRONT_AXLE, 0.11, side * 0.33]}
								color={carbon}
							/>

							<Strut
								from={[-0.6, 0.17, side * 0.05]}
								to={[REAR_AXLE, 0.2, side * 0.32]}
								color={carbon}
							/>

							<Strut
								from={[-0.6, 0.1, side * 0.05]}
								to={[REAR_AXLE, 0.11, side * 0.32]}
								color={carbon}
							/>
						</group>
					))}
				</group>

				{/* Outside the body's scaling, so they stay round: at its scale, where it expects them. */}
				{WHEELS.flatMap(({ x, radius, width }) =>
					([1, -1] as const).map((side) => (
						<RaceWheel
							key={`${x}:${side}`}
							position={[x, radius * CROSS_SECTION, side * TRACK * CROSS_SECTION]}
							radius={radius * CROSS_SECTION}
							width={width * CROSS_SECTION}
							side={side}
							tire={palette.tire}
							rim={accent}
						/>
					)),
				)}
			</group>
		);
	},
});
