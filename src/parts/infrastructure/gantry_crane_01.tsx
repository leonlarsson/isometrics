import { z } from "zod";

import { LightLens, LightPool, lightEmission } from "../lights";
import { Box, Strut } from "../primitives";
import { definePart } from "../types";

const GantryCraneSchema = z.object({
	isBoomRaised: z.boolean().default(false),
	trolleyOutAlongBoom: z.number().min(0).max(1).default(0.55),
});

/** Its legs: how far apart along the quay (z) and across it (x), and how tall. */
const LEGS = { apart: 1.6, across: 1.8, height: 3.4 };
/** The boom out over the water (+X), and the backreach behind the legs. */
const BOOM = { out: 4.2, back: 1.6, depth: 0.22 };
/** The machinery house on top, and the A-frame over it that holds the boom's stays. */
const HOUSE = { length: 0.9, height: 0.42 };
const APEX = 1.6;
/** How far a raised boom is turned up. */
const RAISED = (80 * Math.PI) / 180;

export const gantryCrane01 = definePart({
	kind: "gantry_crane_01",
	name: "Gantry crane",
	category: "infrastructure",
	description:
		"A port's ship-to-shore crane on four legs, its boom reaching out over the water (+X) with a trolley and a spreader to lift containers",
	keywords: ["container crane", "port", "harbour", "quay", "ship to shore", "dock", "shipping"],
	schema: GantryCraneSchema,
	renamedLights: { warningLamp: "warningLight" },
	fields: [
		{ key: "isBoomRaised", label: "Boom raised", type: "boolean" },
		{
			key: "trolleyOutAlongBoom",
			label: "Trolley out along the boom",
			type: "number",
			min: 0,
			max: 1,
			step: 0.05,
		},
	],
	colors: [
		{ id: "frame", name: "Frame", default: "#2f6fb5", legacy: "color" },
		{ id: "house", name: "Machinery house", default: "#f4f1ea", legacy: "accent" },
		{ id: "trolley", name: "Trolley and spreader", default: "#e8b83a" },
	],
	lights: [
		{
			id: "floodlights",
			name: "Floodlights",
			description: "Lights under the boom, lighting the quay and the ship below.",
			shape: "pool",
			color: "#f2f4ff",
			reach: 2.2,
			realLight: () => ({ at: [BOOM.out * 0.4, LEGS.height - 0.3, 0] }),
		},
		{
			id: "warningLight",
			name: "Warning light",
			description: "A red lamp on the top, for aircraft, lit after dark.",
			shape: "lens",
			color: "#ff3b30",
		},
	],
	footprint: () => [BOOM.out + BOOM.back, LEGS.apart + 0.3],
	height: () => LEGS.height + BOOM.depth + APEX + 0.1,
	Component: ({ props: p, colors, palette, lights }) => {
		const top = LEGS.height;
		const halfAcross = LEGS.across / 2;
		const halfApart = LEGS.apart / 2;
		const hinge = halfAcross;
		// The boom from the legs' waterside out; raised, it's turned up about its hinge.
		const turn = p.isBoomRaised ? RAISED : 0;
		const boomEnd: [number, number] = [
			hinge + Math.cos(turn) * (BOOM.out - hinge),
			top + Math.sin(turn) * (BOOM.out - hinge),
		];
		const trolleyX =
			-BOOM.back + (BOOM.out + BOOM.back) * (p.isBoomRaised ? 0.2 : p.trolleyOutAlongBoom);
		const spreaderY = Math.max(0.5, top - 1.8);
		return (
			<group>
				{/* Four legs on their rails, and the portal beams joining them. */}
				{[halfAcross, -halfAcross].flatMap((x) =>
					[halfApart, -halfApart].map((z) => (
						<group key={`${x}:${z}`}>
							<Strut from={[x, 0, z]} to={[x, top, z]} color={colors.frame} thickness={0.12} />

							<Box size={[0.3, 0.1, 0.18]} position={[x, 0.05, z]} color={palette.tire} />
						</group>
					)),
				)}

				{[halfApart, -halfApart].map((z) => (
					<group key={z}>
						<Strut
							from={[-halfAcross, top * 0.45, z]}
							to={[halfAcross, top * 0.45, z]}
							color={colors.frame}
							thickness={0.1}
						/>

						<Strut
							from={[-halfAcross, top, z]}
							to={[halfAcross, top, z]}
							color={colors.frame}
							thickness={0.1}
						/>
					</group>
				))}

				{[halfAcross, -halfAcross].map((x) => (
					<Strut
						key={x}
						from={[x, top, -halfApart]}
						to={[x, top, halfApart]}
						color={colors.frame}
						thickness={0.1}
					/>
				))}

				{/* The boom's two girders: the backreach over the land, and the boom over the water. */}
				{[0.3, -0.3].map((z) => (
					<group key={z}>
						<Strut
							from={[-BOOM.back, top, z]}
							to={[hinge, top, z]}
							color={colors.frame}
							thickness={BOOM.depth}
						/>

						<Strut
							from={[hinge, top, z]}
							to={[boomEnd[0], boomEnd[1], z]}
							color={colors.frame}
							thickness={BOOM.depth}
						/>
					</group>
				))}

				{/* The machinery house on the backreach, and the A-frame above the legs. */}
				<Box
					size={[HOUSE.length, HOUSE.height, 0.8]}
					position={[
						-BOOM.back + HOUSE.length / 2 + 0.05,
						top + BOOM.depth / 2 + HOUSE.height / 2,
						0,
					]}
					color={colors.house}
				/>

				{[0.32, -0.32].map((z) => (
					<group key={z}>
						<Strut
							from={[halfAcross - 0.3, top, z]}
							to={[0, top + APEX, z * 0.5]}
							color={colors.frame}
							thickness={0.07}
						/>

						<Strut
							from={[-halfAcross + 0.3, top, z]}
							to={[0, top + APEX, z * 0.5]}
							color={colors.frame}
							thickness={0.07}
						/>

						{/* The stays: from the A-frame's top out to the boom, and back to the backreach. */}
						<Strut
							from={[0, top + APEX, z * 0.5]}
							to={[boomEnd[0] - 0.3, boomEnd[1] + 0.05, z]}
							color={colors.frame}
							thickness={0.025}
							castShadow={false}
						/>

						<Strut
							from={[0, top + APEX, z * 0.5]}
							to={[-BOOM.back + 0.2, top + 0.05, z]}
							color={colors.frame}
							thickness={0.025}
							castShadow={false}
						/>
					</group>
				))}

				<LightLens
					light={lights.warningLight}
					size={[0.08, 0.08, 0.08]}
					position={[0, top + APEX + 0.06, 0]}
				/>

				{/* The trolley on the girders, with its operator's cab and the spreader on its cables. */}
				{!p.isBoomRaised && (
					<group position={[trolleyX, top - BOOM.depth / 2 - 0.12, 0]}>
						<Box size={[0.4, 0.14, 0.7]} color={colors.trolley} />

						<Box size={[0.22, 0.2, 0.2]} position={[0.05, -0.17, -0.2]} color={colors.trolley} />

						<Box
							size={[0.02, 0.1, 0.16]}
							position={[0.16, -0.17, -0.2]}
							color={palette.glass}
							castShadow={false}
						/>

						{[0.2, -0.2].map((z) => (
							<Strut
								key={z}
								from={[0, -0.07, z]}
								to={[0, spreaderY - top + 0.2, z]}
								color="#2b2b2f"
								thickness={0.012}
								castShadow={false}
							/>
						))}

						<Box
							size={[0.5, 0.06, 0.24]}
							position={[0, spreaderY - top + 0.2, 0]}
							color={colors.trolley}
						/>
					</group>
				)}

				{/* Floodlights under the boom. */}
				{[0.35, 0.75].map((share) => (
					<Box
						key={share}
						size={[0.12, 0.04, 0.12]}
						position={[hinge + (BOOM.out - hinge) * share, top - BOOM.depth / 2 - 0.02, 0]}
						color="#e8e9ee"
						castShadow={false}
						{...lightEmission(lights.floodlights, 2)}
					/>
				))}

				<LightPool light={lights.floodlights} at={[BOOM.out * 0.45, 0]} />
			</group>
		);
	},
});
