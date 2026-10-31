import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { jitter } from "../primitives";
import { definePart } from "../types";

import {
	builtBuildings,
	cachedClusterSlots,
	type IBuiltBuilding,
	TENT_CLUSTER,
} from "./clusterKit";
import { Block, Cone, isWindowLit, Prism, Pyramid, shadeOf } from "./clusterPieces";
import { CLUSTER_FIELDS, ClusterSchema } from "./clusterProps";

const TentClusterSchema = ClusterSchema.extend({
	showsCampfire: z.boolean().default(true),
});

/** A tent now: a pyramid tent or a ridge tent, as tall as its look and the share say. */
const tentShape = (tent: IBuiltBuilding) => {
	const [pyramid, tall] = tent.looks;
	const width = tent.width * tent.widthFactor;
	const depth = tent.depth * tent.widthFactor;
	const isPyramid = pyramid < 0.45;
	const height = (isPyramid ? 0.62 + 0.2 * tall : 0.46 + 0.14 * tall) * tent.heightFactor;
	return { width: isPyramid ? Math.min(width, depth) : width, depth, height, isPyramid };
};

/** The stones round the fire, in a ring. */
const STONES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

export const tentCluster01 = definePart({
	kind: "tent_cluster_01",
	name: "Camp cluster",
	category: "buildings",
	lights: [
		{
			id: "lanterns",
			name: "Lanterns",
			description:
				"Lanterns in the tents, glowing through their doors one after another as it gets dark.",
			shape: "windows",
			color: "#ffc670",
			litPaneShare: 0.75,
			comesOn: "oneByOne",
		},
		{
			id: "campfire",
			name: "Campfire",
			description: "The fire in the middle of the camp and its glow on the ground.",
			shape: "pool",
			color: "#ff8a3d",
			reach: 1.5,
			// Just above the fire, lighting the tents round it.
			realLight: (p) => ({ at: [0, 0.45, 0], reach: p.width * 0.6 }),
		},
	],
	description:
		"A camp of tents round a campfire that grows with a number: more and bigger tents as Built rises",
	keywords: [
		"cluster",
		"camp",
		"camping",
		"campsite",
		"tents",
		"festival",
		"campfire",
		"settlement",
		"grows",
		"data",
	],
	schema: TentClusterSchema,
	fields: [
		...CLUSTER_FIELDS,
		{ key: "showsCampfire", label: "Show the campfire", type: "boolean" },
	],
	colors: [
		{ id: "canvas", name: "Canvas", default: "#e3a04a", legacy: "color" },
		{ id: "flaps", name: "Door flaps", default: "#7a4a26", legacy: "accent" },
		{ id: "stones", name: "Fire ring stones", default: "#9b958b" },
	],
	footprint: (p) => [p.width, p.width],
	height: (p) =>
		Math.max(
			...builtBuildings(cachedClusterSlots(TENT_CLUSTER, p.width, p.seed), p.builtShare).map(
				(tent) => tentShape(tent).height,
			),
		),
	Component: ({ props: p, colors, palette, lights }) => {
		const tents = builtBuildings(cachedClusterSlots(TENT_CLUSTER, p.width, p.seed), p.builtShare);
		const { lanterns, campfire } = lights;
		// The fire shrinks with a small camp's clearing.
		const fire = Math.min(1, p.width / 6);
		return (
			<group>
				{tents.map((tent) => {
					const { width, depth, height, isPyramid } = tentShape(tent);
					const canvas = shadeOf(colors.canvas, (tent.looks[3] - 0.5) * 0.2);
					const glow = isWindowLit(jitter(tent.rank * 11 + 4), lanterns.litPaneShare)
						? lightEmission(lanterns, 1.5)
						: {};
					// A pyramid tent's door lies on its sloping front face, leaning back with it.
					const lean = Math.atan2(depth / 2, height);
					const slope = Math.hypot(depth / 2, height);
					return (
						<group key={tent.rank} position={[tent.x, 0, tent.z]} rotation={[0, tent.turn, 0]}>
							{isPyramid ? (
								<>
									<Pyramid position={[0, 0, 0]} size={[width, height, depth]} color={canvas} />

									<Prism
										position={[0, 0, depth / 2 + 0.006]}
										rotation={[-lean, Math.PI / 2, 0]}
										size={[0.01, slope * 0.55, width * 0.36]}
										color={colors.flaps}
										castShadow={false}
										{...glow}
									/>
								</>
							) : (
								<>
									<Prism position={[0, 0, 0]} size={[width, height, depth]} color={canvas} />

									{/* The door in the ridge tent's front end. */}

									<Prism
										position={[width / 2 + 0.006, 0, 0]}
										size={[0.01, height * 0.72, depth * 0.38]}
										color={colors.flaps}
										castShadow={false}
										{...glow}
									/>
								</>
							)}
						</group>
					);
				})}

				{p.showsCampfire && (
					<group scale={fire}>
						{STONES.map((angle) => (
							<Block
								key={angle}
								position={[Math.cos(angle) * 0.2, 0.03, Math.sin(angle) * 0.2]}
								rotation={[0, angle, 0]}
								size={[0.07, 0.06, 0.09]}
								color={colors.stones}
								castShadow={false}
							/>
						))}

						{[0, Math.PI / 3, (2 * Math.PI) / 3].map((angle) => (
							<Block
								key={angle}
								position={[0, 0.035, 0]}
								rotation={[0, angle, 0]}
								size={[0.26, 0.045, 0.045]}
								color={palette.trunk}
								castShadow={false}
							/>
						))}

						{/* The flames, glowing after dark. */}

						<Cone
							position={[0, 0.05, 0]}
							size={[0.16, 0.26, 0.16]}
							color={campfire.color}
							castShadow={false}
							{...lightEmission(campfire, 1.6)}
						/>

						<Cone
							position={[0.05, 0.05, 0.03]}
							size={[0.09, 0.16, 0.09]}
							color={shadeOf(campfire.color, 0.4)}
							castShadow={false}
							{...lightEmission(campfire, 2)}
						/>
					</group>
				)}

				{p.showsCampfire && <LightPool light={campfire} />}
			</group>
		);
	},
});
