import { describe, expect, it } from "vitest";

import { createPathSampler } from "./paths";
import {
	buildElevatedSides,
	buildRibbon,
	DECK_THICKNESS,
	dashPolyline,
	joinedPoints,
	laneOffset,
	PILLAR_MIN,
	PILLAR_SPACING,
	pillarPositions,
	pointWidth,
	polylineLength,
	ROAD_STYLE_WIDTH,
	resolveTurns,
	roadCenterline,
	segmentMidpoints,
	turnSmoothing,
	widthForStyle,
} from "./roads";
import type { TRoadPoint, TVec2 } from "./schema";

/** Ground positions only, for comparing shapes regardless of height. */
const flat = (points: readonly (readonly number[])[]) => points.map((p) => [p[0], p[1]]);

const L: TVec2[] = [
	[0, 0],
	[10, 0],
	[10, 10],
];

describe("roadCenterline", () => {
	it("keeps the end points of an open road and rounds interior corners", () => {
		const line = flat(roadCenterline(L, false, 3));
		expect(line[0]).toEqual([0, 0]);
		expect(line.at(-1)).toEqual([10, 10]);
		expect(line).not.toContainEqual([10, 0]); // the sharp corner is gone
		expect(line).toContainEqual([7, 0]); // curve starts `r` before the corner
		expect(line).toContainEqual([10, 3]); // and ends `r` after it
	});

	it("limits the radius to half of the shorter adjacent segment", () => {
		const line = flat(
			roadCenterline(
				[
					[0, 0],
					[2, 0],
					[2, 10],
				],
				false,
				5,
			),
		);
		expect(line).toContainEqual([1, 0]);
	});

	it("leaves sharp corners when the radius is 0 and drops duplicate points", () => {
		expect(flat(roadCenterline([...L, [10, 10]], false, 0))).toEqual(L);
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
			expect(flat(line)).not.toContainEqual(corner);
		}
		// Rounding shortens the loop a little compared with the sharp square (40).
		const loop = polylineLength(line, true);
		expect(loop).toBeLessThan(40);
		expect(loop).toBeGreaterThan(36);
	});
});

/** Distance from point p to segment a–b. */
const distanceToSegment = (p: readonly number[], a: readonly number[], b: readonly number[]) => {
	const ab = [b[0] - a[0], b[1] - a[1]];
	const len2 = ab[0] ** 2 + ab[1] ** 2;
	const t =
		len2 === 0
			? 0
			: Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / len2));
	return Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t));
};

describe("buildRibbon", () => {
	it("makes one quad (split along the centre line) for a straight road, offset by the half width", () => {
		const { vertices, indices } = buildRibbon(
			[
				[0, 0],
				[10, 0],
			],
			1.5,
			false,
		);
		expect(vertices).toHaveLength(6);
		expect(indices).toHaveLength(12);
		expect(vertices[0][1]).toBeCloseTo(-1.5);
		expect(vertices[1][1]).toBeCloseTo(0);
		expect(vertices[2][1]).toBeCloseTo(1.5);
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
	it("drives on the right or left, and down the centre of hidden or centre-lane roads", () => {
		expect(laneOffset({ width: 2, style: "asphalt", lane: "side" }, "right")).toBeGreaterThan(0);
		expect(laneOffset({ width: 2, style: "asphalt", lane: "side" }, "left")).toBeLessThan(0);
		expect(laneOffset({ width: 2, style: "hidden", lane: "side" }, "right")).toBe(0);
		expect(laneOffset({ width: 2, style: "asphalt", lane: "centre" }, "right")).toBe(0);
	});

	it("puts opposite directions on opposite sides", () => {
		const sampler = createPathSampler(
			[
				[0, 0],
				[10, 0],
			],
			false,
			{ lane: 1 },
		);
		const turn = Math.PI; // the U-turn at the far end: half a circle of radius 1
		expect(sampler.at(5).position[1]).toBeCloseTo(1); // heading +X: right of +X is +Z
		expect(sampler.at(15 + turn).position[1]).toBeCloseTo(-1); // coming back, heading -X
	});
});

describe("segmentMidpoints", () => {
	it("includes the closing segment for closed roads", () => {
		expect(segmentMidpoints(L, false)).toHaveLength(2);
		expect(segmentMidpoints(L, true).at(-1)?.point).toEqual([5, 5, 0]);
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

describe("road heights", () => {
	const ramp: TRoadPoint[] = [
		[0, 0, 0],
		[10, 0, 4],
	];

	it("keeps control point heights and eases between them", () => {
		const line = roadCenterline(ramp, false, 0);
		expect(line[0][2]).toBe(0);
		expect(line.at(-1)?.[2]).toBe(4);
		expect(line.length).toBeGreaterThan(10); // subdivided so the ramp is smooth
		const heights = line.map((p) => p[2]);
		for (let i = 1; i < heights.length; i++) {
			expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
		}
		// Eased: the first and last steps are gentler than the middle one.
		const mid = Math.floor(heights.length / 2);
		expect(heights[1] - heights[0]).toBeLessThan(heights[mid + 1] - heights[mid]);
	});

	it("carries heights through rounded corners", () => {
		const line = roadCenterline(
			[
				[0, 0, 2],
				[10, 0, 2],
				[10, 10, 2],
			],
			false,
			3,
		);
		expect(line.every((p) => Math.abs(p[2] - 2) < 1e-9)).toBe(true);
	});

	it("only builds deck sides, railings and embankments where the road is raised", () => {
		const flatRoad = buildElevatedSides(roadCenterline(L, false, 0), false, 1, {
			railings: true,
			embankment: true,
		});
		expect(flatRoad.deck.quads).toHaveLength(0);

		const bridge = roadCenterline(
			[
				[0, 0, 0],
				[10, 0, 3],
				[20, 0, 3],
				[30, 0, 0],
			],
			false,
			0,
		);
		const sides = buildElevatedSides(bridge, false, 1, { railings: true, embankment: false });
		expect(sides.deck.quads.length).toBeGreaterThan(0);
		expect(sides.railings.quads.length).toBeGreaterThan(0);
		expect(sides.embankment.quads).toHaveLength(0);
		// The deck hangs DECK_THICKNESS below the surface, never below ground.
		for (const [top, , bottom] of sides.deck.quads) {
			expect(bottom[1]).toBeCloseTo(Math.max(0, top[1] - DECK_THICKNESS));
		}

		const bank = buildElevatedSides(bridge, false, 1, { railings: false, embankment: true });
		expect(bank.railings.quads).toHaveLength(0);
		expect(bank.deck.quads).toHaveLength(0); // the bank covers the deck's edge
		for (const quad of bank.embankment.quads) {
			expect(quad[2][1]).toBe(0); // slopes reach the ground
		}
	});

	it("builds embankment sides as steep as their angle, down to straight walls", () => {
		const raised = roadCenterline(
			[
				[0, 0, 2],
				[10, 0, 2],
			],
			false,
			0,
		);
		const footOffset = (angle: number) => {
			const { embankment } = buildElevatedSides(raised, false, 1, {
				railings: false,
				embankment: true,
				embankmentAngle: angle,
			});
			// The road runs along x, so a side's foot sits out from its top in z.
			return Math.max(...embankment.quads.map(([top, , foot]) => Math.abs(foot[2] - top[2])));
		};
		expect(footOffset(45)).toBeCloseTo(2);
		expect(footOffset(60)).toBeCloseTo(2 / Math.tan(Math.PI / 3));
		expect(footOffset(90)).toBeCloseTo(0);
	});

	it("narrows the embankment's top to its share of the road's width, showing the deck's edge", () => {
		const raised = roadCenterline(
			[
				[0, 0, 2],
				[10, 0, 2],
			],
			false,
			0,
		);
		const { embankment, deck } = buildElevatedSides(raised, false, 1, {
			railings: false,
			embankment: true,
			embankmentAngle: 90,
			embankmentWidth: 0.3,
		});
		// A straight wall 0.3 units out from the centre line (z = 0) on each side.
		for (const [top, , foot] of embankment.quads) {
			expect(Math.abs(top[2])).toBeCloseTo(0.3);
			expect(Math.abs(foot[2])).toBeCloseTo(0.3);
		}
		expect(deck.quads.length).toBeGreaterThan(0);
	});

	it("places pillars at regular spacing only under high enough sections", () => {
		const line = roadCenterline(
			[
				[0, 0, 3],
				[40, 0, 3],
			],
			false,
			0,
		);
		const pillars = pillarPositions(line, false);
		expect(pillars.length).toBe(40 / PILLAR_SPACING);
		expect(pillars.every((p) => p[2] >= PILLAR_MIN)).toBe(true);
		expect(pillarPositions(roadCenterline(L, false, 0), false)).toHaveLength(0);
	});
});

describe("joinedPoints", () => {
	const a: TRoadPoint[] = [
		[0, 0, 0],
		[5, 0, 1],
	];
	const b: TRoadPoint[] = [
		[10, 0, 0],
		[5, 0, 1],
	];

	it("orients both roads so the joined ends meet, keeping the shared point once", () => {
		expect(joinedPoints(a, "end", b, "end")).toEqual([
			[0, 0, 0],
			[5, 0, 1],
			[10, 0, 0],
		]);
		expect(joinedPoints(a, "start", b, "start").map((p) => p[0])).toEqual([5, 0, 10, 5]);
	});
});

describe("elevated sides on curves", () => {
	it("form continuous strips with no gaps between neighbouring pieces", () => {
		const raisedLoop = roadCenterline(
			[
				[0, 0, 4],
				[20, 0, 4],
				[20, 15, 4],
				[0, 15, 4],
			],
			true,
			6,
		);
		const { embankment, deck } = buildElevatedSides(raisedLoop, true, 1.2, {
			railings: true,
			embankment: true,
		});
		for (const wall of [embankment, deck]) {
			// Quads alternate left/right per segment, so the same side repeats every 2.
			for (let k = 0; k + 2 < wall.quads.length; k++) {
				const [, topB, , bottomB] = wall.quads[k];
				const [topA, , bottomA] = wall.quads[k + 2];
				expect(topA).toEqual(topB);
				expect(bottomA).toEqual(bottomB);
			}
		}
	});
});

describe("embankment bounds", () => {
	it("keeps embankment feet on the ground slab", () => {
		const nearEdge = roadCenterline(
			[
				[0, 9, 5],
				[10, 9, 5],
			],
			false,
			0,
		);
		const { embankment } = buildElevatedSides(nearEdge, false, 1, {
			railings: false,
			embankment: true,
			bounds: [20, 10],
		});
		for (const quad of embankment.quads) {
			for (const [x, , z] of [quad[2], quad[3]]) {
				expect(Math.abs(x)).toBeLessThanOrEqual(20);
				expect(Math.abs(z)).toBeLessThanOrEqual(10);
			}
		}
	});
});

describe("buildRibbon bends and normals", () => {
	it("fills only the outside of a bend, from one quad's corner to the next", () => {
		const corner: TVec2[] = [
			[0, 0],
			[10, 0],
			[10, 10],
		];
		const { vertices } = buildRibbon(corner, 1, false);
		// 2 quads (6 vertices each) + hub + a 90° arc in π/16 steps (9 points).
		expect(vertices).toHaveLength(12 + 1 + 9);
		const arc = vertices.slice(13);
		// The road turns right (towards +Z), so the outside is the -Z / +X side of the corner.
		expect(arc[0][0]).toBeCloseTo(10);
		expect(arc[0][1]).toBeCloseTo(-1);
		expect(arc.at(-1)?.[0]).toBeCloseTo(11);
		expect(arc.at(-1)?.[1]).toBeCloseTo(0);
		// Exactly the quads' outer corners, so there's no hairline crack between them.
		expect(arc[0]).toEqual(vertices[3]);
		expect(arc.at(-1)).toEqual(vertices[6]);
		// The hub is the quads' shared centre vertex, not a point in the middle of an edge.
		expect(vertices[12]).toEqual(vertices[4]);
	});

	it("fills even the slightest bend, so dense curves have no cracks", () => {
		const { vertices } = buildRibbon(
			[
				[0, 0],
				[10, 0],
				[20, 0.01],
			],
			1,
			false,
		);
		// 2 quads + hub + a one-step arc (2 points).
		expect(vertices).toHaveLength(12 + 1 + 2);
	});

	it("keeps bend wedges at the road's height", () => {
		const ramp = roadCenterline(
			[
				[0, 0, 0],
				[10, 0, 2],
				[10, 10, 4],
			],
			false,
			3,
		);
		const { vertices } = buildRibbon(ramp, 1, false);
		const maxCenter = Math.max(...ramp.map((p) => p[2]));
		expect(Math.max(...vertices.map((v) => v[2]))).toBeLessThanOrEqual(maxCenter);
	});

	it("points normals straight up on flat roads and tilts them on ramps", () => {
		const flatRibbon = buildRibbon(L, 1, false);
		expect(flatRibbon.normals).toHaveLength(flatRibbon.vertices.length);
		for (const [nx, ny, nz] of flatRibbon.normals) {
			expect(nx).toBeCloseTo(0);
			expect(ny).toBeCloseTo(1);
			expect(nz).toBeCloseTo(0);
		}
		const up = buildRibbon(
			[
				[0, 0, 0],
				[10, 0, 5],
			],
			1,
			false,
		);
		for (const [nx, ny] of up.normals) {
			expect(nx).toBeLessThan(0); // rising towards +X tilts the normal back
			expect(ny).toBeGreaterThan(0);
		}
	});
});

describe("height profile through bends", () => {
	it("has no sudden slope changes where a ramp runs into a curve", () => {
		const line = roadCenterline(
			[
				[-12, 0, 0],
				[0, 0, 4],
				[6, -6, 4.5],
				[6, -16, 4.5],
			],
			false,
			4,
		);
		const slopes = line.slice(1).map((b, i) => {
			const a = line[i];
			const run = Math.hypot(b[0] - a[0], b[1] - a[1]);
			return run === 0 ? 0 : (b[2] - a[2]) / run;
		});
		for (let i = 1; i < slopes.length; i++) {
			expect(Math.abs(slopes[i] - slopes[i - 1])).toBeLessThan(0.1);
		}
		// Control point heights are still met exactly at the ends.
		expect(line[0][2]).toBe(0);
		expect(line.at(-1)?.[2]).toBe(4.5);
	});

	it("keeps loops continuous across the start point", () => {
		const loop = roadCenterline(
			[
				[0, 0, 0],
				[20, 0, 3],
				[20, 15, 3],
				[0, 15, 0],
			],
			true,
			4,
		);
		const steps = loop.map((p, i) => Math.abs(p[2] - loop[(i + 1) % loop.length][2]));
		expect(Math.max(...steps)).toBeLessThan(0.5);
	});
});

describe("road width per point", () => {
	const straight: TRoadPoint[] = [
		[0, 0, 0, 1],
		[10, 0, 0],
		[20, 0, 0, 3],
	];

	it("reads a point's own width, if it has one", () => {
		expect(pointWidth([0, 0, 0, 2])).toBe(2);
		expect(pointWidth([0, 0, 0])).toBeUndefined();
		expect(pointWidth([0, 0])).toBeUndefined();
	});

	it("eases the width between points, using the road's width where a point has none", () => {
		const line = roadCenterline(straight, false, 0, 2);
		expect(line[0][3]).toBeCloseTo(1);
		expect(line.at(-1)?.[3]).toBeCloseTo(3);
		const middle = line.find((p) => Math.abs(p[0] - 10) < 1e-6);
		expect(middle?.[3]).toBeCloseTo(2);
		// Smooth: subdivided, and never outside the range of its ends.
		expect(line.length).toBeGreaterThan(3);
		for (const p of line) {
			expect(p[3]).toBeGreaterThanOrEqual(1 - 1e-9);
			expect(p[3]).toBeLessThanOrEqual(3 + 1e-9);
		}
	});

	it("leaves points without widths as [x, z, height] when no road width is given", () => {
		const line = roadCenterline(L, false, 3);
		expect(line.every((p) => p.length === 3)).toBe(true);
	});

	it("tapers the ribbon to each point's half width", () => {
		const { vertices } = buildRibbon(
			[
				[0, 0, 0, 1],
				[10, 0, 0, 3],
			],
			5,
			false,
		);
		expect(vertices[0][1]).toBeCloseTo(-0.5);
		expect(vertices[2][1]).toBeCloseTo(0.5);
		expect(vertices[3][1]).toBeCloseTo(-1.5);
		expect(vertices[5][1]).toBeCloseTo(1.5);
	});

	it("keeps bend wedges flush with tapered quads", () => {
		const { vertices } = buildRibbon(
			[
				[0, 0, 0, 1],
				[10, 0, 0, 4],
				[10, 10, 0, 2],
			],
			1,
			false,
		);
		const arc = vertices.slice(13);
		expect(arc[0]).toEqual(vertices[3]);
		expect(arc.at(-1)).toEqual(vertices[6]);
		expect(Math.hypot(arc[0][0] - 10, arc[0][1])).toBeCloseTo(2);
	});

	it("draws centre-line dashes at their own width, not the road's", () => {
		const dashes = dashPolyline(roadCenterline(straight, false, 0, 2), false, 1, 1);
		expect(dashes.length).toBeGreaterThan(0);
		expect(dashes.flat().every((p) => p.length === 3)).toBe(true);
	});
});

describe("widthForStyle", () => {
	it("adopts the new style's default when the width is still the old default", () => {
		expect(widthForStyle(ROAD_STYLE_WIDTH.hidden, "hidden", "asphalt")).toBe(
			ROAD_STYLE_WIDTH.asphalt,
		);
	});

	it("keeps a custom width", () => {
		expect(widthForStyle(5, "hidden", "asphalt")).toBe(5);
	});
});

describe("turns", () => {
	it("uses the vehicle's setting, else the road's, else the scene's", () => {
		expect(resolveTurns("smooth", null, null)).toBe("smooth");
		expect(resolveTurns("smooth", "sharp", null)).toBe("sharp");
		expect(resolveTurns("smooth", "sharp", "smooth")).toBe("smooth");
		expect(resolveTurns("sharp", undefined, undefined)).toBe("sharp");
	});

	it("smooths over half the vehicle's length, within limits; sharp is 0", () => {
		expect(turnSmoothing("smooth", 2)).toBe(1);
		expect(turnSmoothing("smooth", 0.2)).toBe(0.3);
		expect(turnSmoothing("smooth", 20)).toBe(3);
		expect(turnSmoothing("sharp", 2)).toBe(0);
	});
});
