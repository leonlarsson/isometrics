import { z } from "zod";

import { LitWindows } from "../lights";
import { Box, spread } from "../primitives";
import { definePart } from "../types";

import { WindowGrid, windowColumns } from "./windowKit";

const FLOOR_HEIGHT = 0.7;
const PARAPET = 0.1;
/** How much of its cell each window fills, across and up. */
const PANE: [number, number] = [0.5, 0.55];

/** A balcony: how far it reaches out, how high its railing is, and how far apart its bars stand. */
const BALCONY = { depth: 0.32, railHeight: 0.26, barSpacing: 0.07, bar: 0.012 };

/** A balcony's door: from the floor up to where the windows' tops are. */
const DOOR_HEIGHT = FLOOR_HEIGHT * (0.5 + PANE[1] / 2) - 0.02;

/**
 * A balcony on a floor at the front: a glass door onto it from the floor up, a
 * thin slab, and a railing round its three open sides (posts, a top rail and bars).
 */
const Balcony = ({
	position,
	width,
	doorWidth,
	colors,
	glass,
}: {
	position: [number, number, number];
	width: number;
	doorWidth: number;
	colors: { trim: string; railings: string };
	glass: string;
}) => {
	const { depth, railHeight, bar } = BALCONY;
	const frontBars = spread(Math.max(3, Math.round(width / BALCONY.barSpacing)), width - bar);
	const sideBars = spread(Math.max(2, Math.round(depth / BALCONY.barSpacing)), depth).map(
		(z) => z + depth / 2,
	);
	return (
		<group position={position}>
			{/* The door: glass from the floor to the window heads, behind the lit panes like the windows. */}
			<Box
				size={[doorWidth, DOOR_HEIGHT, 0.01]}
				position={[0, 0.02 + DOOR_HEIGHT / 2, 0.002]}
				color={glass}
				castShadow={false}
			/>

			<Box size={[width, 0.035, depth]} position={[0, 0.0175, depth / 2]} color={colors.trim} />

			{/* The top rail along the front and both sides. */}
			<Box
				size={[width, 0.022, 0.03]}
				position={[0, railHeight, depth - 0.015]}
				color={colors.railings}
			/>

			{[width / 2 - 0.015, -width / 2 + 0.015].map((x) => (
				<group key={x}>
					<Box
						size={[0.03, 0.022, depth]}
						position={[x, railHeight, depth / 2]}
						color={colors.railings}
					/>

					<Box
						size={[0.025, railHeight, 0.025]}
						position={[x, railHeight / 2, depth - 0.015]}
						color={colors.railings}
					/>

					{sideBars.slice(0, -1).map((z) => (
						<Box
							key={z}
							size={[bar, railHeight, bar]}
							position={[x, railHeight / 2, z]}
							color={colors.railings}
							castShadow={false}
						/>
					))}
				</group>
			))}

			{frontBars.map((x) => (
				<Box
					key={x}
					size={[bar, railHeight, bar]}
					position={[x, railHeight / 2, depth - 0.015]}
					color={colors.railings}
					castShadow={false}
				/>
			))}
		</group>
	);
};

const ApartmentSchema = z.object({
	width: z.number().min(1.5).max(12).default(3.2),
	depth: z.number().min(1.2).max(8).default(2),
	floorCount: z.number().int().min(2).max(16).default(5),
	showBalconies: z.boolean().default(true),
});

export const apartmentBlock01 = definePart({
	kind: "apartment_block_01",
	name: "Apartment block",
	category: "buildings",
	description: "Block of flats with rows of windows and balconies; its front faces +Z",
	keywords: ["flats", "apartments", "housing", "residential", "tenement", "building"],
	schema: ApartmentSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1.5, max: 12, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1.2, max: 8, step: 0.1 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 2, max: 16, step: 1 },
		{ key: "showBalconies", label: "Show the balconies", type: "boolean" },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#d9c7b0", legacy: "color" },
		{ id: "trim", name: "Roof edge and balcony floors", default: "#f2efe8", legacy: "accent" },
		{ id: "door", name: "Door", default: "#4b5a6b" },
		{ id: "railings", name: "Balcony railings", default: "#3a3b3d" },
	],
	// Rooms lit one after another as it gets dark, and a few TV screens; keep the weights.
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "Lamps in the flats.",
			shape: "windows",
			color: "#f0b25c",
			litPanes: 0.45,
			weight: 8,
			comesOn: "oneByOne",
			realLight: (p) => ({ at: [0, 1, p.depth / 2 + 1.2], reach: p.width * 1.3 }),
		},
		{
			id: "screens",
			name: "TV screens",
			description: "Televisions on in the flats.",
			shape: "windows",
			color: "#9ec0ff",
			litPanes: 0.4,
			weight: 1,
			comesOn: "oneByOne",
		},
	],
	footprint: (p) => [p.width, p.depth + (p.showBalconies ? BALCONY.depth : 0)],
	height: (p) => p.floorCount * FLOOR_HEIGHT + PARAPET,
	Component: ({ props: p, colors, palette, lights }) => {
		const height = p.floorCount * FLOOR_HEIGHT;
		const columnsX = windowColumns(p.width, 0.65);
		const columnsZ = windowColumns(p.depth, 0.65);
		const cell = p.width / columnsX;
		return (
			<group>
				<Box size={[p.width, height, p.depth]} position={[0, height / 2, 0]} color={colors.walls} />

				<Box
					size={[p.width + 0.08, PARAPET, p.depth + 0.08]}
					position={[0, height + PARAPET / 2, 0]}
					color={colors.trim}
				/>

				<WindowGrid
					width={p.width}
					depth={p.depth}
					height={height}
					columnsX={columnsX}
					columnsZ={columnsZ}
					floors={p.floorCount}
					paneSize={PANE}
					color={palette.glass}
				/>

				<LitWindows
					lights={[lights.windows, lights.screens]}
					width={p.width}
					depth={p.depth}
					height={height}
					columnsX={columnsX}
					columnsZ={columnsZ}
					floors={p.floorCount}
					seed={p.floorCount * 11 + Math.round(p.width * 7)}
					paneSize={PANE}
				/>

				{/* The front door, in the middle of the ground floor. */}
				<Box
					size={[Math.min(0.45, cell * 0.7), FLOOR_HEIGHT * 0.8, 0.05]}
					position={[0, (FLOOR_HEIGHT * 0.8) / 2, p.depth / 2 + 0.03]}
					color={colors.door}
					castShadow={false}
				/>

				{/* A balcony at every other window on the floors above, at the front. */}
				{p.showBalconies &&
					spread(columnsX, p.width)
						.filter((_, i) => i % 2 === 0)
						.flatMap((x) =>
							Array.from({ length: p.floorCount - 1 }, (_, i) => (i + 1) * FLOOR_HEIGHT).map(
								(y) => (
									<Balcony
										key={`${x},${y}`}
										position={[x, y, p.depth / 2]}
										width={cell * 0.85}
										doorWidth={cell * PANE[0]}
										colors={colors}
										glass={palette.glass}
									/>
								),
							),
						)}
			</group>
		);
	},
});
