import { describe, expect, it } from "vitest";

import { startTourClock, steppedIndex, tickTour } from "./viewpointTour";

describe("viewpoint tour", () => {
	it("steps round and round, starting from either end", () => {
		expect(steppedIndex(0, 3, 1)).toBe(1);
		expect(steppedIndex(2, 3, 1)).toBe(0);
		expect(steppedIndex(0, 3, -1)).toBe(2);
		expect(steppedIndex(-1, 3, 1)).toBe(0);
		expect(steppedIndex(-1, 3, -1)).toBe(2);
		// A viewpoint that was deleted from the end: starts again.
		expect(steppedIndex(5, 3, 1)).toBe(0);
		expect(steppedIndex(0, 0, 1)).toBe(-1);
	});

	it("moves on at once when started, unless it holds first where the world opened", () => {
		const timing = { count: 3, glideSeconds: 1, holdSeconds: 5 };
		const fromNowhere = startTourClock(-1, 10, { holdsFirst: true, holdSeconds: 5 });
		expect(tickTour(fromNowhere, 10, timing).goesTo).toBe(0);
		const fromSecond = startTourClock(1, 10, { holdsFirst: false, holdSeconds: 5 });
		expect(tickTour(fromSecond, 10, timing).goesTo).toBe(2);
		const holding = startTourClock(1, 10, { holdsFirst: true, holdSeconds: 5 });
		expect(tickTour(holding, 14.9, timing).goesTo).toBeNull();
		expect(tickTour(holding, 15, timing).goesTo).toBe(2);
	});

	it("glides, holds and moves on, looping", () => {
		const timing = { count: 2, glideSeconds: 1, holdSeconds: 5 };
		let clock = startTourClock(-1, 0, { holdsFirst: false, holdSeconds: 5 });
		const went: [number, number][] = [];
		for (let now = 0; now <= 20; now += 0.5) {
			const tick = tickTour(clock, now, timing);
			clock = tick.clock;
			if (tick.goesTo !== null) {
				went.push([now, tick.goesTo]);
			}
		}
		// Each stop takes the glide and the hold: 6 seconds.
		expect(went).toEqual([
			[0, 0],
			[6, 1],
			[12, 0],
			[18, 1],
		]);
	});

	it("goes nowhere without viewpoints", () => {
		const clock = startTourClock(-1, 0, { holdsFirst: false, holdSeconds: 5 });
		expect(tickTour(clock, 100, { count: 0, glideSeconds: 1, holdSeconds: 5 })).toEqual({
			clock,
			goesTo: null,
		});
	});
});
