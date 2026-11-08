import { round } from "#/lib/math";

import { areaTopAt, cornerTop, isRaised, type TAreaShape } from "./areas";
import { areaBaseOf } from "./grounds";
import type { TArea, TVec2, TGround as TWorldGround } from "./schema";

/**
 * What things stand on (ADR-0098, ADR-0138): the base ground, raised land and
 * slopes, and the tops of objects that can be stood on (a shape). Each is a
 * top over a stretch of the ground; where several are over a point, a thing
 * put there stands on the highest.
 */
export interface ITop {
	/** The object it's the top of, so a thing moving never stands on itself; null for an area. */
	entityId: string | null;
	/** The box on the ground it lies within. */
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
	/** The highest it goes, as an altitude. */
	highestAltitude: number;
	/** How high it is at a point (an altitude), or null where nothing can stand on it (outside it, an opening). */
	altitudeAt: (x: number, z: number) => number | null;
}

/** Whether a top lies over a point at all (its box), before asking how high it is there. */
export const isOver = (top: ITop, x: number, z: number) =>
	x >= top.minX && x <= top.maxX && z >= top.minZ && z <= top.maxZ;

/** What the ground is made of: the areas, as far as their heights go. */
type TGround = TAreaShape & Pick<TArea, "isHidden">;

const areaTops = new WeakMap<TGround, { base: number; top: ITop | null }>();

/**
 * An area's top as something to stand on, or null when it isn't raised (or is
 * hidden), standing on `base` (the top of the ground under it, ADR-0155).
 */
const areaTopOf = (area: TGround, base: number): ITop | null => {
	const known = areaTops.get(area);
	if (known !== undefined && known.base === base) {
		return known.top;
	}
	let top: ITop | null = null;
	if (!area.isHidden && isRaised(area)) {
		const xs = area.points.map((point) => point[0]);
		const zs = area.points.map((point) => point[1]);
		const corners = [...area.points, ...(area.peaks ?? [])];
		top = {
			entityId: null,
			minX: Math.min(...xs),
			maxX: Math.max(...xs),
			minZ: Math.min(...zs),
			maxZ: Math.max(...zs),
			highestAltitude: base + Math.max(0, ...corners.map((point) => cornerTop(area, point))),
			altitudeAt: (x, z) => {
				const at = areaTopAt(area, [x, z]);
				return at === null ? null : base + at;
			},
		};
	}
	areaTops.set(area, { base, top });
	return top;
};

/**
 * The tops of the raised areas among these (each worked out once per area as
 * it is), each on the ground under its middle among `grounds` (ADR-0155).
 */
export const areaTopsOf = (
	areas: readonly TGround[],
	grounds: readonly TWorldGround[] = [],
): ITop[] => areas.flatMap((area) => areaTopOf(area, areaBaseOf(area, grounds)) ?? []);

/**
 * How far an object's top may be above a thing's base and still be what it
 * stands on (rounding, a top set by hand to a hair over).
 */
const RESTS_WITHIN = 0.01;

/**
 * How high what stands at a point is: the highest of the tops over it, else
 * the base ground (0). What a thing put there stands on. Given `base` (the
 * thing's own altitude), it's what the thing stands on where it is now: an
 * object's top counts only at or below it (a copy left in its place, or a
 * shape it was sunk into, isn't what it stands on); the ground always counts,
 * so a thing sunk into it stays that deep (ADR-0097).
 */
export const standingAltitudeOn = (tops: readonly ITop[], [x, z]: TVec2, base?: number) => {
	let highest = 0;
	for (const top of tops) {
		if (top.highestAltitude <= highest || !isOver(top, x, z)) {
			continue;
		}
		const altitude = top.altitudeAt(x, z);
		if (
			altitude === null ||
			altitude <= highest ||
			(base !== undefined && top.entityId !== null && altitude > base + RESTS_WITHIN)
		) {
			continue;
		}
		highest = altitude;
	}
	return round(highest);
};

/**
 * A thing's altitude once it moves from one spot to another: as high above
 * what it stands on there as it was above what it stood on here, so it climbs
 * onto raised land and the tops of shapes, and one lifted or sunk on purpose
 * keeps that (ADR-0098, ADR-0138). `to.tops` leaves out what moves with it.
 */
export const altitudeMovedOn = (
	altitude: number,
	from: { tops: readonly ITop[]; point: TVec2 },
	to: { tops: readonly ITop[]; point: TVec2 },
) =>
	round(
		altitude -
			standingAltitudeOn(from.tops, from.point, altitude) +
			standingAltitudeOn(to.tops, to.point),
	);
