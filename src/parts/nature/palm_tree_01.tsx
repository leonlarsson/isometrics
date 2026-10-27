import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { TreeSizeSchema, treeSizeFields } from "./treeSize";

/** The trunk: segments stacked up a gentle curve, each [x, y, lean]. */
const SEGMENTS = [0, 1, 2, 3, 4].map((i) => ({
	x: 0.012 * i * i,
	y: 0.16 + i * 0.3,
	lean: -0.025 * i,
}));

/** Where the trunk ends and the fronds start. */
const TOP = { x: 0.012 * 25, y: 1.6 };

/** Which way each frond points, all round. */
const FRONDS = Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2);

/** Coconuts, in its own colour. */
const COCONUT = "#6b4a2c";

export const palmTree01 = definePart({
	kind: "palm_tree_01",
	name: "Palm tree",
	category: "nature",
	description: "Tall palm with a curved trunk and drooping fronds",
	keywords: ["tree", "coconut", "beach", "tropical", "plant", "nature"],
	schema: TreeSizeSchema,
	fields: treeSizeFields,
	colors: [
		{ id: "fronds", name: "Fronds", default: "#4f9a4a", legacy: "color" },
		{ id: "trunk", name: "Trunk", default: "#9b7b55", legacy: "accent" },
	],
	footprint: (p) => [1.3 * p.size, 1.3 * p.size],
	height: (p) => 1.75 * p.size,
	Component: ({ props: { size: s }, colors }) => (
		<group scale={s}>
			{SEGMENTS.map(({ x, y, lean }) => (
				<mesh key={y} position={[x, y, 0]} rotation={[0, 0, lean]} castShadow>
					<cylinderGeometry args={[0.06, 0.075, 0.32, 7]} />

					<Mat color={colors.trunk} flat />
				</mesh>
			))}

			<group position={[TOP.x, TOP.y, 0]}>
				{/* Fronds all round, each drooping from the top. */}
				{FRONDS.map((turn) => (
					<group key={turn} rotation={[0, turn, 0]}>
						<Box
							size={[0.7, 0.02, 0.16]}
							position={[0.32, -0.1, 0]}
							rotation={[0, 0, -0.38]}
							color={colors.fronds}
						/>
					</group>
				))}

				{[0, 2.1, 4.2].map((angle) => (
					<mesh key={angle} position={[Math.cos(angle) * 0.08, -0.08, Math.sin(angle) * 0.08]}>
						<sphereGeometry args={[0.05, 8, 6]} />

						<Mat color={COCONUT} />
					</mesh>
				))}
			</group>
		</group>
	),
});
