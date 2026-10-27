import { jitter, Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

/** The crown's middle and size. */
const CROWN = { y: 0.75, radius: 0.38 };

/** The fruit: where on the crown each hangs (around it, angle and height). */
const FRUIT = Array.from({ length: 11 }, (_, i) => ({
	angle: (i / 11) * Math.PI * 2 + jitter(i + 3) * 0.6,
	up: -0.5 + jitter(i + 31) * 1.1,
}));

export const fruitTree01 = definePart({
	kind: "fruit_tree_01",
	name: "Fruit tree",
	category: "nature",
	description: "Small round tree hung with fruit",
	keywords: ["apple", "orange", "cherry", "orchard", "garden", "plant", "nature"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	colors: [
		{ id: "leaves", name: "Leaves", default: "#6fae5c", legacy: "color" },
		{ id: "fruit", name: "Fruit", default: "#d9412e", legacy: "accent" },
		{ id: "trunk", name: "Trunk", default: (p) => p.trunk },
	],
	footprint: (p) => [0.8 * p.size, 0.8 * p.size],
	height: (p) => 1.15 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			<mesh position={[0, 0.25, 0]} castShadow>
				<cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />

				<Mat color={colors.trunk} />
			</mesh>

			<mesh position={[0, CROWN.y, 0]} castShadow receiveShadow>
				<icosahedronGeometry args={[CROWN.radius, 1]} />

				<Mat color={colors.leaves} flat />
			</mesh>

			{FRUIT.map(({ angle, up }) => {
				const across = Math.sqrt(1 - up * up) * CROWN.radius;
				return (
					<mesh
						key={angle}
						position={[
							Math.cos(angle) * across,
							CROWN.y + up * CROWN.radius,
							Math.sin(angle) * across,
						]}
					>
						<sphereGeometry args={[0.045, 8, 6]} />

						<Mat color={colors.fruit} />
					</mesh>
				);
			})}
		</group>
	),
});
