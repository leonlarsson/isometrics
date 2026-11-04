import * as THREE from "three";

import { Box, Mat, shareGeometryAs, spread, type TV3 } from "../primitives";

/**
 * A row of window panes as one flat shape facing +Z: one mesh for a floor's
 * windows (a house's, a palace's rooms between its pavilions) rather than one
 * per pane, lit together, so old towns of hundreds of houses stay light. Each
 * row shape is built once and named by its panes (ADR-0086), so every row
 * alike shares it.
 */
const paneRows = new Map<string, THREE.BufferGeometry>();
const paneRowGeometry = (xs: readonly number[], [width, height]: readonly [number, number]) => {
	const key = `paneRow:${xs.map((x) => x.toFixed(3)).join(",")}|${width.toFixed(3)},${height.toFixed(3)}`;
	const cached = paneRows.get(key);
	if (cached) {
		return cached;
	}
	const positions: number[] = [];
	const normals: number[] = [];
	for (const x of xs) {
		const [left, right, bottom, top] = [x - width / 2, x + width / 2, -height / 2, height / 2];
		positions.push(
			left,
			bottom,
			0,
			right,
			bottom,
			0,
			right,
			top,
			0,
			left,
			bottom,
			0,
			right,
			top,
			0,
			left,
			top,
			0,
		);
		for (let i = 0; i < 6; i++) {
			normals.push(0, 0, 1);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	paneRows.set(key, shareGeometryAs(geometry, key));
	return geometry;
};

/** Window panes `size` across and up, at `xs` along a wall, as one mesh facing +Z from `position`. */
export const PaneRow = ({
	xs,
	size,
	position,
	color,
	emissive,
	emissiveIntensity,
}: {
	xs: readonly number[];
	size: readonly [number, number];
	position: TV3;
	color: string;
	emissive?: string;
	emissiveIntensity?: number;
}) => (
	<mesh geometry={paneRowGeometry(xs, size)} position={position} receiveShadow>
		<Mat color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
	</mesh>
);

/**
 * Splits windows along a wall into runs of at most `most` (a room's), each
 * with its middle and its panes from that middle, for `PaneRow`s.
 */
export const paneRuns = (xs: readonly number[], most: number) => {
	const runs: { at: number; xs: number[] }[] = [];
	for (let i = 0; i < xs.length; i += most) {
		const run = xs.slice(i, i + most);
		const at = (run[0] + run[run.length - 1]) / 2;
		runs.push({ at, xs: run.map((x) => x - at) });
	}
	return runs;
};

/**
 * Windows with wall between them, for buildings whose window lights are
 * `LitWindows` with a `paneSize` (parts/lights): the glass sits in exactly the
 * cells and the share of each cell the lit panes do, so at night the panes
 * light up where the glass is.
 */

/** How many windows fit along a wall, about `spacing` apart, at least one. */
export const windowColumns = (length: number, spacing: number) =>
	Math.max(1, Math.round(length / spacing));

interface IWindowGridProps {
	width: number;
	depth: number;
	/** The height the floors share, from the ground. */
	height: number;
	columnsX: number;
	columnsZ: number;
	floors: number;
	/** How much of its cell each window fills, across and up: the LitWindows' `paneSize`. */
	paneSize: readonly [number, number];
	color: string;
}

/** Dark glass in every cell of the building's four faces. */
export const WindowGrid = ({
	width,
	depth,
	height,
	columnsX,
	columnsZ,
	floors,
	paneSize: [across, up],
	color,
}: IWindowGridProps) => {
	const floorHeight = height / floors;
	const rows = spread(floors, height).map((y) => y + height / 2);
	// Each face: where its windows run along, how wide each cell is, and how it's turned.
	const faces = [
		{ along: spread(columnsX, width), cell: width / columnsX, at: depth / 2, turn: 0 },
		{ along: spread(columnsZ, depth), cell: depth / columnsZ, at: width / 2, turn: Math.PI / 2 },
		{ along: spread(columnsX, width), cell: width / columnsX, at: depth / 2, turn: Math.PI },
		{ along: spread(columnsZ, depth), cell: depth / columnsZ, at: width / 2, turn: -Math.PI / 2 },
	];
	return (
		<>
			{faces.map(({ along, cell, at, turn }) => (
				<group key={turn} rotation={[0, turn, 0]}>
					{along.flatMap((x) =>
						rows.map((y) => (
							<Box
								key={`${x},${y}`}
								// Just proud of the wall, and behind the lit panes LitWindows draws 0.012 out.
								size={[cell * across, floorHeight * up, 0.01]}
								position={[x, y, at + 0.002]}
								color={color}
								castShadow={false}
							/>
						)),
					)}
				</group>
			))}
		</>
	);
};
