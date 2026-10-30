import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Box, Mat, Strut, spread } from "../primitives";
import { definePart } from "../types";

import { Insulator } from "./powerLineKit";

const SubstationSchema = z.object({
	transformerCount: z.number().int().min(1).max(4).default(2),
	showsFence: z.boolean().default(true),
});

/** The yard: how wide (x) and deep (z). */
const YARD = { width: 3.4, depth: 2.6 };
/** A transformer: its tank, and the fins down its sides. */
const TANK = { width: 0.5, height: 0.5, depth: 0.42 };
/** The gantry the lines come in on, at the back. */
const GANTRY = { height: 1.3, z: -0.85 };

export const substation01 = definePart({
	kind: "substation_01",
	name: "Substation",
	category: "infrastructure",
	description:
		"Electricity substation: transformers in a fenced yard, a gantry the lines come in on, and a control hut; its gate faces +Z",
	keywords: ["electricity", "power", "grid", "transformer", "utility", "energy", "industrial"],
	schema: SubstationSchema,
	renamedProps: { showFence: "showsFence" },
	fields: [
		{ key: "transformerCount", label: "Transformers", type: "number", min: 1, max: 4, step: 1 },
		{ key: "showsFence", label: "Show the fence", type: "boolean" },
	],
	colors: [
		{ id: "transformers", name: "Transformers", default: "#8b9298", legacy: "color" },
		{ id: "steel", name: "Gantry and fence", default: "#a7adb2", legacy: "accent" },
		{ id: "ground", name: "Yard", default: "#c9c4b8" },
		{ id: "hut", name: "Control hut", default: "#d9d3c5" },
		{ id: "insulators", name: "Insulators", default: "#d8d4ca" },
	],
	lights: [
		{
			id: "yardLight",
			name: "Yard light",
			description: "A floodlight on the hut, lighting the yard after dark.",
			shape: "pool",
			color: "#f2f4ff",
			reach: 1.6,
			realLight: () => ({ at: [YARD.width / 2 - 0.4, 0.9, YARD.depth / 2 - 0.3] }),
		},
	],
	footprint: () => [YARD.width, YARD.depth],
	height: () => GANTRY.height + 0.15,
	Component: ({ props: p, colors, palette, lights }) => {
		const halfW = YARD.width / 2;
		const halfD = YARD.depth / 2;
		const hut = { x: halfW - 0.45, z: halfD - 0.4 };
		return (
			<group>
				{/* The gravel yard. */}
				<Box
					size={[YARD.width, 0.02, YARD.depth]}
					position={[0, 0.01, 0]}
					color={colors.ground}
					castShadow={false}
				/>

				{/* Transformers in a row, each a tank with fins, bushings and their insulators on top. */}
				{spread(p.transformerCount, YARD.width - 1.2).map((x) => (
					<group key={x} position={[x - 0.35, 0.02, 0.05]}>
						<Box
							size={[TANK.width, TANK.height, TANK.depth]}
							position={[0, TANK.height / 2, 0]}
							color={colors.transformers}
						/>

						{spread(5, TANK.width - 0.08).map((fin) => (
							<Box
								key={fin}
								size={[0.03, TANK.height * 0.8, 0.1]}
								position={[fin, TANK.height / 2, TANK.depth / 2 + 0.05]}
								color={colors.transformers}
								castShadow={false}
							/>
						))}

						{spread(3, TANK.width - 0.14).map((bushing) => (
							<group key={bushing}>
								<mesh position={[bushing, TANK.height + 0.09, -0.06]} castShadow>
									<cylinderGeometry args={[0.025, 0.035, 0.18, 8]} />

									<Mat color={colors.insulators} roughness={0.35} />
								</mesh>

								{/* A busbar up to the gantry. */}
								<Strut
									from={[bushing, TANK.height + 0.18, -0.06]}
									to={[bushing * 1.2, GANTRY.height - 0.25, GANTRY.z - 0.05]}
									color={colors.steel}
									thickness={0.012}
									castShadow={false}
								/>
							</group>
						))}
					</group>
				))}

				{/* The gantry: two lattice posts and a beam across, insulators hanging from it. */}
				{[-halfW + 0.35, halfW - 0.35].map((x) => (
					<group key={x}>
						{[
							[-0.06, -0.06],
							[0.06, 0.06],
						].map(([dx, dz]) => (
							<Strut
								key={dx}
								from={[x + dx, 0, GANTRY.z + dz]}
								to={[x + dx, GANTRY.height, GANTRY.z + dz]}
								color={colors.steel}
								thickness={0.04}
							/>
						))}
					</group>
				))}

				<Strut
					from={[-halfW + 0.3, GANTRY.height, GANTRY.z]}
					to={[halfW - 0.3, GANTRY.height, GANTRY.z]}
					color={colors.steel}
					thickness={0.05}
				/>

				{spread(5, YARD.width - 1).map((x) => (
					<Insulator
						key={x}
						position={[x, GANTRY.height - 0.24, GANTRY.z]}
						color={colors.insulators}
					/>
				))}

				{/* The control hut by the gate, its window lit after dark, a floodlight on its wall. */}
				<group position={[hut.x, 0, hut.z]}>
					<Box size={[0.6, 0.55, 0.45]} position={[0, 0.295, 0]} color={colors.hut} />

					<Box size={[0.66, 0.04, 0.5]} position={[0, 0.59, 0]} color={palette.trim} />

					<Box
						size={[0.18, 0.12, 0.02]}
						position={[-0.12, 0.36, 0.23]}
						color={palette.glass}
						castShadow={false}
						{...lightEmission(lights.yardLight, 0.8)}
					/>

					<Box
						size={[0.12, 0.28, 0.02]}
						position={[0.14, 0.16, 0.23]}
						color={palette.trim}
						castShadow={false}
					/>

					<Box
						size={[0.08, 0.05, 0.05]}
						position={[0, 0.5, 0.26]}
						color="#e8e9ee"
						castShadow={false}
						{...lightEmission(lights.yardLight, 2)}
					/>
				</group>

				<LightPool light={lights.yardLight} at={[hut.x - 0.5, hut.z - 0.4]} />

				{/* A tall fence round the yard, open at the gate in front of the hut. */}
				{p.showsFence &&
					[
						{ from: [-halfW, -halfD], to: [halfW, -halfD] },
						{ from: [halfW, -halfD], to: [halfW, halfD] },
						{ from: [-halfW, halfD], to: [-halfW, -halfD] },
						{ from: [-halfW, halfD], to: [hut.x - 0.55, halfD] },
					].map(({ from, to }) => {
						const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
						const posts = Math.max(2, Math.round(length / 0.6) + 1);
						return (
							<group key={`${from.join()}:${to.join()}`}>
								{Array.from({ length: posts }, (_, i) => i / (posts - 1)).map((t) => {
									const x = from[0] + (to[0] - from[0]) * t;
									const z = from[1] + (to[1] - from[1]) * t;
									return (
										<Strut
											key={t}
											from={[x, 0, z]}
											to={[x, 0.55, z]}
											color={colors.steel}
											thickness={0.025}
											castShadow={false}
										/>
									);
								})}

								{[0.05, 0.3, 0.55].map((y) => (
									<Strut
										key={y}
										from={[from[0], y, from[1]]}
										to={[to[0], y, to[1]]}
										color={colors.steel}
										thickness={0.012}
										castShadow={false}
									/>
								))}
							</group>
						);
					})}
			</group>
		);
	},
});
