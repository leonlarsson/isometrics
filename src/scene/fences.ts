import { round } from "#/lib/math";

import { roadCenterline } from "./roads";
import type { TFence, TFenceGate, TVec2 } from "./schema";

/**
 * Where a fence's posts stand, what runs between them and where its gates
 * are, framework-free so it is unit-tested (ADR-0103, ADR-0133). A fence is a
 * line of points, rounded like a road (`roadCenterline`); its looks
 * (src/fences/) draw on this layout.
 */

/** Corners sharper than this (degrees of turn) always get a post. */
export const CORNER_ANGLE = 20;
/** How far apart the ground is looked at along a span, to find steps (cliff edges). */
const GROUND_SAMPLE = 0.25;
/** A rise or drop between two looks at the ground bigger than this is a step: a post stands at it. */
export const GROUND_STEP = 0.15;

/** A post: where it stands, and the fence's height arriving at it and leaving it. */
export interface IFencePost {
	x: number;
	z: number;
	/** Bottom of the fence on the side it comes from (the ground there, plus the lift). */
	baseBefore: number;
	/** Bottom of the fence on the side it goes on to: the same, except at a step in the ground. */
	baseAfter: number;
	/** The way the fence runs here, a unit vector on the ground (the middle of the two at a corner). */
	direction: TVec2;
	/** Distance from the fence's start, along the ground. */
	distance: number;
}

/** A straight piece of fence from one post to the next. */
export interface IFenceSpan {
	/** Start [x, base, z]: the ground there plus the lift. */
	from: [number, number, number];
	to: [number, number, number];
	/** Its length along the ground. */
	length: number;
	/** The way it runs, a unit vector on the ground. */
	direction: TVec2;
}

/** A gate's place (ADR-0133): straight across from the post at one side of it to the post at the other. */
export interface IFenceGatePlace {
	/** Which of the fence's gates it is. */
	index: number;
	/** Its side nearer the fence's start, [x, base, z]: the ground there plus the lift. */
	from: [number, number, number];
	to: [number, number, number];
	/** Straight across, along the ground. */
	length: number;
	/** The way across, a unit vector on the ground. */
	direction: TVec2;
}

export interface IFenceLayout {
	posts: IFencePost[];
	/** The fence between its posts; none across its gates. */
	spans: IFenceSpan[];
	/** Its gates and gaps that are built, each between two posts. */
	gates: IFenceGatePlace[];
	/** Length along the ground of the whole line, built or not. */
	length: number;
}

/** What a fence's layout reads: its line, and where its gates are (none if left out). */
export type TFenceLine = Pick<TFence, "points" | "loops" | "cornerRadius"> & {
	gates?: readonly Pick<TFenceGate, "spanIndex" | "alongShare" | "width">[];
};

/** Nothing to lay out. */
const noLayout = (length: number): IFenceLayout => ({ posts: [], spans: [], gates: [], length });

const unit = (dx: number, dz: number): TVec2 => {
	const length = Math.hypot(dx, dz);
	return length < 1e-9 ? [1, 0] : [dx / length, dz / length];
};

/**
 * The stretches between a fence's points as drawn, straight, each [from, to]:
 * the one from its first point to its second first, and on a loop the one
 * from its last point back to the first last. A gate's `spanIndex` counts them.
 */
export const fenceStretches = (fence: Pick<TFence, "points" | "loops">) => {
	const { points } = fence;
	const count = fence.loops && points.length > 2 ? points.length : points.length - 1;
	return Array.from(
		{ length: Math.max(0, count) },
		(_, i) => [points[i], points[(i + 1) % points.length]] as const,
	);
};

/** The nearest place on a line of [x, z, …] points to a spot: on which segment, how far along it, how far off. */
const nearestOnLine = (line: readonly (readonly number[])[], [x, z]: readonly number[]) => {
	let best = { segment: 0, share: 0, offset: Number.POSITIVE_INFINITY };
	for (let i = 0; i < line.length - 1; i++) {
		const [a, b] = [line[i], line[i + 1]];
		const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
		const lengthSquared = dx * dx + dz * dz;
		const share =
			lengthSquared < 1e-12
				? 0
				: Math.min(1, Math.max(0, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared));
		const offset = Math.hypot(a[0] + dx * share - x, a[1] + dz * share - z);
		if (offset < best.offset - 1e-9) {
			best = { segment: i, share, offset };
		}
	}
	return best;
};

/** Where a gate's middle is on the ground, on its stretch as drawn (one past the last is on the last). */
export const gateSpot = (
	fence: Pick<TFence, "points" | "loops">,
	gate: Pick<TFenceGate, "spanIndex" | "alongShare">,
): TVec2 | null => {
	const stretches = fenceStretches(fence);
	const stretch = stretches[Math.min(Math.max(0, gate.spanIndex), stretches.length - 1)];
	if (!stretch) {
		return null;
	}
	const [a, b] = stretch;
	const t = Math.min(1, Math.max(0, gate.alongShare));
	return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
};

/** The place on a fence's stretches nearest a spot: which stretch, how far along it, and how far off it is. */
export const gatePlaceAt = (fence: Pick<TFence, "points" | "loops">, spot: readonly number[]) => {
	const stretches = fenceStretches(fence);
	if (stretches.length === 0) {
		return null;
	}
	const line = [...stretches.map(([a]) => a), stretches[stretches.length - 1][1]];
	const { segment, share, offset } = nearestOnLine(line, spot);
	return { spanIndex: segment, alongShare: round(share), offset };
};

/**
 * A fence's gates once its points change (a point added or taken out, the
 * fence split, joined or opened; ADR-0133): each stays where it stood on the
 * ground, on whichever of `onto` (the fences it is now part of) passes nearest
 * there. Returns the gates for each of `onto`, in its order.
 */
export const gatesMovedOnto = <G extends Pick<TFenceGate, "spanIndex" | "alongShare">>(
	before: Pick<TFence, "points" | "loops"> & { gates: readonly G[] },
	onto: readonly Pick<TFence, "points" | "loops">[],
): G[][] => {
	const homes: G[][] = onto.map(() => []);
	for (const gate of before.gates) {
		const spot = gateSpot(before, gate);
		if (!spot) {
			continue;
		}
		let home = -1;
		let nearest = { spanIndex: 0, alongShare: 0, offset: Number.POSITIVE_INFINITY };
		for (let i = 0; i < onto.length; i++) {
			const place = gatePlaceAt(onto[i], spot);
			if (place && place.offset < nearest.offset - 1e-9) {
				home = i;
				nearest = place;
			}
		}
		if (home >= 0) {
			homes[home].push({ ...gate, spanIndex: nearest.spanIndex, alongShare: nearest.alongShare });
		}
	}
	return homes;
};

/** The fence's line as [x, z, lift], closed loops ending where they start. */
const fenceLine = (fence: TFenceLine) => {
	const line = roadCenterline(fence.points, fence.loops, fence.cornerRadius);
	if (fence.loops && line.length > 2) {
		line.push(line[0]);
	}
	return line;
};

/**
 * Posts, spans and gates of a fence (ADR-0103, ADR-0133):
 * - a post at each end and at every corner sharper than CORNER_ANGLE, and the
 *   runs between shared out evenly, no gap longer than `spacing`;
 * - a post at both sides of each gate, and no fence across it (a corner inside
 *   a gate gets no post: the gate goes straight across);
 * - each post on the ground there (`groundAt`) plus the fence's lift;
 * - another post wherever the ground steps by more than GROUND_STEP between
 *   two looks at it, so the fence steps with the land;
 * - only the first `builtShare` of it, which ends at a post, and only the
 *   gates within that.
 */
export const fenceLayout = (
	fence: TFenceLine,
	spacing: number,
	groundAt: (point: TVec2) => number,
	builtShare = 1,
): IFenceLayout => {
	const line = fenceLine(fence);
	if (line.length < 2) {
		return noLayout(0);
	}
	const closed = fence.loops && line.length > 3;

	// Distance along the ground to each vertex.
	const along = [0];
	for (let i = 1; i < line.length; i++) {
		along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
	}
	const total = along[along.length - 1];
	if (total < 1e-6) {
		return noLayout(0);
	}
	const segmentDirection = (i: number) =>
		unit(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
	const last = line.length - 1;

	// The gates, as distances from one side to the other: each round the place on the (rounded)
	// line nearest its spot on its stretch, as wide as it is (never wider than the fence), on it.
	const gates = (fence.gates ?? []).flatMap((gate, index) => {
		const spot = gateSpot(fence, gate);
		if (!spot) {
			return [];
		}
		const { segment, share } = nearestOnLine(line, spot);
		const middle = along[segment] + (along[segment + 1] - along[segment]) * share;
		const width = Math.min(Math.max(0.05, gate.width), total);
		const from = Math.min(Math.max(0, middle - width / 2), total - width);
		return [{ index, from, to: from + width }];
	});
	const inGate = (distance: number) =>
		gates.some((gate) => distance > gate.from + 1e-6 && distance < gate.to - 1e-6);

	// Breaks: the ends (a loop's start, which is also its end) and the corners sharper than
	// CORNER_ANGLE, judged on the points as drawn (a rounded corner's curve turns a little at many
	// places, which must not each get a post): at the corner itself, or the middle of its curve,
	// the place on the line nearest it. Then both sides of each gate, and no corner inside one.
	const cos = Math.cos((CORNER_ANGLE * Math.PI) / 180);
	const corners = fence.points.filter(
		(p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1][0], p[1] - all[i - 1][1]) > 1e-9,
	);
	const breakSet = new Set([0, last]);
	for (let i = closed ? 0 : 1; i < (closed ? corners.length : corners.length - 1); i++) {
		const p = corners[i];
		const before = corners[(i - 1 + corners.length) % corners.length];
		const after = corners[(i + 1) % corners.length];
		const a = unit(p[0] - before[0], p[1] - before[1]);
		const b = unit(after[0] - p[0], after[1] - p[1]);
		if (a[0] * b[0] + a[1] * b[1] >= cos) {
			continue;
		}
		let nearest = 0;
		for (let j = 1; j <= last; j++) {
			if (
				Math.hypot(line[j][0] - p[0], line[j][1] - p[1]) <
				Math.hypot(line[nearest][0] - p[0], line[nearest][1] - p[1])
			) {
				nearest = j;
			}
		}
		breakSet.add(nearest);
	}
	const allBreaks: { distance: number; vertex: number | null }[] = [...breakSet]
		.map((vertex) => ({ distance: along[vertex], vertex }))
		.filter((each) => !inGate(each.distance));
	for (const gate of gates) {
		allBreaks.push({ distance: gate.from, vertex: null }, { distance: gate.to, vertex: null });
	}
	// In order along the line; where a gate's side meets a corner or an end, the corner's (its
	// direction is the corner's).
	allBreaks.sort(
		(x, y) => x.distance - y.distance || (x.vertex === null ? 1 : 0) - (y.vertex === null ? 1 : 0),
	);
	const breaks = allBreaks.filter(
		(each, i) => i === 0 || each.distance - allBreaks[i - 1].distance > 1e-4,
	);

	/** A point at a distance along the line: where it is, its lift, and the segment it's on. */
	const pointAt = (distance: number) => {
		let i = 0;
		while (i < last - 1 && along[i + 1] < distance) {
			i++;
		}
		const span = along[i + 1] - along[i];
		const f = span < 1e-9 ? 0 : Math.min(1, Math.max(0, (distance - along[i]) / span));
		const [a, b] = [line[i], line[i + 1]];
		return {
			x: a[0] + (b[0] - a[0]) * f,
			z: a[1] + (b[1] - a[1]) * f,
			lift: a[2] + (b[2] - a[2]) * f,
			segment: i,
		};
	};

	/** The way the fence runs at a post: along its segment, or between the two at a corner or a loop's start. */
	const directionAt = (distance: number, vertex: number | null) => {
		if (vertex === null) {
			return segmentDirection(pointAt(distance).segment);
		}
		const before =
			vertex > 0 ? segmentDirection(vertex - 1) : closed ? segmentDirection(last - 1) : null;
		const after = vertex < last ? segmentDirection(vertex) : closed ? segmentDirection(0) : null;
		if (before && after) {
			return unit(before[0] + after[0], before[1] + after[1]);
		}
		return (before ?? after) as TVec2;
	};

	// Distances of the posts: each run between breaks shared out evenly; none inside a gate.
	const stations: { distance: number; vertex: number | null }[] = [
		{ distance: 0, vertex: breaks[0]?.vertex ?? null },
	];
	for (let k = 0; k < breaks.length - 1; k++) {
		const [from, to] = [breaks[k].distance, breaks[k + 1].distance];
		const count = inGate((from + to) / 2)
			? 1
			: Math.max(1, Math.ceil((to - from) / Math.max(0.05, spacing) - 1e-6));
		for (let s = 1; s <= count; s++) {
			stations.push({
				distance: from + ((to - from) * s) / count,
				vertex: s === count ? breaks[k + 1].vertex : null,
			});
		}
	}

	// Built only so far: the line ends at a post there. Nothing built: not even a post.
	const built = Math.min(1, Math.max(0, builtShare)) * total;
	if (built < 1e-6) {
		return noLayout(total);
	}
	const kept = stations.filter((station) => station.distance <= built + 1e-6);
	if (kept.length > 0 && built - kept[kept.length - 1].distance > 1e-3) {
		kept.push({ distance: built, vertex: null });
	}
	const loopsRound = closed && built >= total - 1e-6;

	const baseAt = (distance: number) => {
		const p = pointAt(distance);
		return groundAt([p.x, p.z]) + p.lift;
	};
	const postAt = (distance: number, vertex: number | null): IFencePost => {
		const p = pointAt(distance);
		const base = groundAt([p.x, p.z]) + p.lift;
		return {
			x: p.x,
			z: p.z,
			baseBefore: base,
			baseAfter: base,
			direction: directionAt(distance, vertex),
			distance,
		};
	};

	const posts: IFencePost[] = [];
	for (let k = 0; k < kept.length; k++) {
		const station = kept[k];
		const post = postAt(station.distance, station.vertex);
		// The ground between the previous post and this one: a post at each step (none in a gate).
		const previous = posts[posts.length - 1];
		if (previous && !inGate((previous.distance + station.distance) / 2)) {
			const length = station.distance - previous.distance;
			const samples = Math.max(1, Math.ceil(length / GROUND_SAMPLE));
			let before = baseAt(previous.distance);
			// Up to this post itself, so a step just before it is found too.
			for (let s = 1; s <= samples; s++) {
				const distance = previous.distance + (length * s) / samples;
				const here = baseAt(distance);
				if (Math.abs(here - before) > GROUND_STEP) {
					const step = postAt(distance - length / samples / 2, null);
					step.baseBefore = before;
					step.baseAfter = here;
					posts.push(step);
				}
				before = here;
			}
		}
		// A loop's last station is its first post again.
		if (loopsRound && k === kept.length - 1) {
			break;
		}
		posts.push(post);
	}

	const spans: IFenceSpan[] = [];
	const spanCount = loopsRound ? posts.length : posts.length - 1;
	for (let i = 0; i < spanCount; i++) {
		const [a, b] = [posts[i], posts[(i + 1) % posts.length]];
		const length = Math.hypot(b.x - a.x, b.z - a.z);
		// A loop's closing span runs on to its whole length.
		const middle = (a.distance + (i + 1 === posts.length ? total : b.distance)) / 2;
		if (length < 1e-6 || inGate(middle)) {
			continue;
		}
		spans.push({
			from: [a.x, a.baseAfter, a.z],
			to: [b.x, b.baseBefore, b.z],
			length,
			direction: unit(b.x - a.x, b.z - a.z),
		});
	}

	// The gates that are built, from the post at one side to the post at the other.
	const gatePlaces = gates.flatMap((gate): IFenceGatePlace[] => {
		if (gate.to > built + 1e-6) {
			return [];
		}
		const [a, b] = [postAt(gate.from, null), postAt(gate.to, null)];
		const length = Math.hypot(b.x - a.x, b.z - a.z);
		if (length < 1e-6) {
			return [];
		}
		return [
			{
				index: gate.index,
				from: [a.x, a.baseAfter, a.z],
				to: [b.x, b.baseBefore, b.z],
				length,
				direction: unit(b.x - a.x, b.z - a.z),
			},
		];
	});

	return { posts, spans, gates: gatePlaces, length: total };
};

/** Length of a fence's line along the ground, its curves included. */
export const fenceLength = (fence: TFenceLine) =>
	fenceLayout(fence, Number.POSITIVE_INFINITY, () => 0).length;

/** How far inside an area's edge a fence along it stands (outside, for water). */
export const EDGE_FENCE_INSET = 0.22;

/**
 * The points of a fence along an outline (an area's edge, ADR-0133): each
 * corner moved `inset` inwards (outwards when negative) along both its sides,
 * so the fence stands just inside the edge, on the area's top if it's raised,
 * rather than on the cliff's rim. Very sharp corners move no further than
 * three times the inset. Every point stands on the ground there (lift 0).
 */
export const insetOutline = (
	outline: readonly (readonly number[])[],
	inset: number,
): [number, number, number][] => {
	const n = outline.length;
	if (n < 3) {
		return outline.map((p) => [p[0], p[1], 0]);
	}
	// Counter-clockwise (in x, z) outlines have their inside to the left of each side.
	let doubled = 0;
	for (let i = 0; i < n; i++) {
		const [a, b] = [outline[i], outline[(i + 1) % n]];
		doubled += a[0] * b[1] - b[0] * a[1];
	}
	const inward = doubled >= 0 ? 1 : -1;
	return outline.map((p, i) => {
		const before = outline[(i - 1 + n) % n];
		const after = outline[(i + 1) % n];
		const a = unit(p[0] - before[0], p[1] - before[1]);
		const b = unit(after[0] - p[0], after[1] - p[1]);
		// Each side's inward normal (left of its way, for counter-clockwise), and their mitre.
		const na: TVec2 = [-a[1] * inward, a[0] * inward];
		const nb: TVec2 = [-b[1] * inward, b[0] * inward];
		const mitre = unit(na[0] + nb[0], na[1] + nb[1]);
		const cosHalf = mitre[0] * na[0] + mitre[1] * na[1];
		const reach = Math.min(Math.abs(inset) * 3, Math.abs(inset) / Math.max(1e-3, cosHalf));
		const sign = Math.sign(inset);
		return [round(p[0] + mitre[0] * reach * sign), round(p[1] + mitre[1] * reach * sign), 0];
	});
};
