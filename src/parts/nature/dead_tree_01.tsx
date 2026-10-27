import { Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

/** Its bare branches: where each leaves the trunk, which way it points and how far it leans out. */
const BRANCHES = [
	{ y: 0.5, turn: 0.3, lean: 0.9, length: 0.42 },
	{ y: 0.62, turn: 2.4, lean: 0.8, length: 0.38 },
	{ y: 0.76, turn: 4.3, lean: 0.7, length: 0.34 },
	{ y: 0.86, turn: 1.3, lean: 0.55, length: 0.28 },
];

export const deadTree01 = definePart({
	kind: "dead_tree_01",
	name: "Dead tree",
	category: "nature",
	description: "Bare tree without leaves, for winter or a spooky corner",
	keywords: ["bare", "winter", "leafless", "spooky", "plant", "nature"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	colors: [{ id: "wood", name: "Wood", default: "#7a6a5c", legacy: "color" }],
	footprint: (p) => [0.8 * p.size, 0.8 * p.size],
	height: (p) => 1.2 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			<mesh position={[0, 0.5, 0]} castShadow>
				<cylinderGeometry args={[0.04, 0.09, 1, 7]} />

				<Mat color={colors.wood} flat />
			</mesh>

			{BRANCHES.map(({ y, turn, lean, length }) => (
				// Turned to its side, then leaned out from the trunk, growing from its foot.
				<group key={turn} position={[0, y, 0]} rotation={[0, turn, 0]}>
					<group rotation={[0, 0, -lean]}>
						<mesh position={[0, length / 2, 0]} castShadow>
							<cylinderGeometry args={[0.015, 0.03, length, 6]} />

							<Mat color={colors.wood} flat />
						</mesh>
					</group>
				</group>
			))}
		</group>
	),
});
