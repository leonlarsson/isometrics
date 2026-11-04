import { round } from "#/lib/math";
import type { TVec2 } from "#/scene/schema";

/**
 * Lays a city's blocks (the Stockholm template's Norrmalm, Kungsholmen and
 * Södermalm): a grid of street blocks turned as the city's streets run, of
 * sizes that vary column by column and row by row, with narrow streets between
 * them. Each block is fitted to what's there: where a shore, a road, a park or
 * a landmark cuts into it, it keeps the largest part that's clear, so blocks
 * follow the waterfronts and the roads. Then each block is built round its
 * edge: rows of houses along every street front, edge to edge, a courtyard
 * inside. Plain geometry, no parts: the template turns rows into objects.
 */

export interface IBlockGrid {
	/** The middle of the block at column 0, row 0; the others are laid from it. */
	origin: TVec2;
	/** The grid's turn in degrees about the vertical, as an object's: its x runs along (cos, −sin). */
	turn: number;
	/** The blocks' widths along the grid's x, column by column, and depths along its z, repeating. */
	widths: readonly number[];
	depths: readonly number[];
	/** The street between two blocks. */
	street: number;
	/** Which blocks to try, counted from the origin's, along the grid's x and z (both ends in). */
	columns: readonly [number, number];
	rows: readonly [number, number];
}

export interface ILaidBlock {
	centre: TVec2;
	turn: number;
	size: TVec2;
}

/** A point given along a turned frame's x and z, in the world. */
export const inFrame = ([cx, cz]: TVec2, turn: number) => {
	const angle = (turn * Math.PI) / 180;
	const [c, s] = [Math.cos(angle), Math.sin(angle)];
	return ([x, z]: TVec2): TVec2 => [round(cx + x * c + z * s, 2), round(cz - x * s + z * c, 2)];
};

/** A rectangle's corners, turned about its middle as an object would be. */
export const turnedRect = (centre: TVec2, turn: number, width: number, depth: number): TVec2[] =>
	(
		[
			[-width / 2, -depth / 2],
			[width / 2, -depth / 2],
			[width / 2, depth / 2],
			[-width / 2, depth / 2],
		] as TVec2[]
	).map(inFrame(centre, turn));

/** Where each of a run of blocks is along one axis: [middle, size] by index, index 0 centred on 0. */
const spansOf = (
	sizes: readonly number[],
	street: number,
	[from, to]: readonly [number, number],
) => {
	const sizeAt = (i: number) => sizes[((i % sizes.length) + sizes.length) % sizes.length];
	const spans = new Map<number, [number, number]>([[0, [0, sizeAt(0)]]]);
	let edge = sizeAt(0) / 2;
	for (let i = 1; i <= to; i++) {
		spans.set(i, [edge + street + sizeAt(i) / 2, sizeAt(i)]);
		edge += street + sizeAt(i);
	}
	edge = -sizeAt(0) / 2;
	for (let i = -1; i >= from; i--) {
		spans.set(i, [edge - street - sizeAt(i) / 2, sizeAt(i)]);
		edge -= street + sizeAt(i);
	}
	return [...spans]
		.filter(([i]) => i >= from && i <= to)
		.sort(([a], [b]) => a - b)
		.map(([, span]) => span);
};

/**
 * The largest part of a block whose every point fits, as a block of its own, or none smaller
 * than `least`: points every `step` or closer are tested, and the part is a rectangle of them.
 */
const fitted = (
	block: ILaidBlock,
	fits: (point: TVec2) => boolean,
	step: number,
	least: TVec2,
): ILaidBlock | null => {
	const at = inFrame(block.centre, block.turn);
	const [width, depth] = block.size;
	const countX = Math.ceil(width / step);
	const countZ = Math.ceil(depth / step);
	const [stepX, stepZ] = [width / countX, depth / countZ];
	const local = (i: number, k: number): TVec2 => [-width / 2 + i * stepX, -depth / 2 + k * stepZ];
	// How many points in a row fit, up to and including each, column by column.
	const heights = new Array<number>(countX + 1).fill(0);
	let best: { area: number; from: TVec2; to: TVec2 } | null = null;
	for (let k = 0; k <= countZ; k++) {
		for (let i = 0; i <= countX; i++) {
			heights[i] = fits(at(local(i, k))) ? heights[i] + 1 : 0;
		}
		for (let i = 0; i <= countX; i++) {
			let lowest = Number.POSITIVE_INFINITY;
			for (let j = i; j <= countX && heights[j] > 0; j++) {
				lowest = Math.min(lowest, heights[j]);
				const size: TVec2 = [(j - i) * stepX, (lowest - 1) * stepZ];
				const area = size[0] * size[1];
				if (
					size[0] >= least[0] - 1e-6 &&
					size[1] >= least[1] - 1e-6 &&
					(!best || area > best.area + 1e-6)
				) {
					best = { area, from: local(i, k - lowest + 1), to: local(j, k) };
				}
			}
		}
	}
	if (!best) {
		return null;
	}
	return {
		centre: at([(best.from[0] + best.to[0]) / 2, (best.from[1] + best.to[1]) / 2]),
		turn: block.turn,
		size: [round(best.to[0] - best.from[0], 2), round(best.to[1] - best.from[1], 2)],
	};
};

export const layBlocks = (
	grid: IBlockGrid,
	/** Whether a point may be built on. */
	fits: (point: TVec2) => boolean,
	{ step = 0.55, least = [2.4, 2.4] }: { step?: number; least?: TVec2 } = {},
): ILaidBlock[] => {
	const at = inFrame(grid.origin, grid.turn);
	return spansOf(grid.depths, grid.street, grid.rows).flatMap(([z, depth]) =>
		spansOf(grid.widths, grid.street, grid.columns).flatMap(([x, width]) => {
			const block = fitted(
				{ centre: at([x, z]), turn: grid.turn, size: [width, depth] },
				fits,
				step,
				least,
			);
			return block ? [block] : [];
		}),
	);
};

export interface IBlockRow {
	/** The row's middle, its turn (its fronts face the street, as a row of houses faces +z) and size. */
	position: TVec2;
	turn: number;
	houseCount: number;
	houseWidth: number;
	depth: number;
	/** Which of the block's sides it's on, and its place along that side. */
	side: "south" | "north" | "east" | "west";
	index: number;
}

/**
 * The rows of houses round a block, edge to edge along each street front: the long rows along
 * its south and north sides, the east and west between them, a courtyard inside (or two rows
 * back to back where the block's too shallow). Each side is cut into rows of a few houses
 * (`housesInRow` says how many, for the n-th row), each house about `houseWidth` wide, so the
 * houses fill the side exactly.
 */
export const rowsAround = (
	block: ILaidBlock,
	{
		rowDepth,
		houseWidth,
		housesInRow,
	}: { rowDepth: number; houseWidth: number; housesInRow: (n: number) => number },
): IBlockRow[] => {
	const [width, depth] = block.size;
	const at = inFrame(block.centre, block.turn);
	// Back to back where the block is too shallow (or narrow) for a courtyard.
	const deep = Math.min(rowDepth, depth / 2 - 0.02, width / 2 - 0.02);
	let n = 0;
	const side = (
		name: IBlockRow["side"],
		length: number,
		middle: TVec2,
		along: TVec2,
		turn: number,
	): IBlockRow[] => {
		const total = Math.max(1, Math.round(length / houseWidth));
		const wide = length / total;
		const rows: IBlockRow[] = [];
		let done = 0;
		while (done < total) {
			const count = Math.max(1, Math.min(total - done, housesInRow(n++)));
			const offset = -length / 2 + (done + count / 2) * wide;
			rows.push({
				position: at([middle[0] + along[0] * offset, middle[1] + along[1] * offset]),
				turn: block.turn + turn,
				houseCount: count,
				houseWidth: round(wide, 3),
				depth: round(deep, 3),
				side: name,
				index: rows.length,
			});
			done += count;
		}
		return rows;
	};
	const between = depth - 2 * deep;
	return [
		// A row facing +z runs along +x: its houses go from −x to +x.
		...side("south", width, [0, depth / 2 - deep / 2], [1, 0], 0),
		...side("north", width, [0, -depth / 2 + deep / 2], [-1, 0], 180),
		...(between >= houseWidth * 0.8
			? [
					...side("east", between, [width / 2 - deep / 2, 0], [0, -1], 90),
					...side("west", between, [-width / 2 + deep / 2, 0], [0, 1], -90),
				]
			: []),
	];
};
