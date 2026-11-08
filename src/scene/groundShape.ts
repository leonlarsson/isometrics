import { roadCenterline } from "./roads";
import type { TGround, TVec2 } from "./schema";

/**
 * A ground's shape (ADR-0155): a rectangle (`points` null, as worlds always
 * were) or any outline of corners, with its corners rounded or not, round its
 * position (its own frame: x and z from its middle). Its width and depth stay
 * the size of the rectangle round it, centred on its middle. Where grounds
 * are in the world, and what's on them, is `scene/grounds`. No React, no three.
 */

/** The smallest and largest a ground can be along each side (GroundSchema's limits). */
export const GROUND_SIZE = { least: 4, most: 500 } as const;

const rounded = (value: number) => Math.round(value * 100) / 100;

/** The rectangle's corners, round from the back left (−x, −z). */
export const rectangleCorners = (width: number, depth: number): TVec2[] => {
	const x = width / 2;
	const z = depth / 2;
	return [
		[-x, -z],
		[x, -z],
		[x, z],
		[-x, z],
	];
};

/** Its corners as they stand: its points, or the rectangle's. */
export const groundCornersOf = (ground: Pick<TGround, "width" | "depth" | "points">): TVec2[] =>
	ground.points ?? rectangleCorners(ground.width, ground.depth);

/** Whether it's drawn as it always was: the plain rectangle, its edge softly rounded. */
export const isPlainGround = (ground: Pick<TGround, "points" | "cornerRadius">) =>
	ground.points === null && ground.cornerRadius <= 0;

/** The width and depth round corners: twice the farthest along each axis, as the ground is centred. */
export const sizeAround = (points: readonly TVec2[]) => {
	let x = 0;
	let z = 0;
	for (const point of points) {
		x = Math.max(x, Math.abs(point[0]));
		z = Math.max(z, Math.abs(point[1]));
	}
	const size = (half: number) =>
		Math.min(GROUND_SIZE.most, Math.max(GROUND_SIZE.least, rounded(half * 2)));
	return { width: size(x), depth: size(z) };
};

/** Corners kept within the largest ground. */
const withinGround = (point: TVec2): TVec2 => {
	const half = GROUND_SIZE.most / 2;
	return [
		rounded(Math.min(half, Math.max(-half, point[0]))),
		rounded(Math.min(half, Math.max(-half, point[1]))),
	];
};

/** A ground with these corners: its points, and its width and depth round them. */
export const withCorners = (points: readonly TVec2[]) => {
	const kept = points.map(withinGround);
	return { points: kept, ...sizeAround(kept) };
};

/** A ground resized: the rectangle's sides, or its shape stretched to fill the new size. */
export const resized = (
	ground: Pick<TGround, "width" | "depth" | "points">,
	width: number,
	depth: number,
) => {
	const size = (value: number) =>
		Math.min(GROUND_SIZE.most, Math.max(GROUND_SIZE.least, rounded(value)));
	const next = { width: size(width), depth: size(depth) };
	if (!ground.points) {
		return { ...next, points: null };
	}
	const sx = next.width / ground.width;
	const sz = next.depth / ground.depth;
	return {
		...next,
		points: ground.points.map(([x, z]): TVec2 => [rounded(x * sx), rounded(z * sz)]),
	};
};

/**
 * Its outline as drawn, round it in order, its corners rounded by `cornerRadius`
 * (each by less where its sides are short, as a road's corners); null for the
 * plain rectangle, which is drawn as it always was.
 */
export const groundOutlineOf = (
	ground: Pick<TGround, "width" | "depth" | "points" | "cornerRadius">,
): TVec2[] | null => {
	if (isPlainGround(ground)) {
		return null;
	}
	const corners = groundCornersOf(ground);
	if (ground.cornerRadius <= 0) {
		return corners;
	}
	return roadCenterline(corners, true, ground.cornerRadius).map(([x, z]): TVec2 => [x, z]);
};

/** The id of a shape the ground can be given in one click. */
export type TGroundShapeId =
	| "rectangle"
	| "roundedRectangle"
	| "circle"
	| "halfCircle"
	| "hexagon"
	| "octagon"
	| "lShape"
	| "island";

/** How many corners a circle's outline has: round at any size, few enough to edit. */
const CIRCLE_CORNERS = 32;

/** Corners round an ellipse filling width × depth, from the back (−z), clockwise seen from above. */
const ellipse = (width: number, depth: number, count: number, turn = 0): TVec2[] =>
	Array.from({ length: count }, (_, i): TVec2 => {
		const angle = turn + (i / count) * Math.PI * 2;
		return [rounded((Math.sin(angle) * width) / 2), rounded((-Math.cos(angle) * depth) / 2)];
	});

/** A wobbly round island, the same every time (no randomness: worlds are shared). */
const island = (width: number, depth: number): TVec2[] =>
	Array.from({ length: 24 }, (_, i): TVec2 => {
		const angle = (i / 24) * Math.PI * 2;
		const wobble = 0.86 + 0.09 * Math.sin(angle * 3 + 0.6) + 0.05 * Math.cos(angle * 5 + 1.3);
		return [
			rounded((Math.sin(angle) * width * wobble) / 2),
			rounded((-Math.cos(angle) * depth * wobble) / 2),
		];
	});

/** The ground's shapes, each made to fill its width × depth: what Shape offers in one click. */
export const GROUND_SHAPES: readonly {
	id: TGroundShapeId;
	name: string;
	make: (width: number, depth: number) => Pick<TGround, "points" | "cornerRadius">;
}[] = [
	{ id: "rectangle", name: "Rectangle", make: () => ({ points: null, cornerRadius: 0 }) },
	{
		id: "roundedRectangle",
		name: "Rounded",
		make: (width, depth) => ({
			points: null,
			cornerRadius: rounded(Math.min(width, depth) * 0.2),
		}),
	},
	{
		id: "circle",
		name: "Circle",
		make: (width, depth) => ({ points: ellipse(width, depth, CIRCLE_CORNERS), cornerRadius: 0 }),
	},
	{
		id: "halfCircle",
		name: "Half circle",
		// Its flat side at the front (+z), its round side filling the depth behind.
		make: (width, depth) => ({
			points: [
				...Array.from({ length: CIRCLE_CORNERS / 2 + 1 }, (_, i): TVec2 => {
					const angle = -Math.PI / 2 + (i / (CIRCLE_CORNERS / 2)) * Math.PI;
					return [
						rounded((Math.sin(angle) * width) / 2),
						rounded(depth / 2 - Math.cos(angle) * depth),
					];
				}),
			],
			cornerRadius: 0,
		}),
	},
	{
		id: "hexagon",
		name: "Hexagon",
		make: (width, depth) => ({ points: ellipse(width, depth, 6, Math.PI / 6), cornerRadius: 0 }),
	},
	{
		id: "octagon",
		name: "Octagon",
		make: (width, depth) => ({ points: ellipse(width, depth, 8, Math.PI / 8), cornerRadius: 0 }),
	},
	{
		id: "lShape",
		name: "L shape",
		make: (width, depth) => {
			const x = width / 2;
			const z = depth / 2;
			return {
				points: [
					[-x, -z],
					[rounded(-x + width * 0.45), -z],
					[rounded(-x + width * 0.45), rounded(z - depth * 0.45)],
					[x, rounded(z - depth * 0.45)],
					[x, z],
					[-x, z],
				],
				cornerRadius: 0,
			};
		},
	},
	{
		id: "island",
		name: "Island",
		make: (width, depth) => ({ points: island(width, depth), cornerRadius: 0 }),
	},
];
