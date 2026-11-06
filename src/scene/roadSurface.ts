import { isHiddenRoute, roadCenterlineOf } from "./roads";
import type { TRoad } from "./schema";

/**
 * Where roads' surfaces are on the ground: what checking a world (ADR-0117)
 * asks to find objects standing on a road. A road's surface is its rounded
 * centre line (ADR-0017), half its width either side, at its altitude there
 * (ADR-0018). Only roads that are drawn count: not hidden routes, nor roads
 * set hidden. No React.
 */

/** A road's surface at a point of the ground. */
export interface IRoadSurfaceHit {
	road: TRoad;
	/** How high the road's surface is there, above the base ground. */
	altitude: number;
}

/** A straight piece of a road's centre line, with its altitude and width at each end. */
interface ISegment {
	road: TRoad;
	x0: number;
	z0: number;
	x1: number;
	z1: number;
	altitude0: number;
	altitude1: number;
	width0: number;
	width1: number;
}

/** The side of the squares the segments are sorted into, in grid units. */
const CELL = 4;

/** A square's key: its column and row in one number (grounds are far smaller than 65,536 squares across). */
const cellKey = (column: number, row: number) => (column + 32_768) * 65_536 + row + 32_768;

/** The drawn roads' surfaces, sorted into squares of the ground so a point only looks at what's near. */
export const roadSurfacesOf = (roads: readonly TRoad[]) => {
	const cells = new Map<number, ISegment[]>();
	for (const road of roads) {
		if (road.isHidden || isHiddenRoute(road.kind)) {
			continue;
		}
		const line = roadCenterlineOf(road);
		const count = road.loops && line.length > 2 ? line.length : line.length - 1;
		for (let i = 0; i < count; i++) {
			const from = line[i];
			const to = line[(i + 1) % line.length];
			const segment: ISegment = {
				road,
				x0: from[0],
				z0: from[1],
				x1: to[0],
				z1: to[1],
				altitude0: from[2],
				altitude1: to[2],
				width0: from[3] ?? road.width,
				width1: to[3] ?? road.width,
			};
			const half = Math.max(segment.width0, segment.width1) / 2;
			const columns = [Math.min(from[0], to[0]) - half, Math.max(from[0], to[0]) + half].map((x) =>
				Math.floor(x / CELL),
			);
			const rows = [Math.min(from[1], to[1]) - half, Math.max(from[1], to[1]) + half].map((z) =>
				Math.floor(z / CELL),
			);
			for (let column = columns[0]; column <= columns[1]; column++) {
				for (let row = rows[0]; row <= rows[1]; row++) {
					const key = cellKey(column, row);
					const list = cells.get(key);
					if (list) {
						list.push(segment);
					} else {
						cells.set(key, [segment]);
					}
				}
			}
		}
	}

	/** The roads whose surface is at this point of the ground, each once, with its altitude there. */
	const at = (x: number, z: number): IRoadSurfaceHit[] => {
		const near = cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)));
		if (!near) {
			return [];
		}
		const hits: IRoadSurfaceHit[] = [];
		for (const segment of near) {
			const dx = segment.x1 - segment.x0;
			const dz = segment.z1 - segment.z0;
			const lengthSquared = dx * dx + dz * dz;
			const t =
				lengthSquared === 0
					? 0
					: Math.min(
							1,
							Math.max(0, ((x - segment.x0) * dx + (z - segment.z0) * dz) / lengthSquared),
						);
			const apart = Math.hypot(x - (segment.x0 + dx * t), z - (segment.z0 + dz * t));
			const half = (segment.width0 + (segment.width1 - segment.width0) * t) / 2;
			if (apart > half) {
				continue;
			}
			const altitude = segment.altitude0 + (segment.altitude1 - segment.altitude0) * t;
			// A road crossing itself (a flyover) is there twice, at two altitudes.
			if (
				!hits.some((hit) => hit.road === segment.road && Math.abs(hit.altitude - altitude) < 0.5)
			) {
				hits.push({ road: segment.road, altitude });
			}
		}
		return hits;
	};

	/** Whether any road's surface may be within this box of the ground, so points in it are worth asking about. */
	const isNear = (minX: number, maxX: number, minZ: number, maxZ: number) => {
		for (let column = Math.floor(minX / CELL); column <= Math.floor(maxX / CELL); column++) {
			for (let row = Math.floor(minZ / CELL); row <= Math.floor(maxZ / CELL); row++) {
				if (cells.has(cellKey(column, row))) {
					return true;
				}
			}
		}
		return false;
	};

	return { at, isNear };
};
