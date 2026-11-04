import { isHiddenRoute, polylineLength, ROAD_KINDS, type TRoadEnd } from "./roads";
import { centerlineOf, projectOntoRoad } from "./routes";
import type { TJunction, TJunctionEnd, TRoad, TRoadPoint, TVec2 } from "./schema";

/**
 * Junctions, where road ends meet (ADR-0136): the network they make, how far
 * each road is cut back so they meet cleanly, the junction's own surface, and
 * the edits that keep them together. Framework-free so it can be unit-tested
 * and reused. A junction only ever joins ends: a T or a crossroads cuts the
 * road going through in two at it.
 */

/** One road end at a junction, as drawing and driving need it. */
export interface INetworkEnd {
	roadId: string;
	end: TRoadEnd;
	/** Along the road away from the junction, on the ground (a unit vector). */
	direction: TVec2;
	/** Half the road's width at that end. */
	halfWidth: number;
	/** Whether the road is drawn (hidden routes aren't). */
	isDrawn: boolean;
	/** How far from the junction vehicles' curves through it join the road. */
	routeTrim: number;
	/** How far from the junction the road's surface is cut back (0 for hidden routes). */
	drawTrim: number;
}

export interface INetworkJunction {
	id: string;
	/** Where it is: [x, z, altitude], its first end's point. */
	place: TRoadPoint;
	/** Its ends, two or more. */
	ends: INetworkEnd[];
}

export interface IRoadNetwork {
	junctions: INetworkJunction[];
	/** The junction at a road's end, if it's in one. */
	junctionAt: (roadId: string, end: TRoadEnd) => INetworkJunction | null;
	/** A road end at a junction, if it's in one. */
	endAt: (roadId: string, end: TRoadEnd) => INetworkEnd | null;
	/** Whether a road has a junction at either end: vehicles on it drive the network. */
	connects: (roadId: string) => boolean;
	/** How far the road's surface is cut back at each end (0 where it isn't at a junction). */
	drawTrimsOf: (roadId: string) => { start: number; end: number };
	roadById: (roadId: string) => TRoad | undefined;
}

/** Extra room past where roads stop overlapping, for the kerb's curve, as a share of the widest. */
const KERB = 0.45;
/** No end is cut back further than this many times the widest road's half width. */
const MOST_TRIM = 4;
/** A road's two cuts together take at most this share of its length. */
const MOST_OF_A_ROAD = 0.8;
/** How far the junction's surface reaches over each road's cut end, so no crack shows. */
const PAD_OVERLAP = 0.04;
/** Steps in each curve between two roads at a junction. */
const KERB_STEPS = 8;

const hypot2 = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const normalize = (a: TVec2): TVec2 => {
	const len = Math.hypot(a[0], a[1]);
	return len === 0 ? [1, 0] : [a[0] / len, a[1] / len];
};
/** Right-hand side, as `roads.ts` turns it: a quarter turn towards increasing angle. */
const rightOf = (f: TVec2): TVec2 => [-f[1], f[0]];

/** The point of a road at one of its ends. */
export const endPointOf = (road: Pick<TRoad, "points">, end: TRoadEnd) =>
	end === "start" ? road.points[0] : road.points[road.points.length - 1];

export const otherEnd = (end: TRoadEnd): TRoadEnd => (end === "start" ? "end" : "start");

const keyOf = (roadId: string, end: TRoadEnd) => `${end}:${roadId}`;

/**
 * How far each end at a junction is cut back: to where its band (straight
 * from the junction, as wide as the road) leaves every other's, plus room for
 * a kerb. For two roads at an angle θ, road i is clear of road j from
 * (wⱼ + wᵢ|cos θ|) / sin θ along it, or from wᵢ tan θ when j points away
 * behind it; ends in line need no cut.
 */
export const trimsAtJunction = (ends: readonly { direction: TVec2; halfWidth: number }[]) => {
	const widest = Math.max(0, ...ends.map((end) => end.halfWidth));
	return ends.map((a, i) => {
		let trim = 0;
		ends.forEach((b, j) => {
			if (i === j) {
				return;
			}
			const cos = a.direction[0] * b.direction[0] + a.direction[1] * b.direction[1];
			const sin = Math.abs(a.direction[0] * b.direction[1] - a.direction[1] * b.direction[0]);
			const across =
				sin > 1e-3 ? (b.halfWidth + a.halfWidth * Math.abs(cos)) / sin : Number.POSITIVE_INFINITY;
			const behind = cos < -1e-3 ? (a.halfWidth * sin) / -cos : Number.POSITIVE_INFINITY;
			trim = Math.max(trim, Math.min(across, behind, MOST_TRIM * widest));
		});
		return trim > 1e-3 ? trim + KERB * widest : 0;
	});
};

/** Along a road away from its end, on the ground: from its end towards the next distinct point. */
const directionAt = (line: readonly TRoadPoint[], end: TRoadEnd): TVec2 => {
	const ordered = end === "start" ? line : [...line].reverse();
	const from = ordered[0];
	const to = ordered.find((p) => hypot2(p, from) > 1e-6) ?? from;
	return normalize([to[0] - from[0], to[1] - from[1]]);
};

const networks = new WeakMap<readonly TRoad[], WeakMap<readonly TJunction[], IRoadNetwork>>();

/**
 * The network the junctions make, worked out once per list of roads and
 * junctions (lists are replaced, never changed in place). Ends of roads that
 * are missing or loop, repeats, and ends further from the junction's first end
 * than their road's width are left out; a junction left with fewer than two
 * ends is too.
 */
export const roadNetworkOf = (
	roads: readonly TRoad[],
	junctions: readonly TJunction[],
): IRoadNetwork => {
	let byJunctions = networks.get(roads);
	if (!byJunctions) {
		byJunctions = new WeakMap();
		networks.set(roads, byJunctions);
	}
	let network = byJunctions.get(junctions);
	if (!network) {
		network = buildNetwork(roads, junctions);
		byJunctions.set(junctions, network);
	}
	return network;
};

const buildNetwork = (roads: readonly TRoad[], junctions: readonly TJunction[]): IRoadNetwork => {
	const byId = new Map(roads.map((road) => [road.id, road]));
	const used = new Set<string>();
	const built: INetworkJunction[] = [];
	for (const junction of junctions) {
		let place: TRoadPoint | null = null;
		const ends: { road: TRoad; end: TRoadEnd }[] = [];
		for (const { roadId, end } of junction.ends) {
			const road = byId.get(roadId);
			if (!road || road.loops || road.points.length < 2 || used.has(keyOf(roadId, end))) {
				continue;
			}
			const point = endPointOf(road, end);
			if (place === null) {
				place = [point[0], point[1], point[2]];
			} else if (hypot2(point, place) > Math.max(road.width, 0.5)) {
				continue;
			}
			used.add(keyOf(roadId, end));
			ends.push({ road, end });
		}
		if (place === null || ends.length < 2) {
			for (const { road, end } of ends) {
				used.delete(keyOf(road.id, end));
			}
			continue;
		}
		const shaped = ends.map(({ road, end }) => {
			const line = centerlineOf(road);
			const at = end === "start" ? line[0] : line[line.length - 1];
			return {
				roadId: road.id,
				end,
				direction: directionAt(line, end),
				halfWidth: (at[3] ?? road.width) / 2,
				isDrawn: !isHiddenRoute(road.kind),
			};
		});
		const routeTrims = trimsAtJunction(shaped);
		const drawn = shaped.filter((end) => end.isDrawn);
		const drawTrims = trimsAtJunction(drawn);
		built.push({
			id: junction.id,
			place,
			ends: shaped.map((end, i) => ({
				...end,
				routeTrim: routeTrims[i],
				drawTrim: end.isDrawn ? drawTrims[drawn.indexOf(end)] : 0,
			})),
		});
	}

	// A road's two cuts share its length: never more than most of it.
	const endsOf = new Map<string, INetworkEnd[]>();
	for (const junction of built) {
		for (const end of junction.ends) {
			endsOf.set(end.roadId, [...(endsOf.get(end.roadId) ?? []), end]);
		}
	}
	for (const [roadId, ends] of endsOf) {
		const road = byId.get(roadId) as TRoad;
		const room = polylineLength(centerlineOf(road), false) * MOST_OF_A_ROAD;
		for (const trim of ["routeTrim", "drawTrim"] as const) {
			const total = ends.reduce((sum, end) => sum + end[trim], 0);
			if (total > room) {
				for (const end of ends) {
					end[trim] *= room / total;
				}
			}
		}
	}

	const atEnd = new Map<string, { junction: INetworkJunction; end: INetworkEnd }>();
	for (const junction of built) {
		for (const end of junction.ends) {
			atEnd.set(keyOf(end.roadId, end.end), { junction, end });
		}
	}
	return {
		junctions: built,
		junctionAt: (roadId, end) => atEnd.get(keyOf(roadId, end))?.junction ?? null,
		endAt: (roadId, end) => atEnd.get(keyOf(roadId, end))?.end ?? null,
		connects: (roadId) => endsOf.has(roadId),
		drawTrimsOf: (roadId) => ({
			start: atEnd.get(keyOf(roadId, "start"))?.end.drawTrim ?? 0,
			end: atEnd.get(keyOf(roadId, "end"))?.end.drawTrim ?? 0,
		}),
		roadById: (roadId) => byId.get(roadId),
	};
};

const lerpPoint = (a: TRoadPoint, b: TRoadPoint, t: number): TRoadPoint => {
	const out = [
		a[0] + (b[0] - a[0]) * t,
		a[1] + (b[1] - a[1]) * t,
		a[2] + (b[2] - a[2]) * t,
	] as TRoadPoint;
	if (a.length > 3 && b.length > 3) {
		out.push((a[3] as number) + ((b[3] as number) - (a[3] as number)) * t);
	}
	return out;
};

/** The point `distance` along a line from its first point (on the ground), clamped to its ends. */
export const pointAlongLine = (line: readonly TRoadPoint[], distance: number): TRoadPoint => {
	let travelled = 0;
	for (let i = 1; i < line.length; i++) {
		const span = hypot2(line[i], line[i - 1]);
		if (travelled + span >= distance && span > 0) {
			return lerpPoint(line[i - 1], line[i], Math.max(0, (distance - travelled) / span));
		}
		travelled += span;
	}
	return line[line.length - 1];
};

/**
 * A line cut back by `fromStart` at its first point and `fromEnd` at its
 * last, measured along the ground; heights and widths are interpolated at the
 * cuts. Nothing (an empty list) when the cuts meet.
 */
export const cutLine = (
	line: readonly TRoadPoint[],
	fromStart: number,
	fromEnd: number,
): TRoadPoint[] => {
	if (fromStart <= 0 && fromEnd <= 0) {
		return [...line];
	}
	const along = [0];
	for (let i = 1; i < line.length; i++) {
		along.push(along[i - 1] + hypot2(line[i], line[i - 1]));
	}
	const total = along[along.length - 1];
	const [from, to] = [Math.max(0, fromStart), total - Math.max(0, fromEnd)];
	if (to - from < 1e-6) {
		return [];
	}
	const inner = line.filter((_, i) => along[i] > from + 1e-9 && along[i] < to - 1e-9);
	return [pointAlongLine(line, from), ...inner, pointAlongLine(line, to)];
};

/** A junction's own surface: a fan over its outline, and the outline's curves for a raised deck's edge. */
export interface IJunctionPad {
	/** [x, z, altitude]: the centre first, then the outline. */
	vertices: TRoadPoint[];
	/** Triangles, wound to face up. */
	indices: number[];
	/** The curves between neighbouring roads, each from one road's edge to the next's. */
	edges: TRoadPoint[][];
	/** The road it takes its colour from: its first paved road, else its first drawn road. */
	colorRoadId: string;
}

/**
 * The junction's surface (ADR-0136): round its drawn roads' cut ends in turn,
 * each end's edge exactly where the road's surface stops (and a little over
 * it), and between neighbours a curve through where their edges would meet:
 * a kerb on the inside of a turn, a rounded corner outside a bend, straight
 * where they're in line. Null when nothing is cut back (ends in line, or
 * fewer than two drawn roads).
 */
export const junctionPad = (
	network: IRoadNetwork,
	junction: INetworkJunction,
): IJunctionPad | null => {
	const drawn = junction.ends.filter((end) => end.isDrawn && end.drawTrim > 1e-3);
	if (drawn.length < 2) {
		return null;
	}
	const cuts = drawn.map((end) => {
		const road = network.roadById(end.roadId) as TRoad;
		const line = centerlineOf(road);
		const trims = network.drawTrimsOf(end.roadId);
		const cut = cutLine(line, trims.start, trims.end);
		const ordered = end.end === "start" ? cut : [...cut].reverse();
		// Where the road's surface stops, and its edge there exactly as its ribbon makes it.
		const at = ordered[0] ?? pointAlongLine(line, end.end === "start" ? trims.start : 0);
		const next = ordered.find((p) => hypot2(p, at) > 1e-6);
		const direction = next ? normalize([next[0] - at[0], next[1] - at[1]]) : end.direction;
		const halfWidth = (at[3] ?? road.width) / 2;
		const side = rightOf(direction);
		// A little over the road's own surface, so no crack shows between the two.
		const out = (p: TVec2, h: number): TRoadPoint => [
			p[0] + direction[0] * PAD_OVERLAP,
			p[1] + direction[1] * PAD_OVERLAP,
			h,
		];
		return {
			road,
			angle: Math.atan2(end.direction[1], end.direction[0]),
			direction,
			// Its edge on the side the next road round is (increasing angle), and on the other.
			toNext: out([at[0] + side[0] * halfWidth, at[1] + side[1] * halfWidth], at[2]),
			middle: out([at[0], at[1]], at[2]),
			toPrevious: out([at[0] - side[0] * halfWidth, at[1] - side[1] * halfWidth], at[2]),
			halfWidth,
		};
	});
	cuts.sort((a, b) => a.angle - b.angle);
	const widest = Math.max(...cuts.map((cut) => cut.halfWidth));
	const [px, pz, ph] = junction.place;

	const outline: TRoadPoint[] = [];
	const edges: TRoadPoint[][] = [];
	cuts.forEach((cut, i) => {
		const next = cuts[(i + 1) % cuts.length];
		outline.push(cut.toPrevious, cut.middle, cut.toNext);
		const from = cut.toNext;
		const to = next.toPrevious;
		let gap = next.angle - cut.angle;
		if (gap <= 0) {
			gap += Math.PI * 2;
		}
		// Where the two edges, carried on straight, would meet.
		const [d1, d2] = [cut.direction, next.direction];
		const cross = d1[0] * d2[1] - d1[1] * d2[0];
		let control: TVec2 | null = null;
		if (Math.abs(gap - Math.PI) > 0.05 && Math.abs(cross) > 1e-3) {
			const s = ((to[0] - from[0]) * d2[1] - (to[1] - from[1]) * d2[0]) / cross;
			const meet: TVec2 = [from[0] + d1[0] * s, from[1] + d1[1] * s];
			if (Math.hypot(meet[0] - px, meet[1] - pz) < MOST_TRIM * widest * 1.5) {
				control = meet;
			}
		}
		const curve: TRoadPoint[] = [from];
		for (let step = 1; step < KERB_STEPS; step++) {
			const t = step / KERB_STEPS;
			const u = 1 - t;
			const [cx, cz] = control ?? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
			curve.push([
				u * u * from[0] + 2 * u * t * cx + t * t * to[0],
				u * u * from[1] + 2 * u * t * cz + t * t * to[1],
				from[2] + (to[2] - from[2]) * t,
			]);
		}
		curve.push(to);
		outline.push(...curve.slice(1, -1));
		edges.push(curve);
	});

	const vertices: TRoadPoint[] = [[px, pz, ph], ...outline];
	const indices: number[] = [];
	for (let i = 0; i < outline.length; i++) {
		const [b, c] = [1 + i, 1 + ((i + 1) % outline.length)];
		const [vb, vc] = [vertices[b], vertices[c]];
		// Up is +Y; on the x-z plane seen from above, a triangle faces up when wound this way.
		const facesUp = (vb[1] - pz) * (vc[0] - px) - (vb[0] - px) * (vc[1] - pz) > 0;
		indices.push(...(facesUp ? [0, b, c] : [0, c, b]));
	}
	const paved = cuts.find((cut) => ROAD_KINDS[cut.road.kind].centreLine) ?? cuts[0];
	return { vertices, indices, edges, colorRoadId: paved.road.id };
};

/** The nearest point on a road's straight lines between its control points, and which line. */
export const nearestOnControlLines = (road: Pick<TRoad, "points" | "loops">, at: TVec2) => {
	const n = road.points.length;
	const count = road.loops && n > 2 ? n : n - 1;
	let best: { segment: number; point: TRoadPoint; gap: number; share: number } | null = null;
	for (let i = 0; i < count; i++) {
		const a = road.points[i];
		const b = road.points[(i + 1) % n];
		const dx = b[0] - a[0];
		const dz = b[1] - a[1];
		const len2 = dx * dx + dz * dz;
		const t =
			len2 === 0 ? 0 : Math.min(1, Math.max(0, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dz) / len2));
		const point = lerpPoint([a[0], a[1], a[2]], [b[0], b[1], b[2]], t);
		const gap = hypot2(point, at);
		if (!best || gap < best.gap) {
			best = { segment: i, point, gap, share: t };
		}
	}
	return best;
};

// Editing (ADR-0136). These change a world's roads and junctions in place, so the store runs
// them on its drafts; they never make a junction of fewer than two ends.

/** What the editing helpers read and change: a world's roads, junctions and objects. */
export interface IJunctionWorld {
	roads: TRoad[];
	junctions: TJunction[];
}

const sameEnd = (a: TJunctionEnd, roadId: string, end: TRoadEnd) =>
	a.roadId === roadId && a.end === end;

/** The junction (index) a road end is in, or -1. */
export const junctionIndexOf = (junctions: readonly TJunction[], roadId: string, end: TRoadEnd) =>
	junctions.findIndex((junction) => junction.ends.some((e) => sameEnd(e, roadId, end)));

/** Junctions left with fewer than two ends are removed. */
const dropSmall = (world: IJunctionWorld) => {
	if (world.junctions.some((junction) => junction.ends.length < 2)) {
		world.junctions = world.junctions.filter((junction) => junction.ends.length >= 2);
	}
};

/** A road end out of its junction (the road stays where it is). */
export const disconnectEnd = (world: IJunctionWorld, roadId: string, end: TRoadEnd) => {
	const index = junctionIndexOf(world.junctions, roadId, end);
	if (index < 0) {
		return;
	}
	const junction = world.junctions[index];
	junction.ends = junction.ends.filter((e) => !sameEnd(e, roadId, end));
	dropSmall(world);
};

/** Roads' ends out of every junction, as when the roads are deleted. */
export const disconnectRoads = (world: IJunctionWorld, roadIds: ReadonlySet<string>) => {
	for (const junction of world.junctions) {
		if (junction.ends.some((e) => roadIds.has(e.roadId))) {
			junction.ends = junction.ends.filter((e) => !roadIds.has(e.roadId));
		}
	}
	dropSmall(world);
};

/** Puts a road's end at a point, keeping that point's own width. */
const placeEnd = (road: TRoad, end: TRoadEnd, at: readonly number[]) => {
	const index = end === "start" ? 0 : road.points.length - 1;
	const point = road.points[index];
	if (point[0] === at[0] && point[1] === at[1] && point[2] === at[2]) {
		return;
	}
	road.points[index] =
		point.length > 3 ? [at[0], at[1], at[2], point[3] as number] : [at[0], at[1], at[2]];
};

/**
 * A road end connected to another road's end: into the junction that end is
 * in, or a new one of the two (`newId`). The connected end moves onto the other.
 * Returns the junction's id, or null if there's nothing to connect.
 */
export const connectEnds = (
	world: IJunctionWorld,
	from: { roadId: string; end: TRoadEnd },
	to: { roadId: string; end: TRoadEnd },
	newId: string,
) => {
	const road = world.roads.find((r) => r.id === from.roadId);
	const target = world.roads.find((r) => r.id === to.roadId);
	if (!road || !target || road.loops || target.loops) {
		return null;
	}
	if (from.roadId === to.roadId && from.end === to.end) {
		return null;
	}
	disconnectEnd(world, from.roadId, from.end);
	placeEnd(road, from.end, endPointOf(target, to.end));
	const index = junctionIndexOf(world.junctions, to.roadId, to.end);
	if (index >= 0) {
		world.junctions[index].ends.push({ roadId: from.roadId, end: from.end });
		return world.junctions[index].id;
	}
	world.junctions.push({
		id: newId,
		ends: [
			{ roadId: to.roadId, end: to.end },
			{ roadId: from.roadId, end: from.end },
		],
	});
	return newId;
};

/** A road's points cut in two at a point (kept by both halves), and where the second half begins. */
const cutPoints = (points: readonly TRoadPoint[], index: number) => ({
	first: points.slice(0, index + 1),
	second: points.slice(index),
});

/**
 * A road end connected to the middle of another road, as a T (ADR-0136): the
 * other road is cut in two at the nearest point on the line between its
 * control points `segment` and `segment + 1` (a new point there), the second
 * half a copy of it under `ids.road` (named with "(2)", as a split is), and a
 * junction (`ids.junction`) joins the cut and the end. A loop is opened there
 * instead of cut. Vehicles that start on the second half drive it, from where
 * they were. Returns the second half's id (the loop's own id when it was a loop).
 */
export const connectToMiddle = (
	world: IJunctionWorld & {
		entities: { follow: { roadId: string; startDistance: number } | null }[];
	},
	from: { roadId: string; end: TRoadEnd },
	to: { roadId: string; segment: number; point: TVec2 },
	ids: { road: string; junction: string },
) => {
	const road = world.roads.find((r) => r.id === from.roadId);
	const target = world.roads.find((r) => r.id === to.roadId);
	if (!road || !target || road.loops || from.roadId === to.roadId) {
		return null;
	}
	const n = target.points.length;
	const a = target.points[to.segment];
	const b = target.points[(to.segment + 1) % n];
	if (!a || !b) {
		return null;
	}
	const span = hypot2(a, b);
	const share = span === 0 ? 0 : Math.min(1, Math.max(0, hypot2(a, to.point) / span));
	const widthOf = (p: TRoadPoint) => (p.length > 3 ? (p[3] as number) : undefined);
	const [wa, wb] = [widthOf(a), widthOf(b)];
	const height = a[2] + (b[2] - a[2]) * share;
	const width =
		wa !== undefined || wb !== undefined
			? (wa ?? target.width) + ((wb ?? target.width) - (wa ?? target.width)) * share
			: undefined;
	const cut: TRoadPoint =
		width === undefined
			? [to.point[0], to.point[1], height]
			: [to.point[0], to.point[1], height, width];
	// The cut: a new point there, or the road's own point when it's on one.
	const points = [...target.points];
	let index = to.segment + 1;
	if (share < 1e-6) {
		index = to.segment;
	} else if (share > 1 - 1e-6) {
		index = (to.segment + 1) % n;
	} else {
		points.splice(index, 0, cut);
	}
	if (!target.loops && (index === 0 || index === points.length - 1)) {
		return null; // that's an end: connect to the end instead
	}
	const at = points[index];
	disconnectEnd(world, from.roadId, from.end);

	let secondId: string;
	const ends: TJunctionEnd[] = [];
	if (target.loops) {
		// Open the loop at the cut: it becomes both the start and the end.
		target.points = [...points.slice(index), ...points.slice(0, index), at];
		target.loops = false;
		secondId = target.id;
		ends.push({ roadId: target.id, end: "end" }, { roadId: target.id, end: "start" });
	} else {
		const { first, second } = cutPoints(points, index);
		const firstLength = polylineLength(centerlineOf({ ...target, points: first }), false);
		const copy: TRoad = {
			...(JSON.parse(JSON.stringify(target)) as TRoad),
			id: ids.road,
			name: target.name ? `${target.name} (2)` : "",
			points: second,
		};
		target.points = first;
		world.roads.splice(world.roads.indexOf(target) + 1, 0, copy);
		// The road's last end, if it was at a junction, is now the second half's.
		for (const junction of world.junctions) {
			for (const e of junction.ends) {
				if (sameEnd(e, target.id, "end")) {
					e.roadId = copy.id;
				}
			}
		}
		for (const entity of world.entities) {
			if (entity.follow?.roadId === target.id && entity.follow.startDistance > firstLength) {
				entity.follow.roadId = copy.id;
				entity.follow.startDistance -= firstLength;
			}
		}
		secondId = copy.id;
		ends.push({ roadId: target.id, end: "end" }, { roadId: copy.id, end: "start" });
	}
	placeEnd(road, from.end, at);
	world.junctions.push({
		id: ids.junction,
		ends: [...ends, { roadId: from.roadId, end: from.end }],
	});
	return secondId;
};

/** Where a road could be connected to: one of its ends, or a place along it (to cut it there). */
export type TRoadAnchor =
	| { kind: "end"; roadId: string; end: TRoadEnd; point: TRoadPoint }
	| { kind: "middle"; roadId: string; segment: number; point: TRoadPoint };

/**
 * The road end or the place along a road at a spot, for connecting to it
 * (ADR-0136): the nearest open road end within `endReach`, else a road whose
 * surface is under the spot (`onRoad`) or whose line between two control points
 * passes within `lineReach` of it, at the nearest place on that line (cutting
 * there keeps the rest of the road's shape). Roads in `except` are left out.
 */
export const roadAnchorAt = (
	roads: readonly TRoad[],
	at: TVec2,
	{
		endReach,
		lineReach = 0,
		onRoad = false,
		except = [],
	}: { endReach: number; lineReach?: number; onRoad?: boolean; except?: readonly string[] },
): TRoadAnchor | null => {
	let best: TRoadAnchor | null = null;
	let bestGap = endReach;
	for (const road of roads) {
		if (road.loops || road.points.length < 2 || except.includes(road.id)) {
			continue;
		}
		for (const end of ["start", "end"] as const) {
			const point = endPointOf(road, end);
			const gap = hypot2(point, at);
			if (gap <= bestGap) {
				best = { kind: "end", roadId: road.id, end, point: [point[0], point[1], point[2]] };
				bestGap = gap;
			}
		}
	}
	if (best) {
		return best;
	}
	let nearest = Number.POSITIVE_INFINITY;
	for (const road of roads) {
		if (road.points.length < 2 || except.includes(road.id)) {
			continue;
		}
		const line = nearestOnControlLines(road, at);
		if (!line) {
			continue;
		}
		let gap = line.gap;
		if (onRoad) {
			const visible = projectOntoRoad(road, at);
			if (!visible || visible.gap > visible.halfWidth) {
				continue;
			}
			gap = visible.gap;
		} else if (gap > lineReach) {
			continue;
		}
		// Not right at an end: that's for the ends above.
		const ends = road.loops ? [] : [road.points[0], road.points[road.points.length - 1]];
		if (ends.some((point) => hypot2(point, line.point) < Math.max(endReach, 1e-6))) {
			continue;
		}
		if (gap < nearest) {
			nearest = gap;
			best = { kind: "middle", roadId: road.id, segment: line.segment, point: line.point };
		}
	}
	return best;
};

/** After a road is split at a point: its last end, if at a junction, is now the second road's. */
export const junctionsAfterSplit = (world: IJunctionWorld, roadId: string, secondId: string) => {
	for (const junction of world.junctions) {
		for (const e of junction.ends) {
			if (sameEnd(e, roadId, "end")) {
				e.roadId = secondId;
			}
		}
	}
};

/**
 * After two roads are joined end to end (`joinedPoints`: `a` turned so its
 * joined end is last, then `b` from its joined end): the joined ends leave
 * their junctions, `a`'s other end is its start, and `b`'s other end is `a`'s
 * end. A road's own two ends joined into a loop leave theirs.
 */
export const junctionsAfterJoin = (
	world: IJunctionWorld,
	aId: string,
	aEnd: TRoadEnd,
	bId: string,
	bEnd: TRoadEnd,
) => {
	disconnectEnd(world, aId, aEnd);
	disconnectEnd(world, bId, bEnd);
	if (aId === bId) {
		disconnectEnd(world, aId, otherEnd(aEnd));
		return;
	}
	for (const junction of world.junctions) {
		for (const e of junction.ends) {
			if (sameEnd(e, aId, otherEnd(aEnd))) {
				e.end = "start";
			} else if (sameEnd(e, bId, otherEnd(bEnd))) {
				e.roadId = aId;
				e.end = "end";
			}
		}
	}
};

/** Whether two points are at the same place, altitude included. */
const samePlace = (a: readonly number[] | undefined, b: readonly number[] | undefined) =>
	a !== undefined &&
	b !== undefined &&
	Math.abs(a[0] - b[0]) < 1e-9 &&
	Math.abs(a[1] - b[1]) < 1e-9 &&
	Math.abs(a[2] - b[2]) < 1e-9;

/**
 * Junctions kept whole and together after any change to the roads (the
 * store's `commit` runs it, so every edit does): ends of roads that are gone
 * or loop leave, repeats go, a junction of fewer than two ends is removed, and
 * every end is put where the junction is now: at the end that moved in this
 * change, else at its first end. An end that wasn't with the others before and
 * is further than its road's width from them now leaves instead of jumping.
 */
export const settleJunctions = (before: IJunctionWorld, after: IJunctionWorld) => {
	const beforeRoads = new Map(before.roads.map((road) => [road.id, road]));
	const afterRoads = new Map(after.roads.map((road) => [road.id, road]));
	const beforeJunctions = new Map(before.junctions.map((junction) => [junction.id, junction]));
	const seen = new Set<string>();
	for (const junction of after.junctions) {
		const ends = junction.ends.filter((e) => {
			const road = afterRoads.get(e.roadId);
			const key = keyOf(e.roadId, e.end);
			if (!road || road.loops || road.points.length < 2 || seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
		if (ends.length !== junction.ends.length) {
			junction.ends = ends;
		}
		if (ends.length < 2) {
			continue;
		}
		const pointOf = (roads: Map<string, TRoad>, e: TJunctionEnd) => {
			const road = roads.get(e.roadId);
			return road ? endPointOf(road, e.end) : undefined;
		};
		const moved = ends.find((e) => !samePlace(pointOf(beforeRoads, e), pointOf(afterRoads, e)));
		const lead = moved ?? ends[0];
		const place = pointOf(afterRoads, lead) as TRoadPoint;
		const was = beforeJunctions.get(junction.id);
		const placeBefore = was?.ends[0] ? pointOf(beforeRoads, was.ends[0]) : undefined;
		const leaving = new Set<TJunctionEnd>();
		for (const e of ends) {
			if (e === lead) {
				continue;
			}
			const road = afterRoads.get(e.roadId) as TRoad;
			const now = endPointOf(road, e.end);
			const reach = Math.max(road.width, 0.5);
			const wasWith =
				!was ||
				placeBefore === undefined ||
				hypot2(pointOf(beforeRoads, e) ?? now, placeBefore) <= reach;
			if (wasWith || hypot2(now, place) <= reach) {
				placeEnd(road, e.end, place);
			} else {
				leaving.add(e);
			}
		}
		if (leaving.size > 0) {
			junction.ends = ends.filter((e) => !leaving.has(e));
		}
	}
	dropSmall(after);
};
