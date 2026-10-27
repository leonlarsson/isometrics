import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const ParasolSchema = z.object({
	isOpen: z.boolean().default(true),
});

/** How tall it stands, and how wide it opens, in metres. */
const HEIGHT = 2.35;
const OPEN_WIDTH = 2.4;

export const parasol01 = definePart({
	kind: "parasol_01",
	name: "Parasol",
	category: "furniture",
	description: "Café parasol on a pole, open or folded",
	keywords: ["umbrella", "shade", "cafe", "terrace", "beach", "street furniture"],
	schema: ParasolSchema,
	fields: [{ key: "isOpen", label: "Open", type: "boolean" }],
	colors: [
		{ id: "canopy", name: "Canopy", default: "#c8553d", legacy: "color" },
		{ id: "pole", name: "Pole and base", default: "#5b5b5b", legacy: "accent" },
	],
	footprint: (p) =>
		p.isOpen ? [metres(OPEN_WIDTH), metres(OPEN_WIDTH)] : [metres(0.5), metres(0.5)],
	height: () => metres(HEIGHT),
	// Open, only its pole stands on the ground: tables and chairs go under the canopy.
	overhang: (p) =>
		p.isOpen
			? { foot: [metres(0.06), metres(0.06)], from: metres(HEIGHT - 0.5) }
			: { foot: [metres(0.5), metres(0.5)], from: 0 },
	Component: ({ props: p, colors }) => (
		// Drawn in metres.
		<group scale={UNITS_PER_METRE}>
			<mesh position={[0, 0.03, 0]} castShadow receiveShadow>
				<cylinderGeometry args={[0.22, 0.25, 0.06, 12]} />

				<Mat color={colors.pole} />
			</mesh>

			<mesh position={[0, HEIGHT / 2, 0]} castShadow>
				<cylinderGeometry args={[0.025, 0.025, HEIGHT, 6]} />

				<Mat color={colors.pole} />
			</mesh>

			{/* Eight panels, sloping down from the top: open, or folded down along the pole. */}
			{p.isOpen ? (
				<mesh position={[0, HEIGHT - 0.22, 0]} castShadow receiveShadow>
					<coneGeometry args={[OPEN_WIDTH / 2, 0.42, 8]} />

					<Mat color={colors.canopy} flat />
				</mesh>
			) : (
				<mesh position={[0, HEIGHT - 0.65, 0]} castShadow>
					<coneGeometry args={[0.14, 1.3, 8]} />

					<Mat color={colors.canopy} flat />
				</mesh>
			)}

			<mesh position={[0, HEIGHT + 0.02, 0]}>
				<sphereGeometry args={[0.04, 8, 6]} />

				<Mat color={colors.pole} />
			</mesh>
		</group>
	),
});
