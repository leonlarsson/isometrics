import { z } from "zod";

import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { Insulator, Wire } from "./powerLineKit";

const PowerPoleSchema = z.object({
	height: z.number().min(1.2).max(5).default(2.4),
	wireSpan: z.number().min(0).max(12).default(3.5),
	showsTransformer: z.boolean().default(false),
});

/** The crossarm near the top, across the line (along Z), and how far out its insulators sit. */
const CROSSARM = { length: 0.84, below: 0.14 };
const INSULATOR_OUT = 0.36;

export const powerPole01 = definePart({
	kind: "power_pole_01",
	name: "Power pole",
	category: "infrastructure",
	description:
		"Wooden utility pole with a crossarm and three insulators; its wires run along +X to the next pole, a wire span away",
	keywords: [
		"utility pole",
		"telegraph pole",
		"power line",
		"electricity",
		"wires",
		"cables",
		"grid",
	],
	schema: PowerPoleSchema,
	renamedProps: { showTransformer: "showsTransformer" },
	fields: [
		{ key: "height", label: "Height", type: "number", min: 1.2, max: 5, step: 0.05 },
		{
			key: "wireSpan",
			label: "Wires to the next pole",
			type: "number",
			min: 0,
			max: 12,
			step: 0.05,
		},
		{ key: "showsTransformer", label: "Show a transformer", type: "boolean" },
	],
	colors: [
		{ id: "pole", name: "Pole and crossarm", default: "#7a5b3e", legacy: "color" },
		{ id: "wires", name: "Wires", default: "#2a2a2a", legacy: "accent" },
		{ id: "insulators", name: "Insulators", default: "#d8d4ca" },
		{ id: "transformer", name: "Transformer", default: "#8b9298" },
	],
	footprint: () => [0.3, CROSSARM.length + 0.06],
	height: (p) => p.height + 0.12,
	Component: ({ props: p, colors }) => {
		const arm = p.height - CROSSARM.below;
		// Where the wires are held: on the crossarm's two ends, and on the pole's top.
		const holds: [number, number, number][] = [
			[0, arm + 0.03 + 0.09, -INSULATOR_OUT],
			[0, arm + 0.03 + 0.09, INSULATOR_OUT],
			[0, p.height + 0.09, 0],
		];
		return (
			<group>
				<mesh position={[0, p.height / 2, 0]} castShadow>
					<cylinderGeometry args={[0.04, 0.055, p.height, 10]} />

					<Mat color={colors.pole} roughness={0.95} />
				</mesh>

				<Box
					size={[0.06, 0.06, CROSSARM.length]}
					position={[0, arm, 0]}
					color={colors.pole}
					roughness={0.95}
				/>

				{/* Braces from the pole up to the crossarm. */}
				{[1, -1].map((side) => (
					<Box
						key={side}
						size={[0.02, 0.26, 0.02]}
						position={[0, arm - 0.1, side * 0.13]}
						rotation={[side * 0.85, 0, 0]}
						color={colors.pole}
						castShadow={false}
					/>
				))}

				<Insulator position={[0, arm + 0.03, -INSULATOR_OUT]} color={colors.insulators} />

				<Insulator position={[0, arm + 0.03, INSULATOR_OUT]} color={colors.insulators} />

				<Insulator position={[0, p.height, 0]} color={colors.insulators} />

				{p.wireSpan > 0 &&
					holds.map((at) => (
						<Wire key={at[2]} span={p.wireSpan} position={at} color={colors.wires} />
					))}

				{/* A pole-top transformer, hung on the pole's back below the crossarm. */}
				{p.showsTransformer && (
					<group position={[-0.15, Math.max(0.5, arm - 0.5), 0]}>
						<mesh castShadow>
							<cylinderGeometry args={[0.1, 0.1, 0.26, 14]} />

							<Mat color={colors.transformer} roughness={0.6} />
						</mesh>

						<mesh position={[0, 0.14, 0]}>
							<cylinderGeometry args={[0.105, 0.1, 0.03, 14]} />

							<Mat color={colors.transformer} roughness={0.6} />
						</mesh>

						<Box size={[0.1, 0.04, 0.06]} position={[0.08, 0.06, 0]} color={colors.transformer} />

						{[-0.05, 0.05].map((z) => (
							<Box
								key={z}
								size={[0.012, 0.18, 0.012]}
								position={[0.02, 0.24, z]}
								color={colors.wires}
								castShadow={false}
							/>
						))}
					</group>
				)}
			</group>
		);
	},
});
