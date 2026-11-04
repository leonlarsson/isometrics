import { round } from "#/lib/math";
import { isInsidePolygon } from "#/scene/areas";
import type { TVec2 } from "#/scene/schema";

/**
 * Lays an old town's houses along its streets (the Stockholm template's Gamla
 * stan): rows of houses down each side of each street, facing it, as deep as
 * there's room for, never on another street, in a square or on a landmark,
 * never over the shore or on top of each other. Streets are laid in the order
 * given, so the main streets get their houses first and the lanes fill in
 * what's left. Plain geometry, no parts: the template turns rows into objects.
 */

/** The houses along one side of a street. */
export interface IRowSide {
	/** How deep its houses are, the first that fits: the deepest first. */
	depths: readonly number[];
	houseWidth: number;
	/** At most this many houses to a row. */
	mostHouses?: number;
}

export interface IStreetLine {
	id: string;
	points: readonly TVec2[];
	width: number;
	/** The houses on its left and right, looking from its first point towards its last; none if left out. */
	left?: IRowSide;
	right?: IRowSide;
}

export interface ILaidRow {
	streetId: string;
	side: IRowSide;
	/** The row's middle, and its turn in degrees about the vertical (its fronts face the street). */
	position: TVec2;
	turn: number;
	houseCount: number;
	depth: number;
	/** Which way its fronts look, as a unit vector [x, z]. */
	facing: TVec2;
	/** Where the middle of its front is, on the street side. */
	front: TVec2;
}

interface IRect {
	centre: TVec2;
	/** Unit vectors along the street and away from it, and the half sizes along them. */
	along: TVec2;
	across: TVec2;
	halfAlong: number;
	halfAcross: number;
}

const segmentDistance = ([px, pz]: TVec2, [ax, az]: TVec2, [bx, bz]: TVec2) => {
	const [dx, dz] = [bx - ax, bz - az];
	const lengthSquared = dx * dx + dz * dz;
	const t =
		lengthSquared === 0
			? 0
			: Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared));
	return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};

/** The distance from a point to an outline's edge. */
const edgeDistance = (point: TVec2, outline: readonly TVec2[]) =>
	Math.min(
		...outline.map((corner, i) =>
			segmentDistance(point, corner, outline[(i + 1) % outline.length]),
		),
	);

/** Points over a rectangle (its corners, the middles of its sides, its middle) to test it by. */
const samplesOf = (rect: IRect): TVec2[] => {
	const points: TVec2[] = [];
	for (const a of [-1, 0, 1]) {
		for (const b of [-1, 0, 1]) {
			points.push([
				rect.centre[0] + rect.along[0] * rect.halfAlong * a + rect.across[0] * rect.halfAcross * b,
				rect.centre[1] + rect.along[1] * rect.halfAlong * a + rect.across[1] * rect.halfAcross * b,
			]);
		}
	}
	return points;
};

/** Whether two rectangles overlap (separating axes), a hair's touching allowed. */
const overlaps = (a: IRect, b: IRect) => {
	const axes = [a.along, a.across, b.along, b.across];
	const [dx, dz] = [b.centre[0] - a.centre[0], b.centre[1] - a.centre[1]];
	return axes.every((axis) => {
		const reach = (rect: IRect) =>
			Math.abs(rect.along[0] * axis[0] + rect.along[1] * axis[1]) * rect.halfAlong +
			Math.abs(rect.across[0] * axis[0] + rect.across[1] * axis[1]) * rect.halfAcross;
		return Math.abs(dx * axis[0] + dz * axis[1]) < reach(a) + reach(b) - 0.02;
	});
};

/** A grid of what's been placed, so each new house is tested against its neighbours only. */
const CELL = 3;
const cellsOf = (rect: IRect) => {
	const radius = Math.hypot(rect.halfAlong, rect.halfAcross);
	const keys: string[] = [];
	for (
		let x = Math.floor((rect.centre[0] - radius) / CELL);
		x <= Math.floor((rect.centre[0] + radius) / CELL);
		x++
	) {
		for (
			let z = Math.floor((rect.centre[1] - radius) / CELL);
			z <= Math.floor((rect.centre[1] + radius) / CELL);
			z++
		) {
			keys.push(`${x},${z}`);
		}
	}
	return keys;
};

/** How far a house keeps from a street's edge, from the shore, and from the street it faces. */
const STREET_CLEARANCE = 0.03;
const SETBACK = 0.08;
/** How far a house's eaves reach out front and back, which mustn't meet another's. */
const EAVES = 0.04;

export const layRowsAlong = ({
	streets,
	land,
	keepOut = [],
	shoreMargin = 0.3,
}: {
	streets: readonly IStreetLine[];
	/** The land the houses stand on: they stay inside it, shoreMargin from its edge. */
	land: readonly TVec2[];
	/** Squares, landmarks and gardens: no house in them. */
	keepOut?: readonly (readonly TVec2[])[];
	shoreMargin?: number;
}): ILaidRow[] => {
	const segments = streets.flatMap((street) =>
		street.points.slice(1).map((end, i) => ({
			from: street.points[i],
			to: end,
			half: street.width / 2 + STREET_CLEARANCE,
		})),
	);
	const grid = new Map<string, IRect[]>();
	const fits = (rect: IRect) =>
		samplesOf(rect).every(
			(point) =>
				isInsidePolygon(point, land) &&
				edgeDistance(point, land) >= shoreMargin &&
				segments.every(
					(segment) => segmentDistance(point, segment.from, segment.to) >= segment.half,
				) &&
				keepOut.every((zone) => !isInsidePolygon(point, zone)),
		) &&
		cellsOf(rect).every((key) => (grid.get(key) ?? []).every((placed) => !overlaps(placed, rect)));
	const place = (rect: IRect) => {
		for (const key of cellsOf(rect)) {
			grid.set(key, [...(grid.get(key) ?? []), rect]);
		}
	};

	const rows: ILaidRow[] = [];
	for (const street of streets) {
		for (const [side, sign] of [
			[street.left, 1],
			[street.right, -1],
		] as const) {
			if (!side) {
				continue;
			}
			for (let i = 0; i < street.points.length - 1; i++) {
				const [ax, az] = street.points[i];
				const [bx, bz] = street.points[i + 1];
				const length = Math.hypot(bx - ax, bz - az);
				const along: TVec2 = [(bx - ax) / length, (bz - az) / length];
				// Left of the way the street runs is (z, −x).
				const away: TVec2 = [along[1] * sign, -along[0] * sign];
				const count = Math.floor((length - 0.2) / side.houseWidth);
				const start = (length - count * side.houseWidth) / 2;
				let run: { at: number; depth: number }[] = [];
				const finish = () => {
					if (run.length > 0) {
						const depth = run[0].depth;
						const middle = (run[0].at + run[run.length - 1].at) / 2;
						const out = street.width / 2 + SETBACK + depth / 2;
						const position: TVec2 = [
							ax + along[0] * middle + away[0] * out,
							az + along[1] * middle + away[1] * out,
						];
						const facing: TVec2 = [-away[0], -away[1]];
						rows.push({
							streetId: street.id,
							side,
							position: [round(position[0]), round(position[1])],
							// Its front (+Z) towards the street: a turn by θ takes +Z to (sin θ, cos θ).
							turn: round((Math.atan2(facing[0], facing[1]) * 180) / Math.PI),
							houseCount: run.length,
							depth,
							facing,
							front: [
								round(position[0] + facing[0] * (depth / 2)),
								round(position[1] + facing[1] * (depth / 2)),
							],
						});
					}
					run = [];
				};
				for (let k = 0; k < count; k++) {
					const at = start + (k + 0.5) * side.houseWidth;
					const depth = side.depths.find((tried) => {
						const out = street.width / 2 + SETBACK + tried / 2;
						return fits({
							centre: [ax + along[0] * at + away[0] * out, az + along[1] * at + away[1] * out],
							along,
							across: away,
							halfAlong: side.houseWidth / 2,
							halfAcross: tried / 2 + EAVES,
						});
					});
					if (depth === undefined) {
						finish();
						continue;
					}
					// A row keeps one depth; a house of another starts a new row.
					if (run.length > 0 && (run[0].depth !== depth || run.length >= (side.mostHouses ?? 6))) {
						finish();
					}
					const out = street.width / 2 + SETBACK + depth / 2;
					place({
						centre: [ax + along[0] * at + away[0] * out, az + along[1] * at + away[1] * out],
						along,
						across: away,
						halfAlong: side.houseWidth / 2,
						halfAcross: depth / 2 + EAVES,
					});
					run.push({ at, depth });
				}
				finish();
			}
		}
	}
	return rows;
};
