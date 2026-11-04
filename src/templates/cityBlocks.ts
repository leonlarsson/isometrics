import { round } from "#/lib/math";
import type { TVec2 } from "#/scene/schema";

/**
 * Lays a city's blocks on a grid (the Stockholm template's Norrmalm, Kungsholmen
 * and Södermalm): rectangles of one size with streets between them, the grid
 * turned as the city's streets run, each kept only where every point of it (and
 * of a margin round it) passes a test, so blocks stay on land, off the roads and
 * out of parks and landmarks. Plain geometry, no parts: the template turns
 * blocks into rows of houses.
 */

export interface IBlockGrid {
	/** One block's middle; the others are laid from it. */
	origin: TVec2;
	/** The grid's turn in degrees about the vertical, as an object's: its x runs along (cos, −sin). */
	turn: number;
	/** A block's size along the grid's x and z, and the street between two blocks. */
	size: TVec2;
	street: number;
	/** Which blocks to try, counted from the origin's, along the grid's x and z (both ends in). */
	columns: [number, number];
	rows: [number, number];
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

/** Points over a block and the margin round it, every `step` or closer, its edges included. */
const samplesOf = (block: ILaidBlock, margin: number, step: number) => {
	const at = inFrame(block.centre, block.turn);
	const [halfX, halfZ] = [block.size[0] / 2 + margin, block.size[1] / 2 + margin];
	const countX = Math.ceil((halfX * 2) / step);
	const countZ = Math.ceil((halfZ * 2) / step);
	const points: TVec2[] = [];
	for (let i = 0; i <= countX; i++) {
		for (let k = 0; k <= countZ; k++) {
			points.push(at([-halfX + (i * halfX * 2) / countX, -halfZ + (k * halfZ * 2) / countZ]));
		}
	}
	return points;
};

export const layBlocks = (
	grid: IBlockGrid,
	/** Whether a point may be built on. */
	fits: (point: TVec2) => boolean,
	{ margin = 0, step = 0.5 }: { margin?: number; step?: number } = {},
): ILaidBlock[] => {
	const at = inFrame(grid.origin, grid.turn);
	const blocks: ILaidBlock[] = [];
	for (let k = grid.rows[0]; k <= grid.rows[1]; k++) {
		for (let i = grid.columns[0]; i <= grid.columns[1]; i++) {
			const block: ILaidBlock = {
				centre: at([i * (grid.size[0] + grid.street), k * (grid.size[1] + grid.street)]),
				turn: grid.turn,
				size: grid.size,
			};
			if (samplesOf(block, margin, step).every(fits)) {
				blocks.push(block);
			}
		}
	}
	return blocks;
};
