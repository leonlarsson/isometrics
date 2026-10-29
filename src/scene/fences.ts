import { roadCenterline } from "./roads";
import type { TFence, TVec2 } from "./schema";

/**
 * Where a fence's posts stand and what runs between them, framework-free so it
 * is unit-tested (ADR-0103). A fence is a line of points, rounded like a road
 * (`roadCenterline`); its looks (src/fences/) draw on this layout.
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

export interface IFenceLayout {
	posts: IFencePost[];
	spans: IFenceSpan[];
	/** Length along the ground of the whole line, built or not. */
	length: number;
}

const unit = (dx: number, dz: number): TVec2 => {
	const length = Math.hypot(dx, dz);
	return length < 1e-9 ? [1, 0] : [dx / length, dz / length];
};

/** The fence's line as [x, z, lift], closed loops ending where they start. */
const fenceLine = (fence: Pick<TFence, "points" | "loops" | "cornerRadius">) => {
	const line = roadCenterline(fence.points, fence.loops, fence.cornerRadius);
	if (fence.loops && line.length > 2) {
		line.push(line[0]);
	}
	return line;
};

/**
 * Posts and spans of a fence (ADR-0103):
 * - a post at each end and at every corner sharper than CORNER_ANGLE, and the
 *   runs between shared out evenly, no gap longer than `spacing`;
 * - each post on the ground there (`groundAt`) plus the fence's lift;
 * - another post wherever the ground steps by more than GROUND_STEP between
 *   two looks at it, so the fence steps with the land;
 * - only the first `builtShare` of it, which ends at a post.
 */
export const fenceLayout = (
	fence: Pick<TFence, "points" | "loops" | "cornerRadius">,
	spacing: number,
	groundAt: (point: TVec2) => number,
	builtShare = 1,
): IFenceLayout => {
	const line = fenceLine(fence);
	if (line.length < 2) {
		return { posts: [], spans: [], length: 0 };
	}
	const closed = fence.loops && line.length > 3;

	// Distance along the ground to each vertex.
	const along = [0];
	for (let i = 1; i < line.length; i++) {
		along.push(along[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
	}
	const total = along[along.length - 1];
	if (total < 1e-6) {
		return { posts: [], spans: [], length: 0 };
	}
	const segmentDirection = (i: number) =>
		unit(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
	const last = line.length - 1;

	// Breaks: the ends (a loop's start, which is also its end) and the sharp corners.
	const cos = Math.cos((CORNER_ANGLE * Math.PI) / 180);
	const breaks = [0];
	for (let i = 1; i < last; i++) {
		const [a, b] = [segmentDirection(i - 1), segmentDirection(i)];
		if (a[0] * b[0] + a[1] * b[1] < cos) {
			breaks.push(i);
		}
	}
	breaks.push(last);

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

	// Distances of the posts: each run between breaks shared out evenly.
	const stations: { distance: number; vertex: number | null }[] = [{ distance: 0, vertex: 0 }];
	for (let k = 0; k < breaks.length - 1; k++) {
		const [from, to] = [along[breaks[k]], along[breaks[k + 1]]];
		const count = Math.max(1, Math.ceil((to - from) / Math.max(0.05, spacing) - 1e-6));
		for (let s = 1; s <= count; s++) {
			stations.push({
				distance: from + ((to - from) * s) / count,
				vertex: s === count ? breaks[k + 1] : null,
			});
		}
	}

	// Built only so far: the line ends at a post there.
	const built = Math.min(1, Math.max(0, builtShare)) * total;
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
		// The ground between the previous post and this one: a post at each step.
		const previous = posts[posts.length - 1];
		if (previous) {
			const length = station.distance - previous.distance;
			const samples = Math.max(1, Math.ceil(length / GROUND_SAMPLE));
			let before = baseAt(previous.distance);
			for (let s = 1; s < samples; s++) {
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
		if (length < 1e-6) {
			continue;
		}
		spans.push({
			from: [a.x, a.baseAfter, a.z],
			to: [b.x, b.baseBefore, b.z],
			length,
			direction: unit(b.x - a.x, b.z - a.z),
		});
	}

	return { posts, spans, length: total };
};

/** Length of a fence's line along the ground, its curves included. */
export const fenceLength = (fence: Pick<TFence, "points" | "loops" | "cornerRadius">) =>
	fenceLayout(fence, Number.POSITIVE_INFINITY, () => 0).length;
