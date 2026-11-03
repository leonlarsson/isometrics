import { describe, expect, it } from "vitest";

import {
	fenceLayout,
	fenceLength,
	fenceStretches,
	GROUND_STEP,
	gatePlaceAt,
	gatesMovedOnto,
	insetOutline,
} from "./fences";
import type { TFencePoint } from "./schema";

const flat = () => 0;

const fence = (points: TFencePoint[], loops = false, cornerRadius = 0) => ({
	points,
	loops,
	cornerRadius,
});

const L = fence([
	[0, 0, 0],
	[10, 0, 0],
	[10, 4, 0],
]);

describe("fenceLayout", () => {
	it("puts a post at each end and corner, and spaces the runs evenly", () => {
		const { posts, spans, length } = fenceLayout(L, 3, flat);
		expect(length).toBeCloseTo(14);
		// 10 long in 4 gaps of 2.5, then 4 long in 2 gaps of 2.
		expect(posts.map((p) => [p.x, p.z])).toEqual([
			[0, 0],
			[2.5, 0],
			[5, 0],
			[7.5, 0],
			[10, 0],
			[10, 2],
			[10, 4],
		]);
		expect(spans).toHaveLength(6);
		expect(spans.every((span) => span.length <= 3 + 1e-9)).toBe(true);
	});

	it("turns a corner post halfway between the two ways the fence runs", () => {
		const corner = fenceLayout(L, 20, flat).posts[1];
		expect([corner.x, corner.z]).toEqual([10, 0]);
		expect(corner.direction[0]).toBeCloseTo(Math.SQRT1_2);
		expect(corner.direction[1]).toBeCloseTo(Math.SQRT1_2);
	});

	it("closes a loop back to its first post without a second post there", () => {
		const square = fence(
			[
				[0, 0, 0],
				[4, 0, 0],
				[4, 4, 0],
				[0, 4, 0],
			],
			true,
		);
		const { posts, spans } = fenceLayout(square, 10, flat);
		expect(posts).toHaveLength(4);
		expect(spans).toHaveLength(4);
		expect(spans.at(-1)?.to).toEqual([0, 0, 0]);
	});

	it("stands on the ground under it, plus each point's lift", () => {
		const lifted = fence([
			[0, 0, 1],
			[4, 0, 1],
		]);
		const { posts } = fenceLayout(lifted, 2, ([x]) => x * 0.1);
		expect(posts.map((p) => p.baseBefore)).toEqual([1, 1.2, 1.4]);
	});

	it("puts a post where the ground steps, low on one side and high on the other", () => {
		const cliff = ([x]: readonly number[]) => (x > 5.1 ? 2 : 0);
		const { posts, spans } = fenceLayout(
			fence([
				[0, 0, 0],
				[10, 0, 0],
			]),
			10,
			cliff,
		);
		const step = posts.find((post) => post.baseBefore !== post.baseAfter);
		expect(step).toBeDefined();
		expect(step?.x).toBeGreaterThan(4.8);
		expect(step?.x).toBeLessThan(5.4);
		expect([step?.baseBefore, step?.baseAfter]).toEqual([0, 2]);
		// No span climbs the cliff: each is level.
		expect(spans.every((span) => Math.abs(span.to[1] - span.from[1]) <= GROUND_STEP)).toBe(true);
	});

	it("builds only its first part, ending at a post", () => {
		const { posts } = fenceLayout(
			fence([
				[0, 0, 0],
				[10, 0, 0],
			]),
			2,
			flat,
			0.35,
		);
		expect(posts.map((p) => p.x)).toEqual([0, 2, 3.5]);
	});

	it("follows rounded corners with posts along the curve", () => {
		const curved = fence(
			[
				[0, 0, 0],
				[10, 0, 0],
				[10, 10, 0],
			],
			false,
			4,
		);
		const { posts } = fenceLayout(curved, 1, flat);
		// Nothing stands at the sharp corner the curve cuts off.
		expect(posts.some((p) => Math.hypot(p.x - 10, p.z) < 0.5)).toBe(false);
		expect(fenceLength(curved)).toBeLessThan(20);
		expect(fenceLength(curved)).toBeGreaterThan(18);
	});
});

describe("fenceLayout, at the edges", () => {
	it("steps at a cliff just before a post", () => {
		const { posts } = fenceLayout(
			fence([
				[0, 0, 0],
				[10, 0, 0],
			]),
			10,
			([x]) => (x > 9.9 ? 2 : 0),
		);
		const step = posts.find((post) => post.baseBefore !== post.baseAfter);
		expect(step?.x).toBeGreaterThan(9.7);
		expect(posts[0].baseAfter).toBe(0);
	});

	it("puts one post on a gently rounded corner, not one per bit of its curve", () => {
		const { posts } = fenceLayout(
			fence(
				[
					[0, 0, 0],
					[10, 0, 0],
					[10, 4, 0],
				],
				false,
				0.3,
			),
			20,
			() => 0,
		);
		expect(posts).toHaveLength(3);
		const square = fenceLayout(
			fence(
				[
					[0, 0, 0],
					[4, 0, 0],
					[4, 4, 0],
					[0, 4, 0],
				],
				true,
				1,
			),
			10,
			() => 0,
		);
		expect(square.posts.length).toBeLessThanOrEqual(5);
	});

	it("draws nothing when none of it is built", () => {
		expect(
			fenceLayout(
				fence([
					[0, 0, 0],
					[4, 0, 0],
				]),
				1,
				() => 0,
				0,
			).posts,
		).toEqual([]);
	});
});

describe("gates (ADR-0133)", () => {
	const straight = (gates: { spanIndex: number; alongShare: number; width: number }[]) => ({
		...fence([
			[0, 0, 0],
			[10, 0, 0],
		]),
		gates,
	});

	it("puts a post at each side of a gate and no fence across it", () => {
		const { posts, spans, gates } = fenceLayout(
			straight([{ spanIndex: 0, alongShare: 0.5, width: 2 }]),
			3,
			flat,
		);
		expect(posts.map((p) => p.x)).toEqual([0, 2, 4, 6, 8, 10]);
		expect(spans.map((span) => [span.from[0], span.to[0]])).toEqual([
			[0, 2],
			[2, 4],
			[6, 8],
			[8, 10],
		]);
		expect(gates).toHaveLength(1);
		expect(gates[0]).toMatchObject({ index: 0, from: [4, 0, 0], to: [6, 0, 0], length: 2 });
	});

	it("keeps a gate on the fence, goes straight across a corner inside one, and leaves out gates not built", () => {
		const atEnd = fenceLayout(straight([{ spanIndex: 0, alongShare: 1, width: 2 }]), 20, flat);
		expect(atEnd.gates[0]).toMatchObject({ from: [8, 0, 0], to: [10, 0, 0] });
		const corner = fenceLayout(
			{ ...L, gates: [{ spanIndex: 0, alongShare: 1, width: 2 }] },
			20,
			flat,
		);
		expect(corner.posts.map((p) => [p.x, p.z])).toEqual([
			[0, 0],
			[9, 0],
			[10, 1],
			[10, 4],
		]);
		expect(corner.gates[0].length).toBeCloseTo(Math.SQRT2);
		const half = fenceLayout(straight([{ spanIndex: 0, alongShare: 0.8, width: 2 }]), 3, flat, 0.5);
		expect(half.gates).toEqual([]);
	});

	it("finds where a spot is on a fence's stretches, and moves gates onto the pieces they stand on", () => {
		const square = {
			points: [
				[0, 0, 0],
				[4, 0, 0],
				[4, 4, 0],
				[0, 4, 0],
			] as TFencePoint[],
			loops: true,
		};
		expect(fenceStretches(square)).toHaveLength(4);
		expect(gatePlaceAt(square, [0, 1])).toMatchObject({ spanIndex: 3, alongShare: 0.75 });
		const before = { ...square, gates: [{ spanIndex: 3, alongShare: 0.75 }] };
		const opened = { points: [...square.points, square.points[0]], loops: false };
		expect(gatesMovedOnto(before, [opened])).toEqual([[{ spanIndex: 3, alongShare: 0.75 }]]);
		const [first, second] = gatesMovedOnto(
			{ ...square, loops: false, gates: [{ spanIndex: 2, alongShare: 0.5 }] },
			[
				{ points: square.points.slice(0, 2), loops: false },
				{ points: square.points.slice(1), loops: false },
			],
		);
		expect(first).toEqual([]);
		expect(second).toEqual([{ spanIndex: 1, alongShare: 0.5 }]);
	});
});

describe("insetOutline", () => {
	const square = [
		[0, 0],
		[4, 0],
		[4, 4],
		[0, 4],
	];

	it("moves every corner inwards, whichever way round the outline goes, or outwards", () => {
		expect(insetOutline(square, 0.5)).toEqual([
			[0.5, 0.5, 0],
			[3.5, 0.5, 0],
			[3.5, 3.5, 0],
			[0.5, 3.5, 0],
		]);
		expect(insetOutline([...square].reverse(), 0.5)[0]).toEqual([0.5, 3.5, 0]);
		expect(insetOutline(square, -0.5)[0]).toEqual([-0.5, -0.5, 0]);
	});

	it("moves a very sharp corner no further than three times the inset", () => {
		const [tip] = insetOutline(
			[
				[0, 0],
				[10, 0.5],
				[10, -0.5],
			],
			0.1,
		);
		expect(Math.hypot(tip[0], tip[1])).toBeCloseTo(0.3, 2);
	});
});
