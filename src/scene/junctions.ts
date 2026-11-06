import { choicesAfterInsert, choicesAfterSplit } from "./pillarChoices";
import {
	isHiddenRoute,
	PILLAR_MIN,
	polylineLength,
	ROAD_KINDS,
	type TRoadEnd,
	throughPointsAt,
} from "./roads";
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
	/** Whether its road is driven only in the order of its points (ADR-0148). */
	isOneWay: boolean;
	/** The ends vehicles arriving by this one may leave by, or null for any the rules allow (ADR-0148). */
	leadsTo: readonly { roadId: string; end: TRoadEnd }[] | null;
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
	/**
	 * Whether any of its roads is one-way: an interchange's junction, where vehicles don't turn back
	 * through it and mostly carry straight on (ADR-0148). Otherwise they pick any way, as before.
	 */
	hasOneWayRoad: boolean;
	/** Whether, raised, it stands on pillars of its own (ADR-0148). */
	standsOnPillars: boolean;
	/**
	 * A gore (ADR-0148): a slip road joining or leaving a carriageway at a shallow angle, by the
	 * indices of its ends: the slip road's, the carriageway's end it runs beside, and how far along
	 * the slip road it has peeled away from it (where it's cut back). Null for every other junction.
	 */
	gore: { slip: number; beside: number; cut: number; deckLength: number } | null;
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

/** An end more than this above or below the junction's first end isn't joined to it (ADR-0148). */
export const ALTITUDE_GAP = 0.05;
/** Extra room past where roads stop overlapping, for the kerb's curve, as a share of the widest. */
const KERB = 0.45;
/** No end is cut back further than this many times the widest road's half width. */
const MOST_TRIM = 4;
/** A road's two cuts together take at most this share of its length. */
const MOST_OF_A_ROAD = 0.8;
/** How far the junction's surface reaches over each road's cut end, so no crack shows. */
const PAD_OVERLAP = 0.04;
/** Room left between the two roads at a gore's blunt end, as a share of the slip road's half width. */
const NOSE_GAP = 0.8;
/** How far a gore's painted lines keep in from its edges, and its chevrons' spacing and depth. */
const GORE_LINE_INSET = 0.08;
const CHEVRON_SPACING = 1.1;
const CHEVRON_DEPTH = 0.6;
/** Steps in each curve between two roads at a junction. */
const KERB_STEPS = 8;

const hypot2 = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const normalize = (a: TVec2): TVec2 => {
	const len = Math.hypot(a[0], a[1]);
	return len === 0 ? [1, 0] : [a[0] / len, a[1] / len];
};
/** Right-hand side, as `roads.ts` turns it: a quarter turn towards increasing angle. */
const rightOf = (f: TVec2): TVec2 => [-f[1], f[0]];

/** Whether a junction stands on pillars of its own (ADR-0148): raised, not a gore, and set to. */
export const standsOnOwnPillars = (junction: INetworkJunction | null) =>
	Boolean(junction?.standsOnPillars && !junction.gore && junction.place[2] >= PILLAR_MIN);

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

/** Ends this close to opposite (cosine) carry straight on: a carriageway through a gore. */
const IN_LINE = Math.cos((160 * Math.PI) / 180);
/** A slip road this close to the carriageway (cosine, 35°) runs beside it: a gore. */
const BESIDE = Math.cos((35 * Math.PI) / 180);

/**
 * Whether a junction's ends make a gore (ADR-0148), and which is the slip road and which the
 * carriageway end beside it: three drawn one-way roads, two of them in line (one arriving, one
 * leaving: the carriageway), and the third at a shallow angle to one of them, going the same way
 * (both leaving: a diverge; both arriving: a merge). Only one-way roads, which no world before
 * ADR-0148 had, so every older junction stays a pad.
 */
export const goreOf = (
	ends: readonly { direction: TVec2; end: TRoadEnd; isOneWay: boolean; isDrawn: boolean }[],
) => {
	if (ends.length !== 3 || ends.some((end) => !end.isOneWay || !end.isDrawn)) {
		return null;
	}
	const dot = (a: TVec2, b: TVec2) => a[0] * b[0] + a[1] * b[1];
	// The carriageway is the pair most nearly in line (a slip road can be nearly in line with one of
	// its ends too); the third end is the slip road.
	const pairs = [0, 1, 2]
		.map((slip) => {
			const [i, j] = [0, 1, 2].filter((k) => k !== slip);
			return { slip, i, j, straightness: dot(ends[i].direction, ends[j].direction) };
		})
		.filter(({ i, j, straightness }) => straightness <= IN_LINE && ends[i].end !== ends[j].end)
		.sort((a, b) => a.straightness - b.straightness);
	const best = pairs[0];
	if (!best) {
		return null;
	}
	const { slip, i, j } = best;
	for (const beside of [i, j]) {
		if (
			ends[beside].end === ends[slip].end &&
			dot(ends[beside].direction, ends[slip].direction) > BESIDE
		) {
			return { slip, beside };
		}
	}
	return null;
};

/**
 * How far along a slip road (from its end at a gore) it has peeled away from the carriageway beside
 * it: where their surfaces stop overlapping, its centre line half their widths from the other's.
 */
const peelDistance = (
	slip: TRoad,
	slipEnd: TRoadEnd,
	beside: TRoad,
	besideEnd: TRoadEnd,
	/** How much of the slip road's half width must be clear: 1 = all of it, -1 = its outer edge only. */
	slipShare = 1,
) => {
	const line = centerlineOf(slip);
	const ordered = slipEnd === "start" ? line : [...line].reverse();
	const other = centerlineOf(beside);
	const along = besideEnd === "start" ? other : [...other].reverse();
	const halfOf = (p: TRoadPoint, road: TRoad) => (p[3] ?? road.width) / 2;
	const gapTo = (p: TRoadPoint) => {
		let best = Number.POSITIVE_INFINITY;
		let half = beside.width / 2;
		for (let i = 1; i < along.length; i++) {
			const a = along[i - 1];
			const b = along[i];
			const dx = b[0] - a[0];
			const dz = b[1] - a[1];
			const len2 = dx * dx + dz * dz;
			const t =
				len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
			const gap = Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
			if (gap < best) {
				best = gap;
				half = halfOf(a, beside);
			}
		}
		return { gap: best, half };
	};
	const total = polylineLength(ordered, false);
	let travelled = 0;
	let before = { gap: 0, needed: 0, at: 0 };
	for (let i = 0; i < ordered.length; i++) {
		if (i > 0) {
			travelled += hypot2(ordered[i], ordered[i - 1]);
		}
		const { gap, half } = gapTo(ordered[i]);
		const needed = Math.max(0, half + halfOf(ordered[i], slip) * slipShare);
		if (gap >= needed) {
			// Between the last point that overlapped and this one.
			const over = before.needed - before.gap;
			const clear = gap - needed;
			const share = over + clear > 0 ? over / (over + clear) : 0;
			return Math.min(total * MOST_OF_A_ROAD, before.at + (travelled - before.at) * share);
		}
		before = { gap, needed, at: travelled };
	}
	return total * MOST_OF_A_ROAD;
};

/** One cross-section of a gore's deck: along the carriageway from the junction. */
interface IGoreSection {
	/** How far along the carriageway from the junction. */
	along: number;
	/** The carriageway's centre there, its direction and half its width. */
	centre: TRoadPoint;
	right: TVec2;
	half: number;
	/** How far out on the slip road's side the deck reaches (at least `half`), and its height there. */
	reach: number;
	reachHeight: number;
	/** How far out the slip road's inner edge is where it's outside the carriageway: the gore between. */
	inner: number | null;
}

/**
 * A gore's deck (ADR-0148): the carriageway from the junction to the nose (where the slip road
 * has peeled away from it), as wide as the carriageway and the slip road together wherever the slip
 * road's outer edge runs outside it. `side` is which side of the carriageway (right of its way from
 * the junction, 1, or left, -1) the slip road is on; `length` is how far along the carriageway the
 * nose is: there the carriageway's own surface takes over.
 */
const goreDeckOf = (
	slip: TRoad,
	slipEnd: TRoadEnd,
	beside: TRoad,
	besideEnd: TRoadEnd,
	cut: number,
) => {
	const full = centerlineOf(beside);
	const line = besideEnd === "start" ? full : [...full].reverse();
	const slipFull = centerlineOf(slip);
	const slipLine = slipEnd === "start" ? slipFull : [...slipFull].reverse();
	const slipPart = cutLine(slipLine, 0, Math.max(0, polylineLength(slipLine, false) - cut));
	const along = [0];
	for (let i = 1; i < line.length; i++) {
		along.push(along[i - 1] + hypot2(line[i], line[i - 1]));
	}
	/** Where a point lies against the carriageway: how far along it, and how far to its right. */
	const project = (p: readonly number[]) => {
		let best = { along: 0, lateral: 0, gap: Number.POSITIVE_INFINITY };
		for (let i = 1; i < line.length; i++) {
			const [a, b] = [line[i - 1], line[i]];
			const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
			const len = Math.hypot(dx, dz);
			if (len === 0) {
				continue;
			}
			const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len ** 2));
			const [x, z] = [a[0] + dx * t, a[1] + dz * t];
			const gap = Math.hypot(p[0] - x, p[1] - z);
			if (gap < best.gap) {
				const right = rightOf([dx / len, dz / len]);
				best = {
					along: along[i - 1] + len * t,
					lateral: (p[0] - x) * right[0] + (p[1] - z) * right[1],
					gap,
				};
			}
		}
		return best;
	};
	const tip = slipPart[slipPart.length - 1] ?? line[0];
	const side: -1 | 1 = project(tip).lateral >= 0 ? 1 : -1;
	/** One of the slip road's edges against the carriageway: 1 its outer edge, -1 its inner one. */
	const edgeOf = (edge: 1 | -1) =>
		slipPart.map((p, i) => {
			const [a, b] = [slipPart[Math.max(0, i - 1)], slipPart[Math.min(slipPart.length - 1, i + 1)]];
			const r = rightOf(normalize([b[0] - a[0], b[1] - a[1]]));
			const half = ((p[3] ?? slip.width) / 2) * side * edge;
			const placed = project([p[0] + r[0] * half, p[1] + r[1] * half]);
			return { along: placed.along, reach: placed.lateral * side, height: p[2] };
		});
	const outer = edgeOf(1);
	const inner = edgeOf(-1);
	// The nose: the slip road's cut end, square across it from its outer corner to its inner one
	// (further from the junction, as it leans away). The deck ends square across the carriageway at
	// the inner corner, and between the two roads there it's the gore's blunt end.
	const fallback = { along: 0, reach: 0, height: line[0][2] };
	const outerCorner = outer[outer.length - 1] ?? fallback;
	const innerCorner = inner[inner.length - 1] ?? outerCorner;
	const length = Math.max(0, outerCorner.along, innerCorner.along);
	/** Where one of the slip road's edges is (how far out, how high) at `s` along the carriageway. */
	const edgeAt = (edge: typeof outer, s: number) => {
		for (let i = 1; i < edge.length; i++) {
			const [a, b] = [edge[i - 1], edge[i]];
			if ((s >= a.along && s <= b.along) || (s <= a.along && s >= b.along)) {
				const t = b.along === a.along ? 0 : (s - a.along) / (b.along - a.along);
				return {
					reach: a.reach + (b.reach - a.reach) * t,
					height: a.height + (b.height - a.height) * t,
				};
			}
		}
		return null;
	};
	/** The deck's edge on the slip road's side: the slip road's outer edge, then its cut end. */
	const outerAt = (s: number) => {
		const on = edgeAt(outer, s);
		if (on) {
			return on;
		}
		const across = innerCorner.along - outerCorner.along;
		if (s > outerCorner.along && across > 1e-6) {
			const t = Math.min(1, (s - outerCorner.along) / across);
			return {
				reach: outerCorner.reach + (innerCorner.reach - outerCorner.reach) * t,
				height: outerCorner.height + (innerCorner.height - outerCorner.height) * t,
			};
		}
		return null;
	};
	// The deck's edge on the slip road's side: the slip road's outer edge where it's outside the
	// carriageway's, eased in near the junction so it leaves the carriageway's edge without a kink
	// (a cubic from nothing, flat, to the slip road's edge, matching its slope where it takes over).
	const halfAt = (s: number) => (pointAlongLine(line, s)[3] ?? beside.width) / 2;
	const excessAt = (s: number) => {
		const out = outerAt(Math.max(0, Math.min(length, s)));
		return out ? out.reach - halfAt(s) : 0;
	};
	let leaves = length;
	for (let s = 0; s <= length; s += 0.1) {
		if (excessAt(s) > 1e-3) {
			leaves = s;
			break;
		}
	}
	const easeEnd = Math.min(length * 0.5, leaves + 2 * slip.width);
	const easeTo = excessAt(easeEnd);
	const easeSlope = (excessAt(easeEnd + 0.05) - excessAt(easeEnd - 0.05)) / 0.1;
	const ease =
		easeTo > 1e-3 && easeEnd > 1e-3
			? {
					a: (3 * easeTo - easeSlope * easeEnd) / easeEnd ** 2,
					b: (easeSlope * easeEnd - 2 * easeTo) / easeEnd ** 3,
				}
			: null;
	const excess = (s: number) =>
		ease && s < easeEnd ? Math.max(0, ease.a * s * s + ease.b * s ** 3) : Math.max(0, excessAt(s));
	const stations = new Set<number>([0, length, outerCorner.along]);
	for (let s = 0.25; s < length; s += 0.25) {
		stations.add(s);
	}
	for (const s of along) {
		if (s < length) {
			stations.add(s);
		}
	}
	const sections = [...stations]
		.filter((s) => s >= 0 && s <= length)
		.sort((a, b) => a - b)
		.map((s): IGoreSection => {
			const centre = pointAlongLine(line, s);
			const ahead = pointAlongLine(line, Math.min(s + 0.05, along[along.length - 1]));
			const behind = pointAlongLine(line, Math.max(s - 0.05, 0));
			const right = rightOf(normalize([ahead[0] - behind[0], ahead[1] - behind[1]]));
			const half = (centre[3] ?? beside.width) / 2;
			const out = outerAt(s);
			const reach = half + excess(s);
			const innerEdge = edgeAt(inner, s);
			return {
				along: s,
				centre,
				right,
				half,
				reach,
				reachHeight: out && out.reach > half ? out.height : centre[2],
				inner:
					s >= innerCorner.along - 1e-6
						? innerCorner.reach
						: innerEdge && innerEdge.reach > half
							? Math.min(innerEdge.reach, reach)
							: null,
			};
		});
	return {
		length,
		side,
		sections,
		slipHalf: slip.width / 2,
		/** How far along the slip road's outer corner is: from there its cut end crosses the deck. */
		outerAlong: outerCorner.along,
		// Which way traffic goes along it: towards the junction at a merge, away at a diverge.
		travel: (besideEnd === "end" ? -1 : 1) as -1 | 1,
	};
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
		const ends: { road: TRoad; end: TRoadEnd; leadsTo: INetworkEnd["leadsTo"] }[] = [];
		for (const { roadId, end, leadsTo = null } of junction.ends) {
			const road = byId.get(roadId);
			if (!road || road.loops || road.points.length < 2 || used.has(keyOf(roadId, end))) {
				continue;
			}
			const point = endPointOf(road, end);
			if (place === null) {
				place = [point[0], point[1], point[2]];
			} else if (
				hypot2(point, place) > Math.max(road.width, 0.5) ||
				// Ends at another altitude are left out too (ADR-0148): a pad can't join them, it drew a wall.
				Math.abs(point[2] - place[2]) > ALTITUDE_GAP
			) {
				continue;
			}
			used.add(keyOf(roadId, end));
			ends.push({ road, end, leadsTo });
		}
		if (place === null || ends.length < 2) {
			for (const { road, end } of ends) {
				used.delete(keyOf(road.id, end));
			}
			continue;
		}
		const shaped = ends.map(({ road, end, leadsTo }) => {
			const line = centerlineOf(road);
			const at = end === "start" ? line[0] : line[line.length - 1];
			return {
				roadId: road.id,
				end,
				direction: directionAt(line, end),
				halfWidth: (at[3] ?? road.width) / 2,
				isDrawn: !isHiddenRoute(road.kind),
				isOneWay: road.isOneWay ?? false,
				leadsTo,
			};
		});
		// A slip road joining or leaving a carriageway (ADR-0148): the carriageway isn't cut, and the
		// slip road is cut back to where it has peeled away from it; the gore between is its surface.
		const gore = goreOf(shaped);
		if (gore) {
			const slip = shaped[gore.slip];
			const beside = shaped[gore.beside];
			const cut = peelDistance(
				byId.get(slip.roadId) as TRoad,
				slip.end,
				byId.get(beside.roadId) as TRoad,
				beside.end,
				1 + NOSE_GAP,
			);
			// The carriageway beside it is cut back to the nose too: the deck between is the gore's own,
			// one surface the width of both (ADR-0148).
			const deck = goreDeckOf(
				byId.get(slip.roadId) as TRoad,
				slip.end,
				byId.get(beside.roadId) as TRoad,
				beside.end,
				cut,
			);
			built.push({
				id: junction.id,
				place,
				hasOneWayRoad: true,
				standsOnPillars: junction.standsOnPillars ?? false,
				gore: { slip: gore.slip, beside: gore.beside, cut, deckLength: deck.length },
				ends: shaped.map((end, i) => ({
					...end,
					routeTrim: i === gore.slip ? cut : 0,
					// Both reach a little under the deck, so no crack shows where it meets them.
					drawTrim:
						i === gore.slip
							? Math.max(0, cut - PAD_OVERLAP)
							: i === gore.beside
								? Math.max(0, deck.length - PAD_OVERLAP)
								: 0,
				})),
			});
			continue;
		}
		const routeTrims = trimsAtJunction(shaped);
		const drawn = shaped.filter((end) => end.isDrawn);
		const drawTrims = trimsAtJunction(drawn);
		built.push({
			id: junction.id,
			place,
			hasOneWayRoad: shaped.some((end) => end.isOneWay),
			standsOnPillars: junction.standsOnPillars ?? false,
			gore: null,
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
	/** Edges a raised one has railings along (a gore's outer edge, ADR-0148); none for a pad. */
	railingEdges?: TRoadPoint[][];
	/** Lines painted on it, as centre lines of dashes to draw: a gore's lane line (ADR-0148). */
	laneLines?: TRoadPoint[][];
	/** Solid lines painted on it: a gore's edges and chevrons (ADR-0148). */
	paintedLines?: TRoadPoint[][];
	/** The road it takes its colour from: its first paved road, else its first drawn road. */
	colorRoadId: string;
}

/** A gore's deck (ADR-0148), for its pillars: its cross-sections and its carriageway. */
export const goreDeckAt = (network: IRoadNetwork, junction: INetworkJunction) => {
	const gore = junction.gore;
	if (!gore) {
		return null;
	}
	const slipEnd = junction.ends[gore.slip];
	const besideEnd = junction.ends[gore.beside];
	const slip = network.roadById(slipEnd.roadId);
	const beside = network.roadById(besideEnd.roadId);
	return slip && beside
		? { beside, ...goreDeckOf(slip, slipEnd.end, beside, besideEnd.end, gore.cut) }
		: null;
};

/**
 * A gore's surface (ADR-0148): one deck, the carriageway from the junction to the nose, widened
 * wherever the slip road runs outside it, so the two are one road surface, not two decks pushed
 * into each other. Both its long edges are the deck's edges (walls, underside and railings when
 * raised); between the two roads at the nose it ends bluntly (a wall and a railing across when
 * raised). On it a painted gore runs back from the nose to where the roads' edges meet, and a lane
 * line on from there along the carriageway's edge while the slip road's lane lies beside it.
 * The carriageway and the slip road are cut back to the nose, where their own surfaces take over.
 */
const gorePad = (
	network: IRoadNetwork,
	junction: INetworkJunction,
	gore: { slip: number; beside: number; cut: number },
): IJunctionPad | null => {
	const slipEnd = junction.ends[gore.slip];
	const besideEnd = junction.ends[gore.beside];
	const slip = network.roadById(slipEnd.roadId);
	const beside = network.roadById(besideEnd.roadId);
	if (!slip || !beside || gore.cut <= 1e-3) {
		return null;
	}
	const deck = goreDeckOf(slip, slipEnd.end, beside, besideEnd.end, gore.cut);
	const { sections, side } = deck;
	if (sections.length < 2) {
		return null;
	}
	const point = (section: IGoreSection, lateral: number, height: number): TRoadPoint => [
		section.centre[0] + section.right[0] * lateral,
		section.centre[1] + section.right[1] * lateral,
		height,
	];
	/** The section at `s` along, between the two worked out either side of it. */
	const sectionAt = (s: number): IGoreSection => {
		const i = sections.findIndex((each) => each.along >= s);
		if (i <= 0) {
			return sections[i === 0 ? 0 : sections.length - 1];
		}
		const [a, b] = [sections[i - 1], sections[i]];
		const t = b.along === a.along ? 0 : (s - a.along) / (b.along - a.along);
		const mix = (x: number, y: number) => x + (y - x) * t;
		return {
			along: s,
			centre: lerpPoint(a.centre, b.centre, t),
			right: normalize([mix(a.right[0], b.right[0]), mix(a.right[1], b.right[1])]),
			half: mix(a.half, b.half),
			reach: mix(a.reach, b.reach),
			reachHeight: mix(a.reachHeight, b.reachHeight),
			inner: a.inner !== null && b.inner !== null ? mix(a.inner, b.inner) : null,
		};
	};
	/** A point on the deck's surface: `out` from the carriageway's centre towards the slip road. */
	const onDeck = (s: number, out: number): TRoadPoint => {
		const section = sectionAt(s);
		const t = (out + section.half) / Math.max(1e-6, section.reach + section.half);
		const height = section.centre[2] + (section.reachHeight - section.centre[2]) * t;
		return point(section, side * out, height);
	};
	const far = sections.map((s) => point(s, -side * s.half, s.centre[2]));
	const near = sections.map((s) => point(s, side * s.reach, s.reachHeight));
	const n = sections.length;
	const [px, pz, ph] = junction.place;
	const vertices: TRoadPoint[] = [[px, pz, ph], ...far, ...[...near].reverse()];
	const indices: number[] = [];
	const up = (i0: number, i1: number, i2: number) => {
		const [a, b, c] = [vertices[i0], vertices[i1], vertices[i2]];
		const facesUp = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0;
		indices.push(...(facesUp ? [i0, i1, i2] : [i0, i2, i1]));
	};
	for (let i = 0; i < n - 1; i++) {
		const [f0, f1] = [1 + i, 2 + i];
		const [n0, n1] = [1 + (2 * n - 1 - i), 1 + (2 * n - 2 - i)];
		up(f0, f1, n1);
		up(f0, n1, n0);
	}
	// The blunt end between the two roads at the nose, from the carriageway's edge to the slip road's.
	const last = sections[n - 1];
	const nose =
		last.inner !== null && last.inner > last.half + 1e-3
			? [point(last, side * last.half, last.centre[2]), onDeck(last.along, last.inner)]
			: null;
	// The slip road's side up to its outer corner: past it, across the slip road's cut end, the deck
	// goes on as the slip road, so that's no edge.
	const outside = near.filter((_, i) => sections[i].along <= deck.outerAlong + 1e-6);
	// Its edges go round it one way (the deck's walls face out on their left): along the far edge
	// from the junction, across the nose and back along the slip road's side; the other way round
	// when the slip road is on the left.
	const edges =
		side > 0
			? [far, ...(nose ? [nose] : []), [...outside].reverse()]
			: [[...far].reverse(), ...(nose ? [[...nose].reverse()] : []), outside];

	// The painted gore (ADR-0148): from the nose, a solid line along each road's edge to where they
	// meet, chevrons between pointing the way traffic goes, then a dashed lane line along the
	// carriageway's edge for as long as the slip road's lane lies beside it.
	const inset = GORE_LINE_INSET;
	const widthAt = (s: number) => {
		const inner = sectionAt(s).inner;
		return inner === null ? 0 : inner - sectionAt(s).half - 2 * inset;
	};
	// Where the two lines meet: going back from the nose, the first place the gore closes.
	let meet = last.along;
	for (let i = n - 1; i >= 0; i--) {
		const width = sections[i].inner === null ? -1 : widthAt(sections[i].along);
		if (width <= 0) {
			const after = sections[Math.min(n - 1, i + 1)];
			const wAfter = widthAt(after.along);
			meet =
				wAfter > 0 && after.along > sections[i].along
					? sections[i].along + ((after.along - sections[i].along) * -width) / (wAfter - width)
					: after.along;
			break;
		}
		meet = sections[i].along;
	}
	const end = last.along - inset;
	const painted: TRoadPoint[][] = [];
	if (end - meet > 0.2) {
		const stations = [
			meet,
			...sections.map((s) => s.along).filter((s) => s > meet && s < end),
			end,
		];
		const edgeOut = (s: number) => sectionAt(s).half + inset;
		const innerOut = (s: number) => Math.max(edgeOut(s), (sectionAt(s).inner ?? 0) - inset);
		painted.push(stations.map((s) => onDeck(s, edgeOut(s))));
		painted.push(stations.map((s) => onDeck(s, innerOut(s))));
		// Chevrons from the nose back, each an arrowhead pointing the way traffic goes, its arms back
		// to the lines.
		const first = end - 0.3 - (deck.travel < 0 ? CHEVRON_DEPTH : 0);
		for (let tip = first; tip > meet; tip -= CHEVRON_SPACING) {
			const arms = tip - deck.travel * CHEVRON_DEPTH;
			if (arms < meet || arms > end || Math.min(widthAt(arms), widthAt(tip)) < 0.2) {
				continue;
			}
			const middle = (edgeOut(tip) + innerOut(tip)) / 2;
			const apex = onDeck(tip, middle);
			painted.push([onDeck(arms, edgeOut(arms) + 0.05), apex]);
			painted.push([apex, onDeck(arms, innerOut(arms) - 0.05)]);
		}
	}
	// The lane line: along the carriageway's edge, where the slip road's lane lies beside it.
	const besideLane = sections.filter((s) => s.along <= meet && s.reach - s.half > deck.slipHalf);
	const laneLine = besideLane.map((s) => onDeck(s.along, s.half));
	const lastBeside = besideLane[besideLane.length - 1];
	if (lastBeside && painted.length > 0 && lastBeside.along < meet - 1e-3) {
		laneLine.push(onDeck(meet, sectionAt(meet).half));
	}
	const railed = slip.showsRailings || beside.showsRailings;
	return {
		vertices,
		indices,
		edges,
		railingEdges: railed ? edges : [],
		laneLines: laneLine.length > 1 ? [laneLine] : [],
		paintedLines: painted,
		colorRoadId: beside.id,
	};
};

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
	if (junction.gore) {
		return gorePad(network, junction, junction.gore);
	}
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
	// Raised, its kerbs between the roads carry on their railings (ADR-0148).
	const railed = cuts.some((cut) => cut.road.showsRailings);
	return {
		vertices,
		indices,
		edges,
		railingEdges: railed ? edges : [],
		colorRoadId: paved.road.id,
	};
};

/** The nearest point on a road's straight lines between its control points, and which line. */
export const nearestOnControlLines = (
	road: Pick<TRoad, "points" | "loops"> & Partial<Pick<TRoad, "curveShape">>,
	at: TVec2,
) => {
	const n = road.points.length;
	const count = road.loops && n > 2 ? n : n - 1;
	let best: { segment: number; point: TRoadPoint; gap: number; share: number } | null = null;
	// A smooth road (ADR-0148): the nearest place on its curve, so a point put there keeps its shape.
	if (road.curveShape === "throughPoints") {
		const pts = road.points.map((p): TRoadPoint => [p[0], p[1], p[2] ?? 0]);
		for (let i = 0; i < count; i++) {
			const a = road.points[i];
			const b = road.points[(i + 1) % n];
			for (let s = 0; s <= 32; s++) {
				const t = s / 32;
				const [x, z] = throughPointsAt(pts, road.loops && n > 2, i, t);
				const point: TRoadPoint = [x, z, a[2] + (b[2] - a[2]) * t];
				const gap = hypot2(point, at);
				if (!best || gap < best.gap) {
					best = { segment: i, point, gap, share: t };
				}
			}
		}
		return best;
	}
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

const sameEnd = (a: { roadId: string; end: TRoadEnd }, roadId: string, end: TRoadEnd) =>
	a.roadId === roadId && a.end === end;

/** A road end newly at a junction: vehicles arriving by it may go any way the rules allow. */
const newEnd = (roadId: string, end: TRoadEnd): TJunctionEnd => ({ roadId, end, leadsTo: null });

/**
 * Every mention of a road end at the junctions, as an end and in other ends' `leadsTo` (ADR-0148),
 * renamed by `rename` (which returns the new end, or undefined to leave it), as when a road is
 * split, joined or turned round. Each mention is renamed once, from what it was before.
 */
const renameEnds = (
	world: IJunctionWorld,
	rename: (roadId: string, end: TRoadEnd) => { roadId: string; end: TRoadEnd } | undefined,
) => {
	const apply = (e: { roadId: string; end: TRoadEnd }) => {
		const to = rename(e.roadId, e.end);
		if (to) {
			e.roadId = to.roadId;
			e.end = to.end;
		}
	};
	for (const junction of world.junctions) {
		for (const e of junction.ends) {
			apply(e);
			for (const to of e.leadsTo ?? []) {
				apply(to);
			}
		}
	}
};

/** `leadsTo` no longer naming ends that left a junction (ADR-0148). */
const forgetLeavers = (junction: TJunction) => {
	for (const e of junction.ends) {
		if (e.leadsTo?.some((to) => !junction.ends.some((o) => sameEnd(o, to.roadId, to.end)))) {
			e.leadsTo = e.leadsTo.filter((to) =>
				junction.ends.some((o) => sameEnd(o, to.roadId, to.end)),
			);
		}
	}
};

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
	forgetLeavers(junction);
	dropSmall(world);
};

/** Roads' ends out of every junction, as when the roads are deleted. */
export const disconnectRoads = (world: IJunctionWorld, roadIds: ReadonlySet<string>) => {
	for (const junction of world.junctions) {
		if (junction.ends.some((e) => roadIds.has(e.roadId))) {
			junction.ends = junction.ends.filter((e) => !roadIds.has(e.roadId));
			forgetLeavers(junction);
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
		world.junctions[index].ends.push(newEnd(from.roadId, from.end));
		return world.junctions[index].id;
	}
	world.junctions.push({
		id: newId,
		// New in the editor: a raised junction stands on pillars of its own (ADR-0148).
		standsOnPillars: true,
		ends: [newEnd(to.roadId, to.end), newEnd(from.roadId, from.end)],
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
		target.pillarsAtPoints = choicesAfterInsert(target.pillarsAtPoints ?? [], index);
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
		target.pillarsAtPoints = target.pillarsAtPoints.map((choice) => ({
			...choice,
			pointIndex: (choice.pointIndex - index + points.length) % points.length,
		}));
		secondId = target.id;
		ends.push(newEnd(target.id, "end"), newEnd(target.id, "start"));
	} else {
		const { first, second } = cutPoints(points, index);
		const firstLength = polylineLength(centerlineOf({ ...target, points: first }), false);
		const copy: TRoad = {
			...(JSON.parse(JSON.stringify(target)) as TRoad),
			id: ids.road,
			name: target.name ? `${target.name} (2)` : "",
			points: second,
		};
		[target.pillarsAtPoints, copy.pillarsAtPoints] = choicesAfterSplit(
			target.pillarsAtPoints,
			index,
		);
		target.points = first;
		world.roads.splice(world.roads.indexOf(target) + 1, 0, copy);
		// The road's last end, if it was at a junction, is now the second half's.
		renameEnds(world, (roadId, end) =>
			roadId === target.id && end === "end" ? { roadId: copy.id, end } : undefined,
		);
		for (const entity of world.entities) {
			if (entity.follow?.roadId === target.id && entity.follow.startDistance > firstLength) {
				entity.follow.roadId = copy.id;
				entity.follow.startDistance -= firstLength;
			}
		}
		secondId = copy.id;
		ends.push(newEnd(target.id, "end"), newEnd(copy.id, "start"));
	}
	placeEnd(road, from.end, at);
	world.junctions.push({
		id: ids.junction,
		// New in the editor: a raised junction stands on pillars of its own (ADR-0148).
		standsOnPillars: true,
		ends: [...ends, newEnd(from.roadId, from.end)],
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
	renameEnds(world, (id, end) =>
		id === roadId && end === "end" ? { roadId: secondId, end } : undefined,
	);
};

/** After a road is turned round (ADR-0148): its start is its end and its end its start. */
export const junctionsAfterReverse = (world: IJunctionWorld, roadId: string) => {
	renameEnds(world, (id, end) => (id === roadId ? { roadId, end: otherEnd(end) } : undefined));
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
	renameEnds(world, (id, end) =>
		sameEnd({ roadId: id, end }, aId, otherEnd(aEnd))
			? { roadId: aId, end: "start" }
			: sameEnd({ roadId: id, end }, bId, otherEnd(bEnd))
				? { roadId: aId, end: "end" }
				: undefined,
	);
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
	for (const junction of after.junctions) {
		forgetLeavers(junction);
	}
	dropSmall(after);
};
