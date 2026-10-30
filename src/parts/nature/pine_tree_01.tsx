import { Mat } from "../primitives";
import { definePart } from "../types";

import { sizedByScale } from "./sizedByScale";

export const pineTree01 = definePart({
	kind: "pine_tree_01",
	name: "Pine tree",
	category: "nature",
	description: "Conifer made of stacked cones",
	keywords: ["fir", "spruce", "forest", "plant", "nature"],
	...sizedByScale,
	colors: [
		{ id: "needles", name: "Needles", default: (p) => p.foliage, legacy: "color" },
		{ id: "trunk", name: "Trunk", default: (p) => p.trunk, legacy: "accent" },
	],
	footprint: () => [1, 1],
	height: () => 1.7,
	Component: ({ colors }) => (
		<group>
			<mesh position={[0, 0.2, 0]} castShadow>
				<cylinderGeometry args={[0.06, 0.08, 0.4, 8]} />

				<Mat color={colors.trunk} />
			</mesh>

			{[
				[0.5, 0.55, 0.62],
				[0.38, 0.5, 0.95],
				[0.26, 0.42, 1.27],
			].map(([radius, height, y]) => (
				<mesh key={y} position={[0, y, 0]} castShadow receiveShadow>
					<coneGeometry args={[radius, height, 8]} />

					<Mat color={colors.needles} flat />
				</mesh>
			))}
		</group>
	),
});
