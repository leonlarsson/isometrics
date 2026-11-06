import { roadSurfacesOf } from "#/scene/roadSurface";
import type { TEntity, TRoad } from "#/scene/schema";

import { getPart, resolveProps, type TAnyPart } from "./registry";

/**
 * The room objects take up, as boxes standing on the ground: what the
 * templates' tests and checking a world (ADR-0117) both ask to find objects
 * standing inside each other. No React.
 */

/** How far two things may reach into each other before it counts, in grid units. */
export const OVERLAP_TOLERANCE = 0.05;

/** One box of an object: its outline on the ground, turned and scaled, and the heights it takes up. */
export interface IBody {
	centre: readonly [number, number];
	/** Its own x and z axes on the ground, as it's turned. */
	axes: readonly [readonly [number, number], readonly [number, number]];
	/** Half its size along each of its axes. */
	halves: readonly [number, number];
	bottom: number;
	top: number;
}

/** An object's bodies, worked out from its part (`bodiesOf`). */
const measuredBodies = (entity: TEntity, part: TAnyPart): IBody[] => {
	const props = resolveProps(part, entity.props);
	const turn = (entity.rotation[1] * Math.PI) / 180;
	// Vehicles face +X; a turn of r degrees about Y takes +X to (cos r, -sin r).
	const along: [number, number] = [Math.cos(turn), -Math.sin(turn)];
	const across: [number, number] = [Math.sin(turn), Math.cos(turn)];
	const top = entity.altitude + part.height(props) * entity.scale;
	const body = ([width, depth]: [number, number], bottom: number): IBody => ({
		centre: entity.position,
		axes: [along, across],
		halves: [(width * entity.scale) / 2, (depth * entity.scale) / 2],
		bottom,
		top,
	});
	const overhang = part.overhang?.(props);
	return overhang
		? [
				body(overhang.foot, entity.altitude),
				body(part.footprint(props), entity.altitude + overhang.from * entity.scale),
			]
		: [body(part.footprint(props), entity.altitude)];
};

const bodiesKnown = new WeakMap<TEntity, { part: TAnyPart; bodies: IBody[] }>();

/**
 * An object's bodies: ground outlines (a footprint, turned and scaled) and the heights each
 * takes up. One, or two for parts wider overhead than at their foot (`overhang`, a parasol):
 * the foot from the ground, the rest of the footprint from where it begins. Worked out once
 * per object as it is (reading its props through its part's schema is what costs).
 */
export const bodiesOf = (
	entity: TEntity,
	part: TAnyPart | undefined = getPart(entity.kind),
): IBody[] => {
	if (!part) {
		return [];
	}
	const known = bodiesKnown.get(entity);
	if (known?.part === part) {
		return known.bodies;
	}
	const bodies = measuredBodies(entity, part);
	bodiesKnown.set(entity, { part, bodies });
	return bodies;
};

/** How far a body's outline reaches from its centre along x and along z, as it's turned. */
export const reachAlongXAndZ = (body: IBody): [number, number] => [
	body.halves[0] * Math.abs(body.axes[0][0]) + body.halves[1] * Math.abs(body.axes[1][0]),
	body.halves[0] * Math.abs(body.axes[0][1]) + body.halves[1] * Math.abs(body.axes[1][1]),
];

/** How far two outlines overlap, the least along any of their axes (0 or less: they don't). */
export const overlapOf = (a: IBody, b: IBody) => {
	let least = Number.POSITIVE_INFINITY;
	for (const axis of [...a.axes, ...b.axes]) {
		const reach = (body: IBody) =>
			body.halves[0] * Math.abs(body.axes[0][0] * axis[0] + body.axes[0][1] * axis[1]) +
			body.halves[1] * Math.abs(body.axes[1][0] * axis[0] + body.axes[1][1] * axis[1]);
		const apart = Math.abs(
			(b.centre[0] - a.centre[0]) * axis[0] + (b.centre[1] - a.centre[1]) * axis[1],
		);
		least = Math.min(least, reach(a) + reach(b) - apart);
	}
	return least;
};

/**
 * Whether an object stands still in a place of its own, so nothing else should
 * stand in it: not a vehicle on a route (it moves), a hidden one, a flat part
 * (meant to be stood on), a marker (beacons and text mark a spot, beside or over
 * what's there) or a shape (pieces of one build, meant to meet and join, ADR-0124).
 */
export const takesUpRoom = (entity: TEntity, part: TAnyPart | undefined) =>
	!entity.follow &&
	!entity.isHidden &&
	part !== undefined &&
	!part.flat &&
	part.category !== "markers" &&
	part.category !== "shapes";

/** Two objects standing inside each other, and by how much. */
export interface IObjectsInEachOther {
	a: TEntity;
	b: TEntity;
	/** How far they reach into each other, in grid units. */
	overlap: number;
}

/**
 * The objects that stand inside each other, each pair once: those that take
 * up room (`takesUpRoom`) whose outlines overlap by more than the tolerance
 * where their heights meet. One stacked on another (ADR-0138) starts where
 * the other's top is, so their heights don't meet. At most `most` pairs
 * (thousands of objects in one place would be millions of pairs).
 */
export const objectsInEachOther = (
	entities: readonly TEntity[],
	partOf: (kind: string) => TAnyPart | undefined = getPart,
	most = Number.POSITIVE_INFINITY,
): IObjectsInEachOther[] => {
	// Each object's bodies once, and how far they reach from its middle, so pairs far apart
	// are passed over without testing their bodies (big worlds have a thousand objects).
	const shapes = entities.flatMap((entity) => {
		const part = partOf(entity.kind);
		if (!takesUpRoom(entity, part)) {
			return [];
		}
		const bodies = bodiesOf(entity, part);
		const reach = Math.max(0, ...bodies.map((body) => Math.hypot(body.halves[0], body.halves[1])));
		return [{ entity, bodies, reach }];
	});
	// West to east by where they begin: once one begins past where another ends, so do the rest.
	shapes.sort((a, b) => a.entity.position[0] - a.reach - (b.entity.position[0] - b.reach));
	const found: IObjectsInEachOther[] = [];
	for (let i = 0; i < shapes.length && found.length < most; i++) {
		const a = shapes[i];
		for (let j = i + 1; j < shapes.length && found.length < most; j++) {
			const b = shapes[j];
			if (b.entity.position[0] - b.reach >= a.entity.position[0] + a.reach) {
				break;
			}
			const apart = Math.hypot(
				b.entity.position[0] - a.entity.position[0],
				b.entity.position[1] - a.entity.position[1],
			);
			if (apart >= a.reach + b.reach) {
				continue;
			}
			// The most any body of one overlaps any body of the other, where their heights meet.
			const overlap = Math.max(
				0,
				...a.bodies.flatMap((one) =>
					b.bodies
						.filter(
							(other) =>
								one.top > other.bottom + OVERLAP_TOLERANCE &&
								other.top > one.bottom + OVERLAP_TOLERANCE,
						)
						.map((other) => overlapOf(one, other)),
				),
			);
			if (overlap > OVERLAP_TOLERANCE) {
				found.push({ a: a.entity, b: b.entity, overlap });
			}
		}
	}
	// In the world's order, as they're listed.
	const order = new Map(entities.map((entity, index) => [entity, index]));
	return found
		.map((pair) =>
			(order.get(pair.a) ?? 0) <= (order.get(pair.b) ?? 0)
				? pair
				: { a: pair.b, b: pair.a, overlap: pair.overlap },
		)
		.sort(
			(x, y) =>
				(order.get(x.a) ?? 0) - (order.get(y.a) ?? 0) ||
				(order.get(x.b) ?? 0) - (order.get(y.b) ?? 0),
		);
};

/** An object standing on a road, and how much of it. */
export interface IObjectOnRoad {
	entity: TEntity;
	road: TRoad;
	/** Whether its middle is on the road. */
	isMiddleOnRoad: boolean;
	/** How much of its footprint is on the road, from 0 to 1. */
	onRoadShare: number;
}

/** Points of a footprint, across it and along it, sampled on a grid this many wide. */
const SAMPLES = 5;

/** How far under an object's base a road still counts as what it stands on, in grid units. */
const ROAD_BELOW = 0.25;

/**
 * The objects standing on a road's surface (drawn roads only, `roadSurfacesOf`):
 * of those that take up room (`takesUpRoom`), not vehicles (parked ones stand on
 * roads) nor parts made to stand over one (a tunnel), where the road is at
 * the height the object takes up (not a bridge over it).
 */
export const objectsOnRoads = (
	entities: readonly TEntity[],
	roads: readonly TRoad[],
	partOf: (kind: string) => TAnyPart | undefined = getPart,
): IObjectOnRoad[] => {
	if (roads.length === 0) {
		return [];
	}
	const surfaces = roadSurfacesOf(roads);
	const found: IObjectOnRoad[] = [];
	for (const entity of entities) {
		const part = partOf(entity.kind);
		if (!takesUpRoom(entity, part) || part?.category === "vehicles" || part?.standsOverRoads) {
			continue;
		}
		// Its foot: what stands on the ground.
		const [foot] = bodiesOf(entity, part);
		if (!foot) {
			continue;
		}
		// Far from every road, as most things are: nothing to sample.
		const reach = Math.hypot(foot.halves[0], foot.halves[1]);
		const [x0, z0] = foot.centre;
		if (!surfaces.isNear(x0 - reach, x0 + reach, z0 - reach, z0 + reach)) {
			continue;
		}
		const counts = new Map<TRoad, { points: number; middle: boolean }>();
		const middle = (SAMPLES - 1) / 2;
		for (let i = 0; i < SAMPLES; i++) {
			for (let j = 0; j < SAMPLES; j++) {
				const u = (((i + 0.5) / SAMPLES) * 2 - 1) * foot.halves[0];
				const v = (((j + 0.5) / SAMPLES) * 2 - 1) * foot.halves[1];
				const x = x0 + foot.axes[0][0] * u + foot.axes[1][0] * v;
				const z = z0 + foot.axes[0][1] * u + foot.axes[1][1] * v;
				for (const hit of surfaces.at(x, z)) {
					// The road is where the object is: not over its top, nor far under its base.
					if (hit.altitude < foot.bottom - ROAD_BELOW || hit.altitude >= foot.top) {
						continue;
					}
					const count = counts.get(hit.road) ?? { points: 0, middle: false };
					count.points += 1;
					count.middle ||= i === middle && j === middle;
					counts.set(hit.road, count);
				}
			}
		}
		for (const [road, { points, middle }] of counts) {
			found.push({
				entity,
				road,
				isMiddleOnRoad: middle,
				onRoadShare: points / (SAMPLES * SAMPLES),
			});
		}
	}
	return found;
};
