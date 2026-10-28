import { z } from "zod";

import { Box, spread } from "../primitives";
import { definePart } from "../types";

/**
 * The usual sizes, as long as the world draws them (in grid units, like every
 * part: the miniature isn't true to scale, so no real units): proportioned
 * like the real 10, 20, 40 and 45 foot containers, the standard one as long as
 * a truck carries.
 */
const PRESET_LENGTHS = [
	{ label: "Small", value: 0.8 },
	{ label: "Standard", value: 1.6 },
	{ label: "Long", value: 3.1 },
	{ label: "Extra long", value: 3.5 },
];

const ShippingContainerSchema = z.object({
	length: z.number().min(0.4).max(6).default(1.6),
	stackHeight: z.number().int().min(1).max(5).default(1),
});

/** Its width and height: a little over true scale, like the vehicles it stands next to. */
const WIDTH = 0.66;
const HEIGHT = 0.7;

/** The ribs of its corrugated walls, and the corner posts and rails round its edges. */
const RIB = { spacing: 0.1, depth: 0.012, width: 0.035 };
const EDGE = 0.04;

/** One container, its long sides along X and its doors at the +X end. */
const Container = ({
	length,
	y,
	body,
	trim,
}: {
	length: number;
	y: number;
	body: string;
	trim: string;
}) => {
	const ribs = spread(Math.round((length - 2 * EDGE) / RIB.spacing), length - 2 * EDGE - RIB.width);
	const ends = spread(5, WIDTH - 2 * EDGE - RIB.width);
	return (
		<group position={[0, y, 0]}>
			<Box
				size={[length - 0.02, HEIGHT - 0.02, WIDTH - 0.02]}
				position={[0, HEIGHT / 2, 0]}
				color={body}
			/>

			{/* Ribs on both long sides, the closed end and the roof's edges. */}
			{[1, -1].map((side) =>
				ribs.map((x) => (
					<Box
						key={`${side},${x}`}
						size={[RIB.width, HEIGHT - 2 * EDGE, RIB.depth]}
						position={[x, HEIGHT / 2, side * (WIDTH / 2 - 0.01 + RIB.depth / 2)]}
						color={body}
						castShadow={false}
					/>
				)),
			)}

			{ends.map((z) => (
				<Box
					key={z}
					size={[RIB.depth, HEIGHT - 2 * EDGE, RIB.width]}
					position={[-length / 2 + 0.01 - RIB.depth / 2, HEIGHT / 2, z]}
					color={body}
					castShadow={false}
				/>
			))}

			{/* Corner posts, and the rails along the top and bottom. */}
			{[1, -1].flatMap((sx) =>
				[1, -1].map((sz) => (
					<Box
						key={`post${sx},${sz}`}
						size={[EDGE, HEIGHT, EDGE]}
						position={[(sx * (length - EDGE)) / 2, HEIGHT / 2, (sz * (WIDTH - EDGE)) / 2]}
						color={trim}
					/>
				)),
			)}

			{[EDGE / 2, HEIGHT - EDGE / 2].flatMap((height) =>
				[1, -1].map((sz) => (
					<Box
						key={`rail${height},${sz}`}
						size={[length, EDGE, EDGE]}
						position={[0, height, (sz * (WIDTH - EDGE)) / 2]}
						color={trim}
						castShadow={false}
					/>
				)),
			)}

			{/* The doors at +X: two leaves with their locking bars. */}
			{[1, -1].map((side) => (
				<group key={side} position={[length / 2 + 0.002, HEIGHT / 2, (side * WIDTH) / 4]}>
					<Box
						size={[0.01, HEIGHT - 2 * EDGE, WIDTH / 2 - 0.03]}
						position={[0, 0, 0]}
						color={body}
						castShadow={false}
					/>

					{[-0.07, 0.07].map((z) => (
						<Box
							key={z}
							size={[0.012, HEIGHT - 2 * EDGE - 0.02, 0.012]}
							position={[0.01, 0, z]}
							color={trim}
							castShadow={false}
						/>
					))}
				</group>
			))}
		</group>
	);
};

export const shippingContainer01 = definePart({
	kind: "shipping_container_01",
	name: "Shipping container",
	category: "infrastructure",
	description:
		"Corrugated steel container, its doors at the +X end, any length (the usual ones: small, standard, long and extra long, like 10, 20, 40 and 45 foot containers); stack up to five for a port or a yard",
	keywords: ["container", "cargo", "port", "harbour", "dock", "freight", "logistics", "box"],
	schema: ShippingContainerSchema,
	fields: [
		{
			key: "length",
			label: "Length",
			type: "number",
			min: 0.4,
			max: 6,
			step: 0.05,
			presets: PRESET_LENGTHS,
		},
		{ key: "stackHeight", label: "Stacked", type: "number", min: 1, max: 5, step: 1 },
	],
	colors: [
		{ id: "container", name: "Container", default: "#c0462f", legacy: "color" },
		{ id: "corners", name: "Corners and door bars", default: "#7a2c1f", legacy: "accent" },
	],
	removedProps: ["containerLength"],
	footprint: (p) => [p.length, WIDTH],
	height: (p) => p.stackHeight * HEIGHT,
	Component: ({ props: p, colors }) => (
		<group>
			{Array.from({ length: p.stackHeight }, (_, i) => i * HEIGHT).map((y) => (
				<Container key={y} length={p.length} y={y} body={colors.container} trim={colors.corners} />
			))}
		</group>
	),
});
