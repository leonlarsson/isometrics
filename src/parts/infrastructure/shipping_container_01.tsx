import { z } from "zod";

import { Box, spread } from "../primitives";
import { definePart } from "../types";

const ShippingContainerSchema = z.object({
	containerLength: z.enum(["20ft", "40ft"]).default("20ft"),
	stackHeight: z.number().int().min(1).max(5).default(1),
});

/** A container's size: as long as a truck carries, about 1.5 times true width and height. */
const LENGTHS = { "20ft": 1.6, "40ft": 3.1 };
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
		"Corrugated steel container, 20 or 40 foot, its doors at the +X end; stack up to five for a port or a yard",
	keywords: ["container", "cargo", "port", "harbour", "dock", "freight", "logistics", "box"],
	schema: ShippingContainerSchema,
	fields: [
		{
			key: "containerLength",
			label: "Length",
			type: "select",
			options: [
				{ value: "20ft", label: "20 foot" },
				{ value: "40ft", label: "40 foot" },
			],
		},
		{ key: "stackHeight", label: "Stacked", type: "number", min: 1, max: 5, step: 1 },
	],
	colors: [
		{ id: "container", name: "Container", default: "#c0462f", legacy: "color" },
		{ id: "corners", name: "Corners and door bars", default: "#7a2c1f", legacy: "accent" },
	],
	footprint: (p) => [LENGTHS[p.containerLength], WIDTH],
	height: (p) => p.stackHeight * HEIGHT,
	Component: ({ props: p, colors }) => (
		<group>
			{Array.from({ length: p.stackHeight }, (_, i) => i * HEIGHT).map((y) => (
				<Container
					key={y}
					length={LENGTHS[p.containerLength]}
					y={y}
					body={colors.container}
					trim={colors.corners}
				/>
			))}
		</group>
	),
});
