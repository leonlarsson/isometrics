import { z } from "zod";

import { LightPool, lightEmission } from "../lights";
import { Box, Mat, spread } from "../primitives";
import { definePart } from "../types";

const FloodlightSchema = z.object({
	height: z.number().min(1.5).max(10).default(4),
	aimAngle: z.number().min(10).max(85).default(60),
});

/** A bright, cold white, unless it's set. */
const FLOODLIGHT = "#f6f4ee";

/** The lamps on the frame at the top: columns and rows. */
const LAMPS = { columns: 3, rows: 2, size: 0.16 };

/** How far the bracket at the top reaches forward, to the frame's hinge. */
const BRACKET = 0.16;

/** The frame round the lamps, and how far in front of the lamps its real light shines from. */
const FRAME = {
	width: LAMPS.columns * (LAMPS.size + 0.04),
	height: LAMPS.rows * (LAMPS.size + 0.04),
};
const LIGHT_OUT = 0.25;

/**
 * Where its real light shines from: a little in front of the middle of the lamps, along the
 * way they face (the frame tilted by its aim on its pin), so it lights what's ahead, not the
 * frame's own back.
 */
const lampsFront = (p: { height: number; aimAngle: number }): [number, number, number] => {
	const aim = (p.aimAngle * Math.PI) / 180;
	// The lamps' middle on the frame, before tilting: up from the pin, and on the frame's face.
	const up = (FRAME.height + 0.06) / 2;
	const out = 0.08 + LIGHT_OUT;
	return [
		0,
		p.height + 0.02 + up * Math.cos(aim) - out * Math.sin(aim),
		BRACKET + up * Math.sin(aim) + out * Math.cos(aim),
	];
};

/** At most this far in front of the mast its light lands, however high it's aimed. */
const FURTHEST = 12;

/** How far in front of the mast its light lands, from its height and how far below level it's aimed. */
const aimedAt = (p: { height: number; aimAngle: number }) =>
	Math.min(FURTHEST, p.height / Math.tan((p.aimAngle * Math.PI) / 180));

export const floodlight01 = definePart({
	kind: "floodlight_01",
	name: "Floodlight mast",
	category: "infrastructure",
	description:
		"Tall mast with a bank of floodlights aimed ahead (+Z) and down, for pitches, yards and ports",
	keywords: ["light", "stadium", "pitch", "sports", "port", "yard", "floodlight"],
	schema: FloodlightSchema,
	fields: [
		{ key: "height", label: "Height", type: "number", min: 1.5, max: 10, step: 0.1 },
		{ key: "aimAngle", label: "Aim, below level (°)", type: "number", min: 10, max: 85, step: 1 },
	],
	colors: [
		{ id: "mast", name: "Mast", default: "#9a9a96", legacy: "color" },
		{ id: "frame", name: "Lamp frame", default: "#4a4c4f", legacy: "accent" },
	],
	lights: [
		{
			id: "floodlights",
			name: "Floodlights",
			shape: "pool",
			color: FLOODLIGHT,
			reach: 3.2,
			realLight: (p) => ({ at: lampsFront(p) }),
		},
	],
	// Round the mast and as far forward as the frame can swing.
	footprint: () => [0.7, 1.3],
	height: (p) => p.height + 0.5,
	Component: ({ props: p, colors, lights }) => {
		const { width: frameWidth, height: frameHeight } = FRAME;
		return (
			<group>
				<mesh position={[0, p.height / 2, 0]} castShadow>
					<cylinderGeometry args={[0.05, 0.09, p.height, 8]} />

					<Mat color={colors.mast} />
				</mesh>

				{/* A cap on the mast, and a bracket reaching forward from it. */}
				<mesh position={[0, p.height + 0.02, 0]} castShadow>
					<cylinderGeometry args={[0.065, 0.065, 0.04, 8]} />

					<Mat color={colors.frame} />
				</mesh>

				<Box
					size={[0.05, 0.05, BRACKET]}
					position={[0, p.height + 0.02, BRACKET / 2]}
					color={colors.frame}
				/>

				{/* The frame of lamps stands on a pin at the bracket's end by its bottom edge, and tilts
				forward from there: facing level ahead at 0°, lying flat facing straight down at 90°.
				It leans out over the bracket, away from the mast, at any aim. */}
				<group position={[0, p.height + 0.02, BRACKET]}>
					<mesh rotation={[0, 0, Math.PI / 2]} castShadow>
						<cylinderGeometry args={[0.02, 0.02, frameWidth + 0.1, 6]} />

						<Mat color={colors.frame} />
					</mesh>

					<group rotation={[(p.aimAngle * Math.PI) / 180, 0, 0]}>
						<Box
							size={[frameWidth + 0.06, frameHeight + 0.06, 0.06]}
							position={[0, (frameHeight + 0.06) / 2, 0.03]}
							color={colors.frame}
						/>

						{spread(LAMPS.columns, frameWidth).flatMap((x) =>
							spread(LAMPS.rows, frameHeight).map((y) => (
								<Box
									key={`${x},${y}`}
									size={[LAMPS.size, LAMPS.size, 0.02]}
									position={[x, y + (frameHeight + 0.06) / 2, 0.07]}
									color={lights.floodlights.color}
									castShadow={false}
									{...lightEmission(lights.floodlights, 2.5)}
								/>
							)),
						)}
					</group>
				</group>

				<LightPool light={lights.floodlights} at={[0, aimedAt(p)]} />
			</group>
		);
	},
});
