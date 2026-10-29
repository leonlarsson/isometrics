import { describe, expect, it } from "vitest";

import { fenceLayout, fenceLength, GROUND_STEP } from "./fences";
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
