import { Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

export const roundTree01 = definePart({
	kind: "round_tree_01",
	name: "Round tree",
	category: "nature",
	description: "Leafy tree",
	keywords: ["oak", "plant", "nature", "park"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	defaultColor: (p) => p.foliage,
	defaultAccent: (p) => p.trunk,
	colorLabel: "Leaves",
	accentLabel: "Trunk",
	footprint: (p) => [p.size, p.size],
	height: (p) => 1.45 * p.size,
	Component: ({ props: { size: s }, color, accent }) => (
		<group scale={s}>
			<mesh position={[0, 0.3, 0]} castShadow>
				<cylinderGeometry args={[0.07, 0.1, 0.6, 8]} />

				<Mat color={accent} />
			</mesh>

			<mesh position={[0, 0.95, 0]} castShadow receiveShadow>
				<icosahedronGeometry args={[0.48, 1]} />

				<Mat color={color} flat />
			</mesh>
		</group>
	),
});
