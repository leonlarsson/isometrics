import { lightEmission } from "../lights";
import { jitter } from "../primitives";
import { definePart } from "../types";

import {
	builtBuildings,
	cachedClusterSlots,
	type IBuiltBuilding,
	TOWER_CLUSTER,
} from "./clusterKit";
import { Block, isWindowLit, shadeOf } from "./clusterPieces";
import { CLUSTER_FIELDS, ClusterSchema } from "./clusterProps";

/** One floor's height, in grid units: towers in a cluster are a little smaller than the office tower. */
const FLOOR_HEIGHT = 0.3;
/** The most floors a tower has, so the tallest stay a handful of draws' worth of windows. */
const MOST_FLOORS = 14;
const ROOF_CAP = 0.05;

/**
 * A tower's height now and its shape: tallest in the middle of the cluster,
 * lower towards the edge; some step in near the top.
 */
const towerShape = (tower: IBuiltBuilding) => {
	const [tall, stepped, roofBox] = tower.looks;
	const width = tower.width * tower.widthFactor;
	const depth = tower.depth * tower.widthFactor;
	const fullFloors = (2 + 11 * (1 - tower.outness) ** 1.4) * (0.7 + 0.55 * tall);
	const height = Math.max(
		FLOOR_HEIGHT * 1.5,
		Math.min(MOST_FLOORS, fullFloors) * FLOOR_HEIGHT * tower.heightFactor,
	);
	// Stepped towers narrow for their top third, once they're tall enough to.
	const stepAt =
		stepped > 0.55 && height > FLOOR_HEIGHT * 5
			? Math.round((height * 0.68) / FLOOR_HEIGHT) * FLOOR_HEIGHT
			: null;
	return { width, depth, height, stepAt, hasRoofBox: roofBox > 0.5 };
};

const tallestOf = (towers: IBuiltBuilding[]) =>
	Math.max(...towers.map((tower) => towerShape(tower).height + ROOF_CAP + 0.15));

export const towerCluster01 = definePart({
	kind: "tower_cluster_01",
	name: "Tower cluster",
	category: "buildings",
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "The towers' floors, lit one after another as it gets dark.",
			shape: "windows",
			color: "#e8b267",
			litPaneShare: 0.5,
			comesOn: "oneByOne",
			// Above the streets in the middle of the block.
			realLight: (p) => ({ at: [0, 2.2, 0], reach: p.width * 0.8 }),
		},
	],
	description:
		"A downtown of boxy towers that grows with a number: more and taller towers as Built rises, the tallest in the middle",
	keywords: [
		"cluster",
		"city block",
		"downtown",
		"city",
		"skyline",
		"towers",
		"high-rise",
		"district",
		"grows",
		"data",
	],
	schema: ClusterSchema,
	fields: CLUSTER_FIELDS,
	colors: [
		{ id: "facades", name: "Facades", default: "#7d9cc4", legacy: "color" },
		{ id: "roofs", name: "Roofs", default: "#dfe3ea", legacy: "accent" },
	],
	footprint: (p) => [p.width, p.width],
	height: (p) =>
		tallestOf(builtBuildings(cachedClusterSlots(TOWER_CLUSTER, p.width, p.seed), p.builtShare)),
	Component: ({ props: p, colors, palette, lights }) => {
		const towers = builtBuildings(cachedClusterSlots(TOWER_CLUSTER, p.width, p.seed), p.builtShare);
		const windows = lights.windows;
		return (
			<group>
				{towers.map((tower) => {
					const { width, depth, height, stepAt, hasRoofBox } = towerShape(tower);
					const facade = shadeOf(colors.facades, (tower.looks[3] - 0.5) * 0.2);
					// The top part: the whole tower, or the narrower top of a stepped one.
					const top =
						stepAt === null ? null : { width: width * 0.68, depth: depth * 0.68, from: stepAt };
					const floors = Math.floor(height / FLOOR_HEIGHT);
					const sections = [
						{ from: 0, to: top?.from ?? height, width, depth },
						...(top ? [{ from: top.from, to: height, width: top.width, depth: top.depth }] : []),
					];
					return (
						<group key={tower.rank} position={[tower.x, 0, tower.z]} rotation={[0, tower.turn, 0]}>
							<Block
								position={[0, (top?.from ?? height) / 2, 0]}
								size={[width, top?.from ?? height, depth]}
								color={facade}
							/>

							{top && (
								<>
									<Block
										position={[0, top.from + ROOF_CAP / 2, 0]}
										size={[width + 0.04, ROOF_CAP, depth + 0.04]}
										color={colors.roofs}
									/>

									<Block
										position={[0, (top.from + height) / 2, 0]}
										size={[top.width, height - top.from, top.depth]}
										color={facade}
									/>
								</>
							)}

							{/* A band of windows round each floor, lit floor by floor in each tower's own order. */}

							{Array.from({ length: floors }, (_, floor) => {
								const y = (floor + 0.55) * FLOOR_HEIGHT;
								const inTop = top !== null && y > top.from;
								const across = inTop ? top.width : width;
								const along = inTop ? top.depth : depth;
								const lit = isWindowLit(
									jitter(tower.rank * 31 + floor * 7 + 3),
									windows.litPaneShare,
								);
								return (
									<Block
										// biome-ignore lint/suspicious/noArrayIndexKey: floors are positional
										key={floor}
										position={[0, y, 0]}
										size={[across + 0.016, FLOOR_HEIGHT * 0.36, along + 0.016]}
										color={palette.glass}
										castShadow={false}
										{...(lit ? lightEmission(windows, 1.3) : {})}
									/>
								);
							})}

							{/* Piers up each face, proud of the bands, dividing them into three windows a side. */}

							{sections.flatMap((section) =>
								[-1, 1].flatMap((side) => [
									<Block
										key={`x${section.from},${side}`}
										position={[(side * section.width) / 6, (section.from + section.to) / 2, 0]}
										size={[0.05, section.to - section.from, section.depth + 0.03]}
										color={facade}
										castShadow={false}
									/>,
									<Block
										key={`z${section.from},${side}`}
										position={[0, (section.from + section.to) / 2, (side * section.depth) / 6]}
										size={[section.width + 0.03, section.to - section.from, 0.05]}
										color={facade}
										castShadow={false}
									/>,
								]),
							)}

							<Block
								position={[0, height + ROOF_CAP / 2, 0]}
								size={[(top?.width ?? width) + 0.04, ROOF_CAP, (top?.depth ?? depth) + 0.04]}
								color={colors.roofs}
							/>

							{hasRoofBox && (
								<Block
									position={[0, height + ROOF_CAP + 0.07, 0]}
									size={[(top?.width ?? width) * 0.4, 0.14, (top?.depth ?? depth) * 0.35]}
									color={colors.roofs}
								/>
							)}
						</group>
					);
				})}
			</group>
		);
	},
});
