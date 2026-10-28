import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { z } from "zod";

import { motionClock } from "#/lib/motionClock";

import { lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart, type IResolvedLight } from "../types";

const TrafficLightSchema = z.object({
	poleHeight: z.number().min(0.6).max(3).default(1.3),
	armLength: z.number().min(0).max(4).default(0),
	cyclesThroughSignals: z.boolean().default(true),
	secondsPerCycle: z.number().min(4).max(120).default(20),
	cycleHeadStartSeconds: z.number().min(0).max(120).default(0),
});

type TTrafficLightProps = z.output<typeof TrafficLightSchema>;

/** Its signals from top to bottom, and the part of a cycle each shows: green, then amber, then red. */
const SIGNALS = [
	{ id: "red", from: 0.5, until: 1 },
	{ id: "amber", from: 0.4, until: 0.5 },
	{ id: "green", from: 0, until: 0.4 },
] as const;

/** The head: a box of three lamps, one above the other, facing +Z. */
const HEAD = { width: 0.15, height: 0.44, depth: 0.11, lampRadius: 0.045, lampSpacing: 0.135 };

/** The pole's radius. */
const POLE = 0.035;

/** How far through its cycle a signal is now, 0–1. */
const cyclePosition = (p: TTrafficLightProps) =>
	((((motionClock.seconds + p.cycleHeadStartSeconds) % p.secondsPerCycle) + p.secondsPerCycle) %
		p.secondsPerCycle) /
	p.secondsPerCycle;

/**
 * One lamp: lit in its light's colour while it shows, a dark lens otherwise.
 * Cycling, it shows in its part of the cycle while its light is on; not
 * cycling, whenever its light is on (from data, say).
 */
const SignalLamp = ({
	light,
	signal,
	cycles,
	y,
}: {
	light: IResolvedLight;
	signal: (typeof SIGNALS)[number];
	cycles: TTrafficLightProps | null;
	y: number;
}) => {
	// A deeper shade of its colour, so its own glow on top keeps the hue rather than going white.
	const lens = useMemo(
		() => `#${new THREE.Color(light.color).multiplyScalar(0.55).getHexString()}`,
		[light.color],
	);
	const lit = useRef<THREE.Mesh>(null);
	const dark = useRef<THREE.Mesh>(null);
	useFrame(() => {
		if (!lit.current || !dark.current) {
			return;
		}
		const position = cycles ? cyclePosition(cycles) : null;
		const shows =
			light.on && (position === null || (position >= signal.from && position < signal.until));
		lit.current.visible = shows;
		dark.current.visible = !shows;
	});
	return (
		<group position={[0, y, HEAD.depth / 2]}>
			{/* Shown or hidden each frame: drawn on their own, not with other lights' (notInstanced). */}
			<mesh ref={lit} rotation={[Math.PI / 2, 0, 0]} userData={{ notInstanced: true }}>
				<cylinderGeometry args={[HEAD.lampRadius, HEAD.lampRadius, 0.02, 16]} />

				<Mat color={lens} roughness={0.3} {...lightEmission(light, 1.1)} />
			</mesh>

			<mesh ref={dark} rotation={[Math.PI / 2, 0, 0]} userData={{ notInstanced: true }}>
				<cylinderGeometry args={[HEAD.lampRadius, HEAD.lampRadius, 0.02, 16]} />

				<Mat color="#2a2b2d" roughness={0.3} />
			</mesh>

			{/* A visor over the lamp, keeping the sun off it. */}
			<Box
				size={[HEAD.lampRadius * 2 + 0.02, 0.01, 0.06]}
				position={[0, HEAD.lampRadius + 0.012, 0.03]}
				rotation={[0.25, 0, 0]}
				color="#1f2022"
			/>
		</group>
	);
};

/** A head of three lamps on its backboard, centred on its middle lamp. */
const SignalHead = ({
	position,
	lights,
	cycles,
	housing,
	backboard,
}: {
	position: [number, number, number];
	lights: Record<string, IResolvedLight>;
	cycles: TTrafficLightProps | null;
	housing: string;
	backboard: string;
}) => (
	<group position={position}>
		<Box size={[HEAD.width, HEAD.height, HEAD.depth]} color={housing} />

		<Box
			size={[HEAD.width + 0.1, HEAD.height + 0.1, 0.012]}
			position={[0, 0, -HEAD.depth / 2 - 0.006]}
			color={backboard}
		/>

		{SIGNALS.map((signal, i) => (
			<SignalLamp
				key={signal.id}
				light={lights[signal.id]}
				signal={signal}
				cycles={cycles}
				y={(1 - i) * HEAD.lampSpacing}
			/>
		))}
	</group>
);

export const trafficLight01 = definePart({
	kind: "traffic_light_01",
	name: "Traffic light",
	category: "infrastructure",
	// Its lamps change with the cycle every frame.
	movesOnItsOwn: true,
	description:
		"Traffic signal facing +Z: red, amber and green take turns, or, with cycling off, each lamp shows while its light is on (from data, in the Lights tab). An arm reaches out over the road along +X.",
	keywords: ["signal", "traffic signal", "stop light", "junction", "crossing", "status", "rag"],
	schema: TrafficLightSchema,
	fields: [
		{ key: "poleHeight", label: "Pole height", type: "number", min: 0.6, max: 3, step: 0.05 },
		{ key: "armLength", label: "Arm over the road", type: "number", min: 0, max: 4, step: 0.05 },
		{ key: "cyclesThroughSignals", label: "Cycles through its signals", type: "boolean" },
		{
			key: "secondsPerCycle",
			label: "Seconds per cycle",
			type: "number",
			min: 4,
			max: 120,
			step: 1,
		},
		{
			key: "cycleHeadStartSeconds",
			label: "Head start in the cycle (s)",
			type: "number",
			min: 0,
			max: 120,
			step: 1,
		},
	],
	colors: [
		{ id: "pole", name: "Pole", default: "#7c8085", legacy: "color" },
		{ id: "housing", name: "Signal head", default: "#2d3033", legacy: "accent" },
		{ id: "backboard", name: "Backboard", default: "#1d1e20" },
	],
	lights: [
		{ id: "red", name: "Red", shape: "lens", color: "#ff3b30", when: "always" },
		{ id: "amber", name: "Amber", shape: "lens", color: "#ffb000", when: "always" },
		{ id: "green", name: "Green", shape: "lens", color: "#2bd96b", when: "always" },
	],
	footprint: (p) => [0.3 + p.armLength * 2, 0.3],
	height: (p) => p.poleHeight + 0.05,
	Component: ({ props: p, colors, lights }) => {
		const cycles = p.cyclesThroughSignals ? p : null;
		const top = p.poleHeight;
		return (
			<group>
				<mesh position={[0, top / 2, 0]} castShadow>
					<cylinderGeometry args={[POLE, POLE * 1.2, top, 10]} />

					<Mat color={colors.pole} roughness={0.6} />
				</mesh>

				<mesh position={[0, top + 0.01, 0]}>
					<sphereGeometry args={[POLE * 1.1, 10, 6]} />

					<Mat color={colors.pole} roughness={0.6} />
				</mesh>

				{/* A head on the pole, for those stopping beside it. */}
				<SignalHead
					position={[0, Math.max(0.35, top - 0.32), POLE + HEAD.depth / 2]}
					lights={lights}
					cycles={cycles}
					housing={colors.housing}
					backboard={colors.backboard}
				/>

				{/* With an arm, a second head hangs over the road at its end. */}
				{p.armLength > 0 && (
					<group>
						<mesh
							position={[p.armLength / 2, top - 0.05, 0]}
							rotation={[0, 0, Math.PI / 2]}
							castShadow
						>
							<cylinderGeometry args={[POLE * 0.8, POLE * 0.8, p.armLength, 8]} />

							<Mat color={colors.pole} roughness={0.6} />
						</mesh>

						<SignalHead
							position={[p.armLength, top - 0.05 - POLE - HEAD.height / 2 - 0.02, 0]}
							lights={lights}
							cycles={cycles}
							housing={colors.housing}
							backboard={colors.backboard}
						/>
					</group>
				)}
			</group>
		);
	},
});
