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

	/** Largest change between consecutive samples over [from, to), stepping by `step`. */
	const biggestJump = (
		sampler: ReturnType<typeof createPathSampler>,
		from: number,
		to: number,
		step = 0.05,
	) => {
		let position = 0;
		let heading = 0;
		let previous = sampler.at(from);
		for (let d = from + step; d < to; d += step) {
			const next = sampler.at(d);
			position = Math.max(
				position,
				Math.hypot(
					next.position[0] - previous.position[0],
					next.position[1] - previous.position[1],
				),
			);
			// Shortest angle between headings.
			const turn = Math.atan2(
				Math.sin(next.heading - previous.heading),
				Math.cos(next.heading - previous.heading),
			);
			heading = Math.max(heading, Math.abs(turn));
			previous = next;
		}
		return { position, heading };
	};

	it("turns gradually through sharp corners with smoothing", () => {
		const snappy = createPathSampler(square, true);
		const smooth = createPathSampler(square, true, { smoothing: 1 });
		expect(biggestJump(snappy, 0, 40).heading).toBeCloseTo(Math.PI / 2);
		expect(biggestJump(smooth, 0, 40).heading).toBeLessThan(0.1);
		// Halfway through the first corner it points between +X and +Z.
		expect(smooth.at(10).heading).toBeCloseTo(-Math.PI / 4);
	});

	it("keeps vehicles in their lane, without jumps at corners", () => {
		const sampler = createPathSampler(square, true, { lane: 1, smoothing: 1 });
		expect(sampler.at(5).position[0]).toBeCloseTo(5);
		expect(sampler.at(5).position[1]).toBeCloseTo(1); // right of +X is +Z
		expect(biggestJump(sampler, 0, 40).position).toBeLessThan(0.1);
	});

	it("makes a U-turn into the opposite lane at the ends of open paths", () => {
		const line = [
			[0, 0],
			[10, 0],
		] as [number, number][];
		const sampler = createPathSampler(line, false, { lane: 1, smoothing: 1 });
		const arrive = sampler.at(10);
		const halfway = sampler.at(10 + Math.PI / 2);
		const leave = sampler.at(10 + Math.PI);
		expect(arrive.position).toEqual([10, 1]);
		// Beyond the end, turning left (towards -Z).
		expect(halfway.position[0]).toBeCloseTo(11);
		expect(halfway.position[1]).toBeCloseTo(0);
		expect(halfway.heading).toBeCloseTo(Math.PI / 2);
		expect(leave.position[0]).toBeCloseTo(10);
		expect(leave.position[1]).toBeCloseTo(-1);
		expect(Math.cos(leave.heading)).toBeCloseTo(-1);
		// A whole round trip (both U-turns) without jumps.
		const period = 2 * 10 + 2 * Math.PI;
		const jumps = biggestJump(sampler, 0, period);
		expect(jumps.position).toBeLessThan(0.1);
		expect(jumps.heading).toBeLessThan(0.1);
	});

	it("turns on the spot at the ends when there is no lane", () => {
		const sampler = createPathSampler(
			[
				[0, 0],
				[10, 0],
			],
			false,
			{ smoothing: 1 },
		);
		const mid = sampler.at(10.6); // halfway through the 1.2-unit pivot
		expect(mid.position[0]).toBeCloseTo(10);
		expect(mid.position[1]).toBeCloseTo(0);
		expect(mid.heading).toBeCloseTo(Math.PI / 2);
		expect(biggestJump(sampler, 0, 22.4).heading).toBeLessThan(0.2);
	});
});
