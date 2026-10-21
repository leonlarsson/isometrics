import { describe, expect, it } from "vitest";

import { createPathSampler } from "./paths";

describe("createPathSampler", () => {
	const square = [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
	] as [number, number][];

	it("measures closed loops including the closing segment", () => {
		expect(createPathSampler(square, true).length).toBe(40);
		expect(createPathSampler(square, false).length).toBe(30);
	});

	it("interpolates positions and wraps closed loops", () => {
		const sampler = createPathSampler(square, true);
		expect(sampler.at(5).position).toEqual([5, 0]);
		expect(sampler.at(15).position).toEqual([10, 5]);
		expect(sampler.at(45).position).toEqual([5, 0]);
		expect(sampler.at(-5).position).toEqual([0, 5]);
	});

	it("points the heading along the travel direction", () => {
		const sampler = createPathSampler(square, true);
		expect(sampler.at(5).heading).toBeCloseTo(0); // +X
		expect(sampler.at(15).heading).toBeCloseTo(-Math.PI / 2); // +Z
	});

	it("ping-pongs on open paths", () => {
		const sampler = createPathSampler(
			[
				[0, 0],
				[10, 0],
			],
			false,
		);
		expect(sampler.at(15).position).toEqual([5, 0]);
		expect(sampler.at(15).heading).toBeCloseTo(Math.PI);
	});

	it("handles degenerate paths", () => {
		const sampler = createPathSampler(
			[
				[3, 4],
				[3, 4],
			],
			false,
		);
		expect(sampler.at(10)).toEqual({ position: [3, 4], height: 0, heading: 0, pitch: 0 });
	});

	it("interpolates height and tilts on slopes in the direction of travel", () => {
		const sampler = createPathSampler(
			[
				[0, 0, 0],
				[10, 0, 2],
			],
			false,
		);
		const up = sampler.at(5);
		expect(up.height).toBeCloseTo(1);
		expect(up.pitch).toBeGreaterThan(0);
		const down = sampler.at(15); // ping-pong: coming back down
		expect(down.height).toBeCloseTo(1);
		expect(down.pitch).toBeLessThan(0);
	});
});
