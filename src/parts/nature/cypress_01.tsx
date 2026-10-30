import { Mat } from "../primitives";
import { definePart } from "../types";

import { sizedByScale } from "./sizedByScale";

export const cypress01 = definePart({
	kind: "cypress_01",
	name: "Cypress",
	category: "nature",
	description: "Tall, narrow dark-green column, as in Mediterranean gardens",
	keywords: ["tree", "conifer", "italian", "garden", "plant", "nature"],
	...sizedByScale,
	colors: [
		{ id: "leaves", name: "Leaves", default: "#3f6e47", legacy: "color" },
		{ id: "trunk", name: "Trunk", default: (p) => p.trunk, legacy: "accent" },
	],
	footprint: () => [0.6, 0.6],
	height: () => 1.9,
	Component: ({ colors }) => (
		<group>
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
