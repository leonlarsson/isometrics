import { Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

export const cypress01 = definePart({
	kind: "cypress_01",
	name: "Cypress",
	category: "nature",
	description: "Tall, narrow dark-green column, as in Mediterranean gardens",
	keywords: ["tree", "conifer", "italian", "garden", "plant", "nature"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	colors: [
		{ id: "leaves", name: "Leaves", default: "#3f6e47", legacy: "color" },
		{ id: "trunk", name: "Trunk", default: (p) => p.trunk, legacy: "accent" },
	],
	footprint: (p) => [0.6 * p.size, 0.6 * p.size],
	height: (p) => 1.9 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			<mesh position={[0, 0.1, 0]} castShadow>
				<cylinderGeometry args={[0.04, 0.05, 0.2, 8]} />

				<Mat color={colors.trunk} />
			</mesh>

			<mesh position={[0, 1.0, 0]} scale={[1, 3.2, 1]} castShadow receiveShadow>
				<icosahedronGeometry args={[0.28, 1]} />

				<Mat color={colors.leaves} flat />
			</mesh>
		</group>
	),
});
