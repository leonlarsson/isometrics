import { jitter, Mat } from "../primitives";
import { definePart } from "../types";

import { sizedByScale } from "./sizedByScale";

/** The pads: where each floats, how big, which way its notch points, and whether it has a flower. */
const PADS = Array.from({ length: 7 }, (_, i) => {
	const angle = (i / 7) * Math.PI * 2 + jitter(i) * 0.6;
	const out = i === 0 ? 0 : 0.12 + jitter(i + 30) * 0.12;
	return {
		x: Math.cos(angle) * out,
		z: Math.sin(angle) * out,
		radius: 0.05 + jitter(i + 60) * 0.035,
		notch: jitter(i + 70) * Math.PI * 2,
		hasFlower: i === 0 || i === 4,
	};
});

/** A pad is a disc with a slice cut out: this much of a turn is left. */
const PAD_ARC = Math.PI * 1.82;

export const waterLilies01 = definePart({
	kind: "water_lilies_01",
	name: "Water lilies",
	category: "nature",
	description: "Lily pads floating on a pond, two of them in flower; place it on water",
	keywords: ["lily pad", "pond", "lake", "water", "flower", "plant", "nature"],
	...sizedByScale,
	colors: [
		{ id: "pads", name: "Pads", default: "#4f8a3c", legacy: "color" },
		{ id: "flowers", name: "Flowers", default: "#f2c4d4", legacy: "accent" },
		{ id: "flowerHearts", name: "Flower hearts", default: "#f2d11c" },
	],
	footprint: () => [0.5, 0.5],
	height: () => 0.06,
	Component: ({ colors }) => (
		<group>
			{PADS.map(({ x, z, radius, notch, hasFlower }) => (
				<group key={`${x},${z}`} position={[x, 0.012, z]}>
					<mesh rotation={[0, notch, 0]} receiveShadow>
						<cylinderGeometry args={[radius, radius, 0.006, 14, 1, false, 0, PAD_ARC]} />

						<Mat color={colors.pads} />
					</mesh>

					{hasFlower && (
						<group position={[0, 0.012, 0]}>
							{/* Petals: two rings of pointed cones, the inner one standing up more. */}
							{[0, 1, 2, 3, 4, 5].map((petal) => (
								<mesh
									key={petal}
									rotation={[0, (petal / 6) * Math.PI * 2, Math.PI / 2.6]}
									position={[
										Math.cos((petal / 6) * Math.PI * 2) * 0.014,
										0.008,
										-Math.sin((petal / 6) * Math.PI * 2) * 0.014,
									]}
									castShadow
								>
									<coneGeometry args={[0.012, 0.045, 4]} />

									<Mat color={colors.flowers} flat />
								</mesh>
							))}

							<mesh position={[0, 0.012, 0]}>
								<sphereGeometry args={[0.012, 8, 6]} />

								<Mat color={colors.flowerHearts} />
							</mesh>
						</group>
					)}
				</group>
			))}
		</group>
	),
});
