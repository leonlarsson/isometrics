import { describe, expect, it } from "vitest";

import { createPathSampler } from "./paths";
import {
	applyLane,
	buildRibbon,
	dashPolyline,
	laneOffset,
	polylineLength,
	roadCenterline,
	segmentMidpoints,
} from "./roads";
import type { TVec2 } from "./schema";

const L: TVec2[] = [
	[0, 0],
	[10, 0],
	[10, 10],
];

describe("roadCenterline", () => {
	it("keeps the end points of an open road and rounds interior corners", () => {
		const line = roadCenterline(L, false, 3);
		expect(line[0]).toEqual([0, 0]);
		expect(line.at(-1)).toEqual([10, 10]);
		expect(line).not.toContainEqual([10, 0]); // the sharp corner is gone
		expect(line).toContainEqual([7, 0]); // curve starts `r` before the corner
		expect(line).toContainEqual([10, 3]); // and ends `r` after it
	});

	it("limits the radius to half of the shorter adjacent segment", () => {
		const line = roadCenterline(
			[
				[0, 0],
				[2, 0],
				[2, 10],
			],
			false,
			5,
		);
		expect(line).toContainEqual([1, 0]);
	});

	it("leaves sharp corners when the radius is 0 and drops duplicate points", () => {
		expect(roadCenterline([...L, [10, 10]], false, 0)).toEqual(L);
	});

	it("rounds every corner of a closed loop", () => {
		const square: TVec2[] = [
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		];
		const line = roadCenterline(square, true, 2);
		for (const corner of square) {
			expect(line).not.toContainEqual(corner);
		}
		// Rounding shortens the loop a little compared with the sharp square (40).
		const loop = polylineLength(line, true);
		expect(loop).toBeLessThan(40);
		expect(loop).toBeGreaterThan(36);
	});
});

/** Distance from point p to segment a–b. */
const distanceToSegment = (p: TVec2, a: TVec2, b: TVec2) => {
	const ab: TVec2 = [b[0] - a[0], b[1] - a[1]];
	const len2 = ab[0] ** 2 + ab[1] ** 2;
	const t =
		len2 === 0
			? 0
			: Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / len2));
	return Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t));
};

describe("buildRibbon", () => {
	it("makes one quad for a straight road, offset by the half width", () => {
		const { vertices, indices } = buildRibbon(
			[
				[0, 0],
				[10, 0],
			],
			1.5,
			false,
		);
		expect(vertices).toHaveLength(4);
		expect(indices).toHaveLength(6);
		expect(vertices[0][1]).toBeCloseTo(-1.5);
		expect(vertices[1][1]).toBeCloseTo(1.5);
	});

	it("never sticks out further than the half width, even on a hairpin", () => {
		// Down, a short step right, back up: a U-turn much tighter than the road is wide.
		const hairpin: TVec2[] = [
			[0, 10],
			[0, 0],
			[1, 0],
			[1, 10],
		];
		const halfWidth = 1.2;
		const center = roadCenterline(hairpin, false, 3);
		const { vertices } = buildRibbon(center, halfWidth, false);
		for (const v of vertices) {
			const nearest = Math.min(
				...center.slice(0, -1).map((a, i) => distanceToSegment(v, a, center[i + 1])),
			);
			expect(nearest).toBeLessThanOrEqual(halfWidth + 1e-9);
		}
	});
});

describe("dashPolyline", () => {
	it("produces evenly spaced dashes along the line", () => {
		const dashes = dashPolyline(
			[
				[0, 0],
				[10, 0],
			],
			false,
			1,
			1,
		);
		expect(dashes.length).toBe(5);
		for (const dash of dashes) {
			expect(polylineLength(dash, false)).toBeCloseTo(1);
		}
	});
});

describe("lanes", () => {
	it("drives on the right or left, and not at all on hidden routes", () => {
		expect(laneOffset({ width: 2, style: "asphalt" }, "right")).toBeGreaterThan(0);
		expect(laneOffset({ width: 2, style: "asphalt" }, "left")).toBeLessThan(0);
		expect(laneOffset({ width: 2, style: "hidden" }, "right")).toBe(0);
	});

	it("puts opposite directions on opposite sides", () => {
		const sampler = createPathSampler(
			[
				[0, 0],
				[10, 0],
			],
			false,
		);
		const forward = sampler.at(5); // heading +X
		const back = sampler.at(15); // ping-pong, heading -X
		const a = applyLane(forward.position, forward.heading, 1);
		const b = applyLane(back.position, back.heading, 1);
		expect(a[1]).toBeCloseTo(1); // right of +X is +Z
		expect(b[1]).toBeCloseTo(-1);
	});
});

describe("segmentMidpoints", () => {
	it("includes the closing segment for closed roads", () => {
		expect(segmentMidpoints(L, false)).toHaveLength(2);
		expect(segmentMidpoints(L, true).at(-1)?.point).toEqual([5, 5]);
	});
});

describe("dashPolyline on long, curved roads", () => {
	it("terminates and stays within the road length", () => {
		const loop = roadCenterline(
			[
				[-19, 6],
				[15, 6],
				[15, -11.8],
				[-19, -11.8],
			],
			true,
			4,
		);
		const dashes = dashPolyline(loop, true, 0.6, 0.6);
		const total = polylineLength(loop, true);
		expect(dashes.length).toBe(Math.floor(total / 1.2) + (total % 1.2 > 0.3 ? 1 : 0));
		for (const d of dashes) {
			expect(polylineLength(d, false)).toBeLessThanOrEqual(0.6 + 1e-9);
		}
	});
});

describe("buildRibbon winding", () => {
	it("faces every triangle up, whichever direction the road was drawn", () => {
		const facesUp = (center: TVec2[]) => {
			const { vertices: v, indices } = buildRibbon(center, 1, false);
			for (let i = 0; i < indices.length; i += 3) {
				const [a, b, c] = [v[indices[i]], v[indices[i + 1]], v[indices[i + 2]]];
				if ((b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) <= 0) {
					return false;
				}
			}
			return true;
		};
		expect(facesUp(L)).toBe(true);
		expect(facesUp([...L].reverse())).toBe(true);
	});
});
