import { Box, spread } from "../primitives";

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
