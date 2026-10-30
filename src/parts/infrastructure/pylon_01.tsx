import { z } from "zod";

import { LightLens } from "../lights";
import { Strut } from "../primitives";
import { definePart } from "../types";

import { Insulator, Wire } from "./powerLineKit";

const PylonSchema = z.object({
	height: z.number().min(3).max(12).default(6),
	wireSpan: z.number().min(0).max(24).default(9),
});

/** Half its width at the foot and at the top, and how many sections its lattice has. */
const BASE = 0.75;
const TOP = 0.2;
const SECTIONS = 6;
/** Its two crossarms: how far down from the top, and how far out each side. */
const ARMS = [
	{ below: 0.25, out: 1.05 },
	{ below: 1.05, out: 1.3 },
];
/** How far the insulator strings hang under the crossarms. */
const HANG = 0.3;

export const pylon01 = definePart({
	kind: "pylon_01",
	name: "Pylon",
	category: "infrastructure",
	description:
		"Steel lattice tower for high-voltage lines, with two crossarms; its wires run along +X to the next pylon, a wire span away",
	keywords: ["power line", "transmission tower", "electricity", "grid", "high voltage", "wires"],
	schema: PylonSchema,
	fields: [
		{ key: "height", label: "Height", type: "number", min: 3, max: 12, step: 0.1 },
		{
			key: "wireSpan",
			label: "Wires to the next pylon",
			type: "number",
			min: 0,
			max: 24,
			step: 0.1,
		},
	],
	colors: [
		{ id: "steel", name: "Steel", default: "#9aa1a6", legacy: "color" },
		{ id: "wires", name: "Wires", default: "#2a2a2a", legacy: "accent" },
		{ id: "insulators", name: "Insulators", default: "#d8d4ca" },
	],
	lights: [
		{
			id: "warningLamp",
			name: "Warning lamp",
			description: "A red lamp on the top, for aircraft, lit after dark.",
			shape: "lens",
			color: "#ff3b30",
		},
	],
	footprint: () => [BASE * 2, Math.max(BASE, ARMS[1].out) * 2],
	height: (p) => p.height + 0.1,
	Component: ({ props: p, colors, lights }) => {
		const h = p.height;
		/** Half its width at a height, between the foot and the top. */
		const halfAt = (y: number) => BASE + (TOP - BASE) * Math.min(1, y / (h - ARMS[1].below));
		const corner = (y: number, sx: number, sz: number): [number, number, number] => [
			sx * halfAt(y),
			y,
			sz * halfAt(y),
		];
		const levels = Array.from(
			{ length: SECTIONS + 1 },
			(_, i) => ((h - ARMS[1].below) * i) / SECTIONS,
		);
		const corners = [
			[1, 1],
			[1, -1],
			[-1, -1],
			[-1, 1],
		] as const;
		return (
			<group>
				{/* Four legs, leaning in, and the top above them. */}
				{corners.map(([sx, sz]) => (
					<group key={`${sx}:${sz}`}>
						<Strut
							from={corner(0, sx, sz)}
							to={corner(h - ARMS[1].below, sx, sz)}
							color={colors.steel}
							thickness={0.05}
						/>

						<Strut
							from={corner(h - ARMS[1].below, sx, sz)}
							to={[sx * TOP * 0.6, h, sz * TOP * 0.6]}
							color={colors.steel}
							thickness={0.04}
						/>
					</group>
				))}

				{/* A cross of braces on every face of every section. */}
				{levels.slice(0, -1).flatMap((y, i) => {
					const next = levels[i + 1];
					return corners.flatMap(([sx, sz], c) => {
						const [nx, nz] = corners[(c + 1) % 4];
						return [
							<Strut
								key={`${y}:${sx}:${sz}:a`}
								from={corner(y, sx, sz)}
								to={corner(next, nx, nz)}
								color={colors.steel}
								thickness={0.022}
								castShadow={false}
							/>,
							<Strut
								key={`${y}:${sx}:${sz}:b`}
								from={corner(y, nx, nz)}
								to={corner(next, sx, sz)}
								color={colors.steel}
								thickness={0.022}
								castShadow={false}
							/>,
						];
					});
				})}

				{/* The crossarms across the line (along Z), each a pair of beams, with the insulator strings hanging under their ends and the wires on them. */}
				{ARMS.map(({ below, out }) => {
					const y = h - below;
					return (
						<group key={below}>
							{[0.08, -0.08].map((x) => (
								<Strut
									key={x}
									from={[x, y, -out]}
									to={[x, y, out]}
									color={colors.steel}
									thickness={0.04}
								/>
							))}

							{[1, -1].map((side) => (
								<Strut
									key={side}
									from={[0, y - 0.35, side * halfAt(y - 0.35)]}
									to={[0, y, side * out]}
									color={colors.steel}
									thickness={0.025}
									castShadow={false}
								/>
							))}

							{[out - 0.05, -(out - 0.05)].map((z) => (
								<group key={z}>
									{[0, 1, 2].map((disc) => (
										<Insulator
											key={disc}
											position={[0, y - HANG + disc * 0.09, z]}
											color={colors.insulators}
										/>
									))}

									{p.wireSpan > 0 && (
										<Wire span={p.wireSpan} position={[0, y - HANG, z]} color={colors.wires} />
									)}
								</group>
							))}
						</group>
					);
				})}

				{/* The earth wire along the peaks, and the lamp on the top. */}
				{p.wireSpan > 0 && <Wire span={p.wireSpan} position={[0, h, 0]} color={colors.wires} />}

				<LightLens
					light={lights.warningLamp}
					size={[0.07, 0.07, 0.07]}
					position={[0, h + 0.05, 0]}
				/>
			</group>
		);
	},
});
