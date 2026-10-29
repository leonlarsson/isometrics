import { Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeRenamedProps, treeSizeFields } from "./treeSize";

/** Its tiers, bottom to top: radius, height and where each sits. */
const TIERS = [
	[0.36, 0.42, 0.55],
	[0.31, 0.4, 0.82],
	[0.26, 0.38, 1.08],
	[0.2, 0.34, 1.33],
	[0.14, 0.32, 1.56],
	[0.08, 0.26, 1.77],
] as const;

export const pineTree02 = definePart({
	kind: "pine_tree_02",
	name: "Pine tree",
	category: "nature",
	description: "Tall, slim spruce of many narrow tiers",
	keywords: ["spruce", "fir", "conifer", "christmas tree", "forest", "plant", "nature"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	renamedProps: treeRenamedProps,
	colors: [
		{ id: "needles", name: "Needles", default: (p) => p.foliage, legacy: "color" },
		{ id: "trunk", name: "Trunk", default: (p) => p.trunk, legacy: "accent" },
	],
	footprint: (p) => [0.75 * p.size, 0.75 * p.size],
	height: (p) => 1.9 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			<mesh position={[0, 0.2, 0]} castShadow>
				<cylinderGeometry args={[0.045, 0.06, 0.4, 8]} />

				<Mat color={colors.trunk} />
			</mesh>

			{TIERS.map(([radius, height, y], i) => (
				// Each tier turned a little from the one below, so the edges don't line up.
				<mesh key={y} position={[0, y, 0]} rotation={[0, i * 0.4, 0]} castShadow receiveShadow>
					<coneGeometry args={[radius, height, 7]} />

					<Mat color={colors.needles} flat />
				</mesh>
			))}
		</group>
	),
});
