import { jitter, Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

/** The stalks: where each grows in the clump, how tall, which way it leans, and whether it has a head. */
const STALKS = Array.from({ length: 16 }, (_, i) => {
	const angle = jitter(i + 7) * Math.PI * 2;
	const out = 0.03 + jitter(i + 50) * 0.18;
	return {
		x: Math.cos(angle) * out,
		z: Math.sin(angle) * out,
		height: 0.42 + jitter(i + 90) * 0.2,
		leanX: Math.sin(angle) * out * 0.6,
		leanZ: -Math.cos(angle) * out * 0.6,
		hasHead: i % 3 === 0,
	};
});

export const reeds01 = definePart({
	kind: "reeds_01",
	name: "Reeds",
	category: "nature",
	description: "A clump of tall reeds with brown seed heads, for the edge of a pond or river",
	keywords: ["bulrush", "cattail", "pond", "marsh", "river", "water", "plant", "nature"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	colors: [
		{ id: "stalks", name: "Stalks", default: "#6f9a48", legacy: "color" },
		{ id: "heads", name: "Seed heads", default: "#6b4a2e", legacy: "accent" },
	],
	footprint: (p) => [0.42 * p.size, 0.42 * p.size],
	height: (p) => 0.66 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			{STALKS.map(({ x, z, height, leanX, leanZ, hasHead }) => (
				<group key={`${x},${z}`} position={[x, 0, z]} rotation={[-leanZ, 0, leanX]}>
					<mesh position={[0, height / 2, 0]} castShadow>
						<cylinderGeometry args={[0.006, 0.01, height, 4]} />

						<Mat color={colors.stalks} flat />
					</mesh>

					{hasHead && (
						<mesh position={[0, height - 0.06, 0]} castShadow>
							<cylinderGeometry args={[0.018, 0.018, 0.09, 6]} />

							<Mat color={colors.heads} flat />
						</mesh>
					)}
				</group>
			))}
		</group>
	),
});
