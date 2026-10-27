import { z } from "zod";

import { jitter, Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const FlowerPotSchema = z.object({
	showFlowers: z.boolean().default(true),
});

/** Soil, under the plant. */
const SOIL = "#5a4030";

/** The flowers: where on the plant each sits (around it, angle and height). */
const FLOWERS = Array.from({ length: 9 }, (_, i) => ({
	angle: (i / 9) * Math.PI * 2 + jitter(i) * 0.5,
	up: 0.1 + jitter(i + 20) * 0.75,
}));

/** The plant's middle and size, in metres. */
const PLANT = { y: 0.62, radius: 0.26, squash: 0.8 };

export const flowerPot01 = definePart({
	kind: "flower_pot_01",
	name: "Flower pot",
	category: "furniture",
	description: "Terracotta pot with a flowering plant",
	keywords: ["plant", "flowers", "planter", "garden", "street furniture"],
	schema: FlowerPotSchema,
	fields: [{ key: "showFlowers", label: "Show the flowers", type: "boolean" }],
	colors: [
		{ id: "pot", name: "Pot", default: "#c46a3f", legacy: "color" },
		{ id: "flowers", name: "Flowers", default: "#e9578a", legacy: "accent" },
		{ id: "leaves", name: "Leaves", default: "#4e8a3e" },
	],
	footprint: () => [metres(0.55), metres(0.55)],
	height: () => metres(0.88),
	Component: ({ props: p, colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<mesh position={[0, 0.21, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.25, 0.18, 0.42, 12]} />

				<Mat color={colors.pot} />
			</mesh>

			<mesh position={[0, 0.42, 0]} castShadow>
				<cylinderGeometry args={[0.27, 0.27, 0.05, 12]} />

				<Mat color={colors.pot} />
			</mesh>

			<mesh position={[0, 0.44, 0]}>
				<cylinderGeometry args={[0.23, 0.23, 0.02, 12]} />

				<Mat color={SOIL} />
			</mesh>

			<mesh position={[0, PLANT.y, 0]} scale={[1, PLANT.squash, 1]} castShadow>
				<icosahedronGeometry args={[PLANT.radius, 1]} />

				<Mat color={colors.leaves} flat />
			</mesh>

			{/* Flowers dotted over the upper half of the plant. */}
			{p.showFlowers &&
				FLOWERS.map(({ angle, up }) => {
					const across = Math.sqrt(1 - up * up) * PLANT.radius;
					return (
						<mesh
							key={angle}
							position={[
								Math.cos(angle) * across,
								PLANT.y + up * PLANT.radius * PLANT.squash,
								Math.sin(angle) * across,
							]}
						>
							<icosahedronGeometry args={[0.05, 0]} />

							<Mat color={colors.flowers} flat />
						</mesh>
					);
				})}
		</group>
	),
});
