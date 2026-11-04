import { z } from "zod";

import { Box, Mat } from "../primitives";
import { definePart } from "../types";

/**
 * A flagpole with its flag flying out to +X: a slim pole with a ball on top,
 * and a thin cloth, plain or with a Nordic cross (Sweden's, Denmark's,
 * Finland's in their colours). The cross is a hair proud of the cloth on both
 * sides, so it reads from either side without flickering.
 */

const FlagpoleSchema = z.object({
	height: z.number().min(0.4).max(8).default(2.2),
	flagWidth: z.number().min(0.2).max(3).default(0.7),
	design: z.enum(["plain", "nordicCross"]).default("nordicCross"),
});

/** How thick the cloth is, and how much prouder the cross stands. */
const CLOTH = 0.012;
const CROSS = CLOTH + 0.006;
/** A flag is 10 high for 16 across (Sweden's proportions). */
const FLAG_ASPECT = 10 / 16;

export const flagpole01 = definePart({
	kind: "flagpole_01",
	name: "Flagpole",
	category: "infrastructure",
	description:
		"A flagpole with a thin flag flying out to +X, plain or with a Nordic cross, in its colours",
	keywords: ["flag", "pole", "banner", "sweden", "nordic cross", "mast", "castle"],
	schema: FlagpoleSchema,
	fields: [
		{ key: "height", label: "Height", type: "number", min: 0.4, max: 8, step: 0.05 },
		{ key: "flagWidth", label: "Flag width", type: "number", min: 0.2, max: 3, step: 0.05 },
		{
			key: "design",
			label: "Design",
			type: "select",
			options: [
				{ value: "plain", label: "Plain" },
				{ value: "nordicCross", label: "Nordic cross" },
			],
		},
	],
	colors: [
		{ id: "flag", name: "Flag", default: "#2a5aa8", legacy: "color" },
		{ id: "cross", name: "Cross", default: "#f2c230", legacy: "accent" },
		{ id: "pole", name: "Pole", default: "#e9e6de" },
	],
	footprint: (p) => [p.flagWidth * 2 + 0.1, 0.12],
	// The flag flies out from the pole high up: only the pole stands on the ground.
	overhang: (p) => ({
		foot: [0.08, 0.08],
		from: p.height - p.flagWidth * FLAG_ASPECT - 0.05,
	}),
	height: (p) => p.height + 0.06,
	Component: ({ props: p, colors }) => {
		const width = p.flagWidth;
		const height = width * FLAG_ASPECT;
		// The flag's middle, its top edge just under the ball.
		const y = p.height - 0.04 - height / 2;
		const x = 0.03 + width / 2;
		return (
			<group>
				<mesh position={[0, p.height / 2, 0]} castShadow>
					<cylinderGeometry args={[0.022, 0.03, p.height, 8]} />

					<Mat color={colors.pole} />
				</mesh>

				<mesh position={[0, p.height + 0.02, 0]}>
					<sphereGeometry args={[0.04, 10, 8]} />

					<Mat color={colors.pole} />
				</mesh>

				<Box size={[width, height, CLOTH]} position={[x, y, 0]} color={colors.flag} />

				{p.design === "nordicCross" && (
					<>
						{/* The cross: its upright nearer the pole, its bar across the middle. */}
						<Box
							size={[width * 0.125, height, CROSS]}
							position={[0.03 + width * (5 / 16 + 1 / 16), y, 0]}
							color={colors.cross}
							castShadow={false}
						/>

						<Box
							size={[width, height * 0.2, CROSS]}
							position={[x, y, 0]}
							color={colors.cross}
							castShadow={false}
						/>
					</>
				)}
			</group>
		);
	},
});
