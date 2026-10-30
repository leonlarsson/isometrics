import { Mat } from "../primitives";
import { definePart } from "../types";

import { sizedByScale } from "./sizedByScale";

/** The crown: lumps of leaves around the top of the trunk, [x, y, z, radius]. */
const LUMPS = [
	[0, 1.02, 0, 0.45],
	[0.36, 0.86, 0.1, 0.33],
	[-0.32, 0.9, -0.14, 0.35],
	[0.06, 0.86, -0.38, 0.3],
	[-0.12, 0.8, 0.36, 0.3],
] as const;

export const roundTree02 = definePart({
	kind: "round_tree_02",
	name: "Round tree",
	category: "nature",
	description: "Broad leafy tree with a wide, lumpy crown",
	keywords: ["oak", "chestnut", "plane tree", "plant", "nature", "park"],
	...sizedByScale,
	colors: [
		{ id: "leaves", name: "Leaves", default: (p) => p.foliage, legacy: "color" },
		{ id: "trunk", name: "Trunk", default: (p) => p.trunk, legacy: "accent" },
	],
	footprint: () => [1.4, 1.4],
	height: () => 1.47,
	Component: ({ colors }) => (
		<group>
			<mesh position={[0, 0.35, 0]} castShadow>
				<cylinderGeometry args={[0.09, 0.12, 0.7, 8]} />

				<Mat color={colors.trunk} />
			</mesh>

			{LUMPS.map(([x, y, z, radius]) => (
				<mesh key={`${x},${z}`} position={[x, y, z]} castShadow receiveShadow>
					<icosahedronGeometry args={[radius, 1]} />

					<Mat color={colors.leaves} flat />
				</mesh>
			))}
		</group>
	),
});
