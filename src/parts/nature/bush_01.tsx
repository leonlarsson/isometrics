import { Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

/** Lumps of leaves, [x, y, z, radius]. */
const LUMPS = [
	[0, 0.2, 0, 0.22],
	[0.2, 0.15, 0.06, 0.17],
	[-0.17, 0.14, -0.07, 0.16],
	[0.02, 0.13, -0.2, 0.14],
] as const;

export const bush01 = definePart({
	kind: "bush_01",
	name: "Bush",
	category: "nature",
	description: "Low, round shrub",
	keywords: ["shrub", "hedge", "plant", "garden", "park", "nature"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	colors: [{ id: "leaves", name: "Leaves", default: (p) => p.foliage, legacy: "color" }],
	footprint: (p) => [0.65 * p.size, 0.6 * p.size],
	height: (p) => 0.42 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			{LUMPS.map(([x, y, z, radius]) => (
				<mesh key={`${x},${z}`} position={[x, y, z]} castShadow receiveShadow>
					<icosahedronGeometry args={[radius, 1]} />

					<Mat color={colors.leaves} flat />
				</mesh>
			))}
		</group>
	),
});
