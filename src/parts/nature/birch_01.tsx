import { Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

/** The dark marks on its bark, by height. */
const MARKS = [0.18, 0.34, 0.52, 0.7];
const MARK_COLOR = "#3b3836";

export const birch01 = definePart({
	kind: "birch_01",
	name: "Birch",
	category: "nature",
	description: "Slender tree with a white trunk and light leaves",
	keywords: ["tree", "silver birch", "plant", "nature", "park", "forest"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	colors: [
		{ id: "leaves", name: "Leaves", default: "#9bc76b", legacy: "color" },
		{ id: "trunk", name: "Trunk", default: "#ece8df", legacy: "accent" },
	],
	footprint: (p) => [0.7 * p.size, 0.7 * p.size],
	height: (p) => 1.66 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			<mesh position={[0, 0.55, 0]} castShadow>
				<cylinderGeometry args={[0.04, 0.055, 1.1, 8]} />

				<Mat color={colors.trunk} />
			</mesh>

			{MARKS.map((y) => (
				<mesh key={y} position={[0, y, 0]}>
					<cylinderGeometry args={[0.052, 0.052, 0.025, 8]} />

					<Mat color={MARK_COLOR} />
				</mesh>
			))}

			{/* A tall crown, and a smaller one lower down on one side. */}
			<mesh position={[0, 1.18, 0]} scale={[1, 1.5, 1]} castShadow receiveShadow>
				<icosahedronGeometry args={[0.32, 1]} />

				<Mat color={colors.leaves} flat />
			</mesh>

			<mesh position={[0.16, 0.86, 0.06]} scale={[1, 1.3, 1]} castShadow receiveShadow>
				<icosahedronGeometry args={[0.2, 1]} />

				<Mat color={colors.leaves} flat />
			</mesh>
		</group>
	),
});
