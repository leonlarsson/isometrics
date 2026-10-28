import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { z } from "zod";

import { motionClock } from "#/lib/motionClock";

import { LightLens } from "../lights";
import { Box, Mat, Taper } from "../primitives";
import { definePart } from "../types";

const WindTurbineSchema = z.object({
	towerHeight: z.number().min(2).max(14).default(5.5),
	bladeLength: z.number().min(0.8).max(6).default(2.6),
	rotorTurns: z.boolean().default(true),
	rotorSecondsPerTurn: z.number().min(1).max(30).default(5),
});

/** The nacelle on top of the tower, and how far in front of the tower the rotor's hub is. */
const NACELLE = { width: 0.24, height: 0.24, length: 0.62 };
const HUB_OUT = 0.36;

/** The rotor: three blades round the hub, turning about the way it faces (+Z). */
const Rotor = ({
	bladeLength,
	turns,
	secondsPerTurn,
	blades,
	hub,
}: {
	bladeLength: number;
	turns: boolean;
	secondsPerTurn: number;
	blades: string;
	hub: string;
}) => {
	const rotor = useRef<THREE.Group>(null);
	useFrame(() => {
		if (rotor.current) {
			// Held where it is while motion is paused.
			rotor.current.rotation.z = turns ? -(motionClock.seconds / secondsPerTurn) * Math.PI * 2 : 0;
		}
	});
	return (
		// Only its turn changes, so its meshes are still drawn with their copies (ADR-0086) and need
		// no notInstanced mark.
		<group ref={rotor}>
			<mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]} castShadow>
				<coneGeometry args={[0.1, 0.22, 12]} />

				<Mat color={hub} />
			</mesh>

			{[0, 1, 2].map((i) => (
				<group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3 + Math.PI / 2]}>
					{/* Root to tip along X, its broad side to the wind, twisted a little. */}
					<Taper
						length={bladeLength}
						back={[0.2, 0.05]}
						front={[0.05, 0.02]}
						position={[bladeLength / 2 + 0.05, 0, 0.04]}
						rotation={[0.2, 0, 0]}
						color={blades}
					/>
				</group>
			))}
		</group>
	);
};

export const windTurbine01 = definePart({
	kind: "wind_turbine_01",
	name: "Wind turbine",
	category: "infrastructure",
	// Its rotor turns every frame.
	movesOnItsOwn: true,
	description:
		"Tall wind turbine whose three-bladed rotor faces +Z and turns, with a red warning light on top after dark",
	keywords: ["windmill", "wind farm", "energy", "power", "renewable", "electricity", "turbine"],
	schema: WindTurbineSchema,
	fields: [
		{ key: "towerHeight", label: "Tower height", type: "number", min: 2, max: 14, step: 0.1 },
		{ key: "bladeLength", label: "Blade length", type: "number", min: 0.8, max: 6, step: 0.1 },
		{ key: "rotorTurns", label: "Rotor turns", type: "boolean" },
		{
			key: "rotorSecondsPerTurn",
			label: "Seconds per turn",
			type: "number",
			min: 1,
			max: 30,
			step: 0.5,
		},
	],
	colors: [
		{ id: "tower", name: "Tower", default: "#eceeee", legacy: "color" },
		{ id: "blades", name: "Blades", default: "#f6f7f7", legacy: "accent" },
		{ id: "nacelle", name: "Nacelle", default: "#dfe2e3" },
	],
	lights: [{ id: "warningLight", name: "Warning light", shape: "lens", color: "#ff2a1f" }],
	// Its foot, and the rotor overhead, which turns through a circle across.
	footprint: (p) => [(p.bladeLength + 0.1) * 2, 0.9],
	overhang: (p) => ({ foot: [0.6, 0.6], from: Math.max(0, p.towerHeight - p.bladeLength - 0.1) }),
	height: (p) => p.towerHeight + p.bladeLength + 0.1,
	Component: ({ props: p, colors, lights }) => {
		const top = p.towerHeight;
		return (
			<group>
				{/* A round foundation, and the tower narrowing as it rises. */}
				<mesh position={[0, 0.03, 0]} receiveShadow>
					<cylinderGeometry args={[0.28, 0.3, 0.06, 16]} />

					<Mat color="#a7a49d" />
				</mesh>

				<mesh position={[0, top / 2, 0]} castShadow>
					<cylinderGeometry args={[0.07, 0.15, top, 16]} />

					<Mat color={colors.tower} roughness={0.6} />
				</mesh>

				{/* The nacelle, reaching back from over the tower, and the rotor at its front. */}
				<group position={[0, top + NACELLE.height / 2, 0]}>
					<Box
						size={[NACELLE.width, NACELLE.height, NACELLE.length]}
						position={[0, 0, HUB_OUT - NACELLE.length / 2 - 0.02]}
						color={colors.nacelle}
					/>

					<LightLens
						light={lights.warningLight}
						size={[0.06, 0.04, 0.06]}
						position={[0, NACELLE.height / 2 + 0.02, HUB_OUT - NACELLE.length + 0.08]}
					/>

					<group position={[0, 0, HUB_OUT]}>
						<Rotor
							bladeLength={p.bladeLength}
							turns={p.rotorTurns}
							secondsPerTurn={p.rotorSecondsPerTurn}
							blades={colors.blades}
							hub={colors.nacelle}
						/>
					</group>
				</group>
			</group>
		);
	},
});
