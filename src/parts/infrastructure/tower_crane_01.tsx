import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { z } from "zod";

import { motionClock } from "#/lib/motionClock";

import { LightLens, lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart, type IResolvedLight } from "../types";

const TowerCraneSchema = z.object({
	height: z.number().min(2).max(16).default(7),
	jibLength: z.number().min(2).max(12).default(6),
	hookOutAlongJib: z.number().min(0.1).max(1).default(0.6),
	cableLength: z.number().min(0.2).max(16).default(3.5),
	showsLoad: z.boolean().default(true),
	swingsToAndFro: z.boolean().default(true),
});

type TTowerCraneProps = z.output<typeof TowerCraneSchema>;

/** The mast: a square lattice this wide, in sections this tall. */
const MAST = { width: 0.42, section: 0.42 };
/** The jib reaching out along +X: a square lattice too, slimmer. */
const JIB = { width: 0.28, section: 0.4 };
/** The tower head above the turntable, which the ties hang the jibs from. */
const PEAK = { width: 0.22, height: 1.1 };
/** How far the turntable sits above the mast's top, and its own height. */
const TURNTABLE = 0.12;
/** Thickness of a lattice's chords and braces, and of the ties and cables. */
const BAR = 0.028;
const TIE = 0.016;

/** How far it swings each way, and how long a swing there and back takes. */
const SWING = { radians: 0.6, seconds: 48 };

/** What hangs on the hook: a bundle of beams, under its hook block. */
const LOAD = { size: [0.6, 0.18, 0.32] as [number, number, number], slings: 0.3 };
const HOOK_BLOCK = 0.16;

const counterJibLength = (p: TTowerCraneProps) => Math.max(1, p.jibLength * 0.32);

/** How far the hook's cable reaches: not into the ground, with or without its load. */
const cableReach = (p: TTowerCraneProps) =>
	Math.max(
		0.2,
		Math.min(
			p.cableLength,
			p.height + TURNTABLE - HOOK_BLOCK - (p.showsLoad ? LOAD.slings + LOAD.size[1] : 0) - 0.05,
		),
	);

/** A bar from one point to another in the XY plane, at depth z. */
const Strut = ({
	from,
	to,
	z,
	color,
	thickness = BAR,
}: {
	from: [number, number];
	to: [number, number];
	z: number;
	color: string;
	thickness?: number;
}) => {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	return (
		<Box
			size={[Math.hypot(dx, dy), thickness, thickness]}
			position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z]}
			rotation={[0, 0, Math.atan2(dy, dx)]}
			color={color}
			castShadow={thickness > TIE}
		/>
	);
};

/**
 * A square lattice standing up from y = 0: a chord at each corner, and on
 * each face a rung and a diagonal per section, zigzagging up.
 */
const Lattice = ({
	width,
	height,
	section,
	color,
}: {
	width: number;
	height: number;
	section: number;
	color: string;
}) => {
	const sections = Math.max(1, Math.round(height / section));
	const step = height / sections;
	const half = width / 2;
	return (
		<group>
			{[1, -1].flatMap((sx) =>
				[1, -1].map((sz) => (
					<Box
						key={`${sx},${sz}`}
						size={[BAR * 1.4, height, BAR * 1.4]}
						position={[sx * half, height / 2, sz * half]}
						color={color}
					/>
				)),
			)}

			{[0, 1, 2, 3].map((face) => (
				<group key={face} rotation={[0, (face * Math.PI) / 2, 0]}>
					{Array.from({ length: sections }, (_, i) => i).map((i) => {
						const y = i * step;
						const rising = i % 2 === 0 ? 1 : -1;
						return (
							<group key={y}>
								<Strut from={[-half, y + step]} to={[half, y + step]} z={half} color={color} />

								<Strut
									from={[-rising * half, y]}
									to={[rising * half, y + step]}
									z={half}
									color={color}
								/>
							</group>
						);
					})}
				</group>
			))}
		</group>
	);
};

/** Everything above the mast, turning on the turntable: jib, counter-jib, tower head, cab, hook. */
const Superstructure = ({
	p,
	crane,
	counterweight,
	cabWindows,
	load,
	lights,
}: {
	p: TTowerCraneProps;
	crane: string;
	counterweight: string;
	cabWindows: string;
	load: string;
	lights: Record<string, IResolvedLight>;
}) => {
	const turning = useRef<THREE.Group>(null);
	useFrame(() => {
		if (turning.current) {
			// Held where it is while motion is paused.
			turning.current.rotation.y = p.swingsToAndFro
				? SWING.radians * Math.sin((motionClock.seconds / SWING.seconds) * Math.PI * 2)
				: 0;
		}
	});
	const back = counterJibLength(p);
	const jibStart = MAST.width / 2;
	const jibTop = JIB.width;
	const hookAt = jibStart + 0.2 + (p.jibLength - jibStart - 0.4) * p.hookOutAlongJib;
	const cable = cableReach(p);
	return (
		// Only its turn changes, so its meshes are still drawn with their copies (ADR-0086) and need
		// no notInstanced mark.
		<group ref={turning}>
			<Box
				size={[MAST.width + 0.1, TURNTABLE, MAST.width + 0.1]}
				position={[0, TURNTABLE / 2, 0]}
				color={crane}
			/>

			{/* The jib, lying along +X: the mast's lattice turned on its side. */}
			<group position={[jibStart, TURNTABLE + JIB.width / 2, 0]} rotation={[0, 0, -Math.PI / 2]}>
				<Lattice
					width={JIB.width}
					height={p.jibLength - jibStart}
					section={JIB.section}
					color={crane}
				/>
			</group>

			{/* The counter-jib along −X: a deck with the counterweights at its end. */}
			<Box
				size={[back, 0.05, JIB.width + 0.1]}
				position={[-back / 2, TURNTABLE + 0.04, 0]}
				color={crane}
			/>

			{[1, -1].map((side) => (
				<Box
					key={side}
					size={[back, 0.12, BAR]}
					position={[-back / 2, TURNTABLE + 0.1, (side * (JIB.width + 0.1)) / 2]}
					color={crane}
					castShadow={false}
				/>
			))}

			{[0, 1, 2].map((i) => (
				<Box
					key={i}
					size={[0.12, 0.42, JIB.width + 0.16]}
					position={[-back + 0.08 + i * 0.13, TURNTABLE - 0.08, 0]}
					color={counterweight}
				/>
			))}

			{/* The tower head, and the ties it holds both jibs up by. */}
			<group position={[0, TURNTABLE, 0]}>
				<Lattice width={PEAK.width} height={PEAK.height} section={PEAK.height / 3} color={crane} />
			</group>

			{[1, -1].map((side) => (
				<group key={side}>
					<Strut
						from={[0, TURNTABLE + PEAK.height]}
						to={[jibStart + (p.jibLength - jibStart) * 0.7, TURNTABLE + jibTop]}
						z={(side * PEAK.width) / 2}
						color={crane}
						thickness={TIE}
					/>

					<Strut
						from={[0, TURNTABLE + PEAK.height]}
						to={[-back + 0.1, TURNTABLE + 0.12]}
						z={(side * PEAK.width) / 2}
						color={crane}
						thickness={TIE}
					/>
				</group>
			))}

			<LightLens
				light={lights.warningLights}
				size={[0.06, 0.06, 0.06]}
				position={[0, TURNTABLE + PEAK.height + 0.04, 0]}
			/>

			<LightLens
				light={lights.warningLights}
				size={[0.06, 0.06, 0.06]}
				position={[p.jibLength + 0.02, TURNTABLE + jibTop + 0.04, 0]}
			/>

			{/* The operator's cab, on the jib's side by its root, windows to the front and side. */}
			<group position={[jibStart + 0.18, TURNTABLE + 0.1, MAST.width / 2 + 0.16]}>
				<Box size={[0.32, 0.3, 0.28]} color={crane} />

				<Box
					size={[0.01, 0.16, 0.22]}
					position={[0.161, 0.03, 0]}
					color={cabWindows}
					castShadow={false}
					roughness={0.3}
					{...lightEmission(lights.cab, 1.2)}
				/>

				<Box
					size={[0.24, 0.16, 0.01]}
					position={[0.02, 0.03, 0.141]}
					color={cabWindows}
					castShadow={false}
					roughness={0.3}
					{...lightEmission(lights.cab, 1.2)}
				/>
			</group>

			{/* The trolley on the jib, its cables down to the hook block, and the load below. */}
			<group position={[hookAt, TURNTABLE - 0.02, 0]}>
				<Box size={[0.24, 0.07, JIB.width + 0.06]} color={crane} />

				{[0.05, -0.05].map((x) => (
					<Box
						key={x}
						size={[0.012, cable, 0.012]}
						position={[x, -cable / 2, 0]}
						color="#2b2b2b"
						castShadow={false}
					/>
				))}

				<group position={[0, -cable - HOOK_BLOCK / 2, 0]}>
					<Box size={[0.16, HOOK_BLOCK, 0.1]} color={crane} />

					<mesh position={[0, -HOOK_BLOCK / 2 - 0.04, 0]} rotation={[0, Math.PI / 2, 0]}>
						<torusGeometry args={[0.035, 0.012, 6, 12, Math.PI * 1.5]} />

						<Mat color="#3a3a3a" roughness={0.5} />
					</mesh>

					{p.showsLoad && (
						<group position={[0, -HOOK_BLOCK / 2 - 0.06, 0]}>
							{[1, -1].map((side) => (
								<Strut
									key={side}
									from={[0, 0]}
									to={[side * LOAD.size[0] * 0.4, -LOAD.slings]}
									z={0}
									color="#3a3a3a"
									thickness={0.008}
								/>
							))}

							{[-1, 0, 1].map((row) => (
								<Box
									key={row}
									size={[LOAD.size[0], LOAD.size[1], LOAD.size[2] / 3 - 0.01]}
									position={[0, -LOAD.slings - LOAD.size[1] / 2, (row * LOAD.size[2]) / 3]}
									color={load}
								/>
							))}
						</group>
					)}
				</group>
			</group>
		</group>
	);
};

export const towerCrane01 = definePart({
	kind: "tower_crane_01",
	name: "Tower crane",
	category: "infrastructure",
	// Its jib swings to and fro every frame.
	movesOnItsOwn: true,
	description:
		"Building-site tower crane: a lattice mast, its jib reaching out along +X with the hook and a load, counterweights at the back; it swings slowly to and fro, with red warning lights after dark",
	keywords: ["crane", "construction", "building site", "site", "jib", "hook", "lift", "progress"],
	schema: TowerCraneSchema,
	renamedProps: { showLoad: "showsLoad" },
	fields: [
		{ key: "height", label: "Height", type: "number", min: 2, max: 16, step: 0.1 },
		{ key: "jibLength", label: "Jib length", type: "number", min: 2, max: 12, step: 0.1 },
		{
			key: "hookOutAlongJib",
			label: "Hook along the jib",
			type: "number",
			min: 0.1,
			max: 1,
			step: 0.01,
		},
		{ key: "cableLength", label: "Hook hangs down", type: "number", min: 0.2, max: 16, step: 0.1 },
		{ key: "showsLoad", label: "Show a load on the hook", type: "boolean" },
		{ key: "swingsToAndFro", label: "Swings to and fro", type: "boolean" },
	],
	colors: [
		{ id: "crane", name: "Crane", default: "#e9b422", legacy: "color" },
		{ id: "counterweight", name: "Counterweights", default: "#a8a49b", legacy: "accent" },
		{ id: "footing", name: "Footing", default: "#9a968e" },
		{ id: "cabWindows", name: "Cab windows", default: "#33414c" },
		{ id: "load", name: "Load", default: "#8a6a48" },
	],
	lights: [
		{ id: "warningLights", name: "Warning lights", shape: "lens", color: "#ff2a1f" },
		{ id: "cab", name: "Cab", shape: "glow" },
	],
	// The mast's foot, and the jibs overhead, which swing.
	footprint: (p) => [p.jibLength * 2, 1.3],
	overhang: (p) => ({
		foot: [1.3, 1.3],
		from: Math.max(0, p.height - cableReach(p) - (p.showsLoad ? 0.6 : 0.3)),
	}),
	height: (p) => p.height + TURNTABLE + PEAK.height + 0.1,
	Component: ({ props: p, colors, lights }) => (
		<group>
			{/* A concrete footing the mast is bolted to. */}
			<Box size={[1.2, 0.16, 1.2]} position={[0, 0.08, 0]} color={colors.footing} />

			<group position={[0, 0.16, 0]}>
				<Lattice
					width={MAST.width}
					height={p.height - 0.16}
					section={MAST.section}
					color={colors.crane}
				/>
			</group>

			<group position={[0, p.height, 0]}>
				<Superstructure
					p={p}
					crane={colors.crane}
					counterweight={colors.counterweight}
					cabWindows={colors.cabWindows}
					load={colors.load}
					lights={lights}
				/>
			</group>
		</group>
	),
});
