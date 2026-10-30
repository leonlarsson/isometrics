import { jitter, Mat } from "../primitives";
import { definePart } from "../types";

import { sizedByScale } from "./sizedByScale";

/** The blades: where each grows in the clump, how tall and which way it leans. */
const BLADES = Array.from({ length: 14 }, (_, i) => {
	const angle = jitter(i) * Math.PI * 2;
	const out = 0.05 + jitter(i + 40) * 0.2;
	return {
		x: Math.cos(angle) * out,
		z: Math.sin(angle) * out,
		height: 0.22 + jitter(i + 80) * 0.14,
		// Leaning outwards, more at the edge of the clump.
		leanX: Math.sin(angle) * out * 1.2,
		leanZ: -Math.cos(angle) * out * 1.2,
	};
});

export const tallGrass01 = definePart({
	kind: "tall_grass_01",
	name: "Tall grass",
	category: "nature",
	description: "Clump of tall grass blades",
	keywords: ["reeds", "meadow", "weeds", "wild", "plant", "nature"],
	...sizedByScale,
	colors: [{ id: "grass", name: "Grass", default: "#7fae4f", legacy: "color" }],
	footprint: () => [0.5, 0.5],
	height: () => 0.36,
	Component: ({ colors }) => (
		<group>
			{BLADES.map(({ x, z, height, leanX, leanZ }) => (
				<mesh
					key={`${x},${z}`}
					position={[x, height / 2, z]}
					rotation={[-leanZ, 0, leanX]}
					castShadow
				>
					<coneGeometry args={[0.022, height, 4]} />

					<Mat color={colors.grass} flat />
				</mesh>
			))}
		</group>
	),
});
