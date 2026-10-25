import { describe, expect, it } from "vitest";

import { farthestSpanOf, zoomLimits } from "./cameraMath";

const ground = { width: 40, depth: 30 };

describe("zoomLimits", () => {
	it("zooms out automatically by the ground's size, or as far as the world says", () => {
		expect(farthestSpanOf({ farthestSpan: null }, ground)).toBe(125);
		expect(farthestSpanOf({ farthestSpan: null }, { width: 4, depth: 4 })).toBe(120);
		expect(farthestSpanOf({ farthestSpan: 300 }, ground)).toBe(300);
	});

	it("shows the same span at each limit in both cameras", () => {
		const limits = zoomLimits({ closestSpan: 4, farthestSpan: 200, fieldOfView: 40 }, ground, 800);
		expect(800 / limits.maxZoom).toBeCloseTo(4, 5);
		expect(800 / limits.minZoom).toBeCloseTo(200, 5);
		// The perspective camera's height of view at its target, 2·d·tan(fov/2).
		const spanAt = (distance: number) => 2 * distance * Math.tan((20 * Math.PI) / 180);
		expect(spanAt(limits.minDistance)).toBeCloseTo(4, 5);
		expect(spanAt(limits.maxDistance)).toBeCloseTo(200, 5);
	});

	it("never zooms out less far than it zooms in", () => {
		const limits = zoomLimits({ closestSpan: 50, farthestSpan: 20, fieldOfView: 40 }, ground, 800);
		expect(limits.minZoom).toBe(limits.maxZoom);
	});
});
