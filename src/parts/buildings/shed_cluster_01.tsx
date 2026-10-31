import { lightEmission } from "../lights";
import { jitter } from "../primitives";
import { definePart } from "../types";

import {
	builtBuildings,
	cachedClusterSlots,
	type IBuiltBuilding,
	SHED_CLUSTER,
} from "./clusterKit";
import { Block, Cone, Drum, isWindowLit, Prism, shadeOf, Tooth } from "./clusterPieces";
import { CLUSTER_FIELDS, ClusterSchema } from "./clusterProps";

/**
 * A building of the estate now: a shed with a sawtooth roof or a shallow
 * one (some with a chimney), or a pair of silos. The first is always a shed.
 */
const shedShape = (shed: IBuiltBuilding) => {
	const [roof, chimney, silos, tall] = shed.looks;
	const width = shed.width * shed.widthFactor;
	const depth = shed.depth * shed.widthFactor;
	const wallHeight = (0.55 + 0.3 * tall) * shed.heightFactor;
	const isSilos = shed.rank > 0 && silos > 0.7;
	const isSawtooth = roof < 0.5;
	const roofHeight = isSawtooth ? 0.24 * shed.heightFactor : Math.min(width, depth) * 0.14;
	const chimneyHeight = !isSilos && chimney > 0.6 ? wallHeight * 2.4 : 0;
	const siloHeight = (1.3 + 0.5 * tall) * shed.heightFactor;
	const height = isSilos
		? siloHeight + Math.min(width, depth / 2) * 0.35
		: Math.max(wallHeight + roofHeight, chimneyHeight);
	return {
		width,
		depth,
		wallHeight,
		roofHeight,
		isSawtooth,
		isSilos,
		chimneyHeight,
		siloHeight,
		height,
	};
};

export const shedCluster01 = definePart({
	kind: "shed_cluster_01",
	name: "Industrial cluster",
	category: "buildings",
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "The sheds' windows and roof lights, lit one after another as it gets dark.",
			shape: "windows",
			color: "#f0c27a",
			litPaneShare: 0.6,
			comesOn: "oneByOne",
			// Over the yards between the sheds.
			realLight: (p) => ({ at: [0, 1.4, 0], reach: p.width * 0.75 }),
		},
	],
	description:
		"An industrial estate of low sheds and warehouses, with a chimney or silo here and there, that grows with a number: more and bigger sheds as Built rises",
	keywords: [
		"cluster",
		"industrial",
		"estate",
		"factory",
		"warehouses",
		"sheds",
		"silo",
		"district",
		"grows",
		"data",
	],
	schema: ClusterSchema,
	fields: CLUSTER_FIELDS,
	colors: [
		// The roofs first: they're what's seen most from above, so they're the cluster's tint.
		{ id: "roofs", name: "Roofs", default: "#6f8fb0", legacy: "color" },
		{ id: "walls", name: "Walls", default: "#d6d0c2", legacy: "accent" },
		{ id: "silos", name: "Silos and chimneys", default: "#d9d4ca" },
		{ id: "doors", name: "Loading doors", default: "#4f5a66" },
	],
	footprint: (p) => [p.width, p.width],
	height: (p) =>
		Math.max(
			...builtBuildings(cachedClusterSlots(SHED_CLUSTER, p.width, p.seed), p.builtShare).map(
				(shed) => shedShape(shed).height,
			),
		),
	Component: ({ props: p, colors, palette, lights }) => {
		const sheds = builtBuildings(cachedClusterSlots(SHED_CLUSTER, p.width, p.seed), p.builtShare);
		const windows = lights.windows;
		const lit = (shed: IBuiltBuilding, index: number) =>
			isWindowLit(jitter(shed.rank * 17 + index * 5 + 2), windows.litPaneShare)
				? lightEmission(windows, 1.3)
				: {};
		return (
			<group>
				{sheds.map((shed) => {
					const s = shedShape(shed);
					const walls = shadeOf(colors.walls, (shed.looks[3] - 0.5) * 0.1);
					const roofs = shadeOf(colors.roofs, (shed.looks[3] - 0.5) * 0.18);
					if (s.isSilos) {
						// Two silos side by side along the depth, each with a cone of a roof.
						const radius = Math.min(s.width, s.depth / 2) * 0.46;
						return (
							<group key={shed.rank} position={[shed.x, 0, shed.z]} rotation={[0, shed.turn, 0]}>
								{[-1, 1].map((side) => (
									<group key={side} position={[0, 0, (side * s.depth) / 4]}>
										<Drum
											position={[0, s.siloHeight / 2, 0]}
											size={[radius * 2, s.siloHeight, radius * 2]}
											color={colors.silos}
										/>

										<Cone
											position={[0, s.siloHeight, 0]}
											size={[radius * 2.1, radius * 0.7, radius * 2.1]}
											color={colors.roofs}
										/>
									</group>
								))}
							</group>
						);
					}
					const teeth = Math.max(2, Math.round(s.depth / 0.55));
					const tooth = s.depth / teeth;
					return (
						<group key={shed.rank} position={[shed.x, 0, shed.z]} rotation={[0, shed.turn, 0]}>
							<Block
								position={[0, s.wallHeight / 2, 0]}
								size={[s.width, s.wallHeight, s.depth]}
								color={walls}
							/>

							{s.isSawtooth ? (
								Array.from({ length: teeth }, (_, i) => {
									const z = -s.depth / 2 + tooth * (i + 0.5);
									return (
										// biome-ignore lint/suspicious/noArrayIndexKey: teeth are positional
										<group key={i}>
											<Tooth
												position={[0, s.wallHeight, z]}
												size={[s.width, s.roofHeight, tooth]}
												color={roofs}
											/>

											{/* The tooth's glazing, on its upright face. */}

											<Block
												position={[0, s.wallHeight + s.roofHeight * 0.5, z + tooth / 2 + 0.006]}
												size={[s.width * 0.86, s.roofHeight * 0.6, 0.012]}
												color={palette.glass}
												castShadow={false}
												{...lit(shed, i + 2)}
											/>
										</group>
									);
								})
							) : (
								// A shallow roof, its ridge along the shed's length.
								<Prism
									position={[0, s.wallHeight, 0]}
									rotation={[0, Math.PI / 2, 0]}
									size={[s.depth + 0.08, s.roofHeight, s.width + 0.1]}
									color={roofs}
								/>
							)}

							{/* A loading door on the front, a strip of windows along each side. */}

							<Block
								position={[0, Math.min(0.42, s.wallHeight * 0.7) / 2, s.depth / 2 + 0.006]}
								size={[s.width * 0.42, Math.min(0.42, s.wallHeight * 0.7), 0.012]}
								color={colors.doors}
								castShadow={false}
							/>

							{[1, -1].map((side, i) => (
								<Block
									key={side}
									position={[(side * s.width) / 2 + side * 0.006, s.wallHeight * 0.68, 0]}
									size={[0.012, s.wallHeight * 0.18, s.depth * 0.7]}
									color={palette.glass}
									castShadow={false}
									{...lit(shed, i)}
								/>
							))}

							{s.chimneyHeight > 0 && (
								<Drum
									position={[s.width * 0.3, s.chimneyHeight / 2, -s.depth * 0.3]}
									size={[0.16, s.chimneyHeight, 0.16]}
									color={colors.silos}
								/>
							)}
						</group>
					);
				})}
			</group>
		);
	},
});
