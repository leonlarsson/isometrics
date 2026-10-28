import { z } from "zod";

import type { ISunPosition } from "#/scene/sun";

import { Box, Mat, spread } from "../primitives";
import { definePart } from "../types";

const SolarPanelsSchema = z.object({
	rowCount: z.number().int().min(1).max(10).default(3),
	panelsPerRow: z.number().int().min(1).max(24).default(6),
	tiltAngle: z.number().min(5).max(50).default(25),
	followsTheSun: z.boolean().default(false),
});

/**
 * A panel and a row's table of them: two panels up the slope, side by side
 * along X. Rows stand far enough apart not to shade each other much.
 */
const PANEL = { width: 0.3, length: 0.42, gap: 0.015, thickness: 0.025 };
const SLOPE = PANEL.length * 2 + PANEL.gap;
const ROW_SPACING = 1.25;

/** How high the table's low edge stands, and how far apart its legs are along the row. */
const LOW_EDGE = 0.18;
const LEG_SPACING = 0.95;

/**
 * Following the sun, the rows turn on a tube along their middle, at most this
 * far (degrees): steeper as the sun gets lower, lying flat at night. The tube
 * stands high enough for the table to clear the ground at its steepest.
 */
const TRACKER_MOST_TILT = 55;
const TRACKER_PIVOT = (SLOPE / 2) * Math.sin((TRACKER_MOST_TILT * Math.PI) / 180) + 0.08;

type TSolarPanelsProps = z.output<typeof SolarPanelsSchema>;

const rowWidth = (p: TSolarPanelsProps) => p.panelsPerRow * (PANEL.width + PANEL.gap);
/** How deep a row is from above: as deep as it's long while it follows the sun, which lays it flat at times. */
const rowDepth = (p: TSolarPanelsProps) =>
	p.followsTheSun ? SLOPE : SLOPE * Math.cos((p.tiltAngle * Math.PI) / 180);

/** How far the panels tilt (degrees) to face the sun at its height: flat while it's down. */
const tiltTowards = (sun: ISunPosition) =>
	sun.elevation <= 0 ? 0 : Math.min(TRACKER_MOST_TILT, Math.max(0, 90 - sun.elevation));

/**
 * One row: its table tilted up towards the back (−Z), facing the sun at the
 * front (+Z); fixed on legs, or, following the sun, turning on a tube.
 */
const PanelRow = ({
	p,
	tiltDegrees,
	z,
	panels,
	frame,
}: {
	p: TSolarPanelsProps;
	tiltDegrees: number;
	z: number;
	panels: string;
	frame: string;
}) => {
	const tilt = (tiltDegrees * Math.PI) / 180;
	const width = rowWidth(p);
	const depth = SLOPE * Math.cos(tilt);
	const rise = SLOPE * Math.sin(tilt);
	const pivot = p.followsTheSun ? TRACKER_PIVOT : LOW_EDGE + rise / 2;
	const legs = spread(Math.max(2, Math.round(width / LEG_SPACING) + 1), width - 0.1);
	return (
		<group position={[0, 0, z]}>
			{/* The table: tilted about its middle, its low edge at the front. */}
			<group position={[0, pivot, 0]} rotation={[tilt, 0, 0]}>
				{/* Rails under the panels, across the slope. */}
				{[-SLOPE / 4, SLOPE / 4].map((along) => (
					<Box
						key={along}
						size={[width, 0.025, 0.03]}
						position={[0, -PANEL.thickness / 2 - 0.0125, along]}
						color={frame}
						castShadow={false}
					/>
				))}

				{spread(p.panelsPerRow, width).flatMap((x) =>
					[-1, 1].map((half) => (
						<Box
							key={`${x},${half}`}
							size={[PANEL.width, PANEL.thickness, PANEL.length]}
							position={[x, 0, (half * (PANEL.length + PANEL.gap)) / 2]}
							color={panels}
							roughness={0.3}
						/>
					)),
				)}
			</group>

			{/* Following the sun: a post at each leg holding the tube the table turns on. */}
			{p.followsTheSun &&
				legs.map((x) => (
					<Box
						key={x}
						size={[0.04, pivot - 0.03, 0.04]}
						position={[x, (pivot - 0.03) / 2, 0]}
						color={frame}
					/>
				))}

			{p.followsTheSun && (
				<mesh position={[0, pivot - 0.035, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
					<cylinderGeometry args={[0.022, 0.022, width, 8]} />

					<Mat color={frame} />
				</mesh>
			)}

			{/* Fixed: legs, short at the front, tall at the back, under the rails. */}
			{!p.followsTheSun &&
				legs.flatMap((x) =>
					[1, -1].map((side) => {
						const height = LOW_EDGE + rise / 2 - (side * rise) / 4 - 0.03;
						return (
							<Box
								key={`${x},${side}`}
								size={[0.03, height, 0.03]}
								position={[x, height / 2, (side * depth) / 4]}
								color={frame}
							/>
						);
					}),
				)}
		</group>
	);
};

export const solarPanels01 = definePart({
	kind: "solar_panels_01",
	name: "Solar panels",
	category: "infrastructure",
	description:
		"Rows of solar panels tilted up towards the back, facing the sun at the front (+Z), for a solar farm or a yard; fixed on legs, or turning to follow the sun's height through the day",
	keywords: ["solar", "solar farm", "pv", "photovoltaic", "energy", "power", "renewable"],
	schema: SolarPanelsSchema,
	fields: [
		{ key: "rowCount", label: "Rows", type: "number", min: 1, max: 10, step: 1 },
		{ key: "panelsPerRow", label: "Panels per row", type: "number", min: 1, max: 24, step: 1 },
		{ key: "tiltAngle", label: "Fixed tilt (°)", type: "number", min: 5, max: 50, step: 1 },
		{ key: "followsTheSun", label: "Turn to follow the sun", type: "boolean" },
	],
	colors: [
		{ id: "panels", name: "Panels", default: "#1f2b48", legacy: "color" },
		{ id: "frame", name: "Frame", default: "#b4b9bf", legacy: "accent" },
	],
	footprint: (p) => [rowWidth(p) + 0.05, (p.rowCount - 1) * ROW_SPACING + rowDepth(p) + 0.05],
	height: (p) =>
		p.followsTheSun
			? TRACKER_PIVOT + (SLOPE / 2) * Math.sin((TRACKER_MOST_TILT * Math.PI) / 180) + 0.05
			: LOW_EDGE + SLOPE * Math.sin((p.tiltAngle * Math.PI) / 180) + 0.05,
	followsTheSun: (p) => p.followsTheSun,
	Component: ({ props: p, colors, sun }) => {
		// Without a sun to follow (a picture of the part), at its own tilt.
		const tiltDegrees = p.followsTheSun && sun ? tiltTowards(sun) : p.tiltAngle;
		return (
			<group>
				{spread(p.rowCount, p.rowCount * ROW_SPACING).map((z) => (
					<PanelRow
						key={z}
						p={p}
						tiltDegrees={tiltDegrees}
						z={z}
						panels={colors.panels}
						frame={colors.frame}
					/>
				))}
			</group>
		);
	},
});
