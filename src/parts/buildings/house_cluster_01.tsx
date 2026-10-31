import { lightEmission } from "../lights";
import { jitter } from "../primitives";
import { definePart } from "../types";

import {
	builtBuildings,
	cachedClusterSlots,
	HOUSE_CLUSTER,
	type IBuiltBuilding,
} from "./clusterKit";
import { Block, isWindowLit, Prism, shadeOf } from "./clusterPieces";
import { CLUSTER_FIELDS, ClusterSchema } from "./clusterProps";

/** A house's walls and roof at its size now: one storey or two, its roof as steep as its look says. */
const houseShape = (house: IBuiltBuilding) => {
	const [storeys, ridge, chimney] = house.looks;
	const width = house.width * house.widthFactor;
	const depth = house.depth * house.widthFactor;
	const wallHeight = (storeys > 0.7 ? 0.95 : 0.6) * house.heightFactor;
	// The ridge along the longer side mostly, now and then the other way.
	const ridgeAlongX = width >= depth !== ridge > 0.8;
	const span = ridgeAlongX ? depth : width;
	const roofHeight = span * (0.42 + 0.1 * chimney) * (0.6 + 0.4 * house.heightFactor);
	return { width, depth, wallHeight, roofHeight, ridgeAlongX };
};

const tallestOf = (houses: IBuiltBuilding[]) =>
	Math.max(
		...houses.map((house) => {
			const { wallHeight, roofHeight } = houseShape(house);
			return wallHeight + roofHeight;
		}),
	);

export const houseCluster01 = definePart({
	kind: "house_cluster_01",
	name: "House cluster",
	category: "buildings",
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "The houses' windows, lit one after another as it gets dark.",
			shape: "windows",
			litPaneShare: 0.7,
			comesOn: "oneByOne",
			// Over the middle of the village, lighting the lanes between the houses.
			realLight: (p) => ({ at: [0, 1.6, 0], reach: p.width * 0.75 }),
		},
	],
	description:
		"A village of small pitched-roof houses that grows with a number: more and taller houses as Built rises",
	keywords: [
		"cluster",
		"village",
		"suburb",
		"neighbourhood",
		"town",
		"houses",
		"settlement",
		"district",
		"grows",
		"data",
	],
	schema: ClusterSchema,
	fields: CLUSTER_FIELDS,
	colors: [
		// The roofs first: they're what's seen most from above, so they're the cluster's tint.
		{ id: "roofs", name: "Roofs", default: "#c25b40", legacy: "color" },
		{ id: "walls", name: "Walls", default: "#ecd5b4", legacy: "accent" },
		{ id: "doors", name: "Doors", default: "#5e4233" },
	],
	footprint: (p) => [p.width, p.width],
	height: (p) =>
		tallestOf(builtBuildings(cachedClusterSlots(HOUSE_CLUSTER, p.width, p.seed), p.builtShare)),
	Component: ({ props: p, colors, palette, lights }) => {
		const houses = builtBuildings(cachedClusterSlots(HOUSE_CLUSTER, p.width, p.seed), p.builtShare);
		const windows = lights.windows;
		return (
			<group>
				{houses.map((house) => {
					const { width, depth, wallHeight, roofHeight, ridgeAlongX } = houseShape(house);
					const [, , chimney, tone] = house.looks;
					const doorHeight = Math.min(0.42, wallHeight * 0.7);
					const pane = Math.min(0.24, wallHeight * 0.4);
					// A window on the front and one on each side, each lit in its own turn.
					const panes: { at: [number, number, number]; turn: number; score: number }[] = [
						{
							at: [-width * 0.22, wallHeight * 0.55, depth / 2 + 0.006],
							turn: 0,
							score: jitter(house.rank * 5 + 1),
						},
						{
							at: [width / 2 + 0.006, wallHeight * 0.55, 0],
							turn: Math.PI / 2,
							score: jitter(house.rank * 5 + 2),
						},
						{
							at: [-width / 2 - 0.006, wallHeight * 0.55, 0],
							turn: Math.PI / 2,
							score: jitter(house.rank * 5 + 3),
						},
					];
					return (
						<group key={house.rank} position={[house.x, 0, house.z]} rotation={[0, house.turn, 0]}>
							<Block
								position={[0, wallHeight / 2, 0]}
								size={[width, wallHeight, depth]}
								color={shadeOf(colors.walls, (tone - 0.5) * 0.1)}
							/>

							<Prism
								position={[0, wallHeight, 0]}
								size={
									ridgeAlongX
										? [width + 0.08, roofHeight, depth + 0.12]
										: [depth + 0.08, roofHeight, width + 0.12]
								}
								rotation={ridgeAlongX ? undefined : [0, Math.PI / 2, 0]}
								color={shadeOf(colors.roofs, (house.looks[1] - 0.5) * 0.2)}
							/>

							<Block
								position={[width * 0.2, doorHeight / 2, depth / 2 + 0.006]}
								size={[Math.min(0.2, width * 0.25), doorHeight, 0.012]}
								color={colors.doors}
								castShadow={false}
							/>

							{panes.map(({ at, turn, score }) => (
								<Block
									key={`${at[0]},${at[2]}`}
									position={at}
									rotation={[0, turn, 0]}
									size={[pane, pane * 0.9, 0.012]}
									color={palette.glass}
									castShadow={false}
									{...(isWindowLit(score, windows.litPaneShare) ? lightEmission(windows, 1.4) : {})}
								/>
							))}

							{chimney > 0.5 && (
								<Block
									// Off the ridge on a slope, standing up from the roof.
									position={
										ridgeAlongX
											? [width * 0.25, wallHeight + roofHeight * 0.72, -depth * 0.15]
											: [-width * 0.15, wallHeight + roofHeight * 0.72, depth * 0.25]
									}
									size={[0.11, roofHeight * 0.65, 0.11]}
									color={palette.trim}
								/>
							)}
						</group>
					);
				})}
			</group>
		);
	},
});
