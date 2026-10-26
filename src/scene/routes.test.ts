import { describe, expect, it } from "vitest";

import { createRouteSampler, projectOntoRoad } from "./routes";
import { RoadSchema, type TRoadInput } from "./schema";

const road = (input: Partial<TRoadInput>) =>
	RoadSchema.parse({ id: "r", cornerRadius: 0, drivingLane: "centre", points: [], ...input });

const line = road({
	points: [
		[0, 0],
		[10, 0],
	],
});

const square = road({
	loops: true,
	points: [
		[0, 0],
		[10, 0],
		[10, 10],
		[0, 10],
	],
});

describe("createRouteSampler", () => {
	it("starts a reversed vehicle at the same offset, facing the other way", () => {
		for (const r of [line, square]) {
			const forward = createRouteSampler(r, "right").at(4);
			const back = createRouteSampler(r, "right", { reverse: true }).at(4);
			expect(back.position[0]).toBeCloseTo(forward.position[0]);
			expect(back.position[1]).toBeCloseTo(forward.position[1]);
			expect(Math.cos(back.heading - forward.heading)).toBeCloseTo(-1);
		}
	});

	it("places vehicles in their road's traffic: one cycle on open roads, two streams on loops", () => {
		const sideLine = road({ ...line, drivingLane: "side" });
		const forward = createRouteSampler(sideLine, "right");
		const back = createRouteSampler(sideLine, "right", { reverse: true });
		// Reversed on an open road is the same cycle, on the way back.
		const there = forward.place(4);
		const returning = back.place(4);
		expect(there).toMatchObject({ stream: "both", centre: 4, direction: 1, turning: false });
		expect(returning).toMatchObject({ stream: "both", direction: -1, turning: false });
		expect(returning.centre).toBeCloseTo(4);
		expect(returning.ring).toBe(there.ring);
		// Driving on from the far end, a forward vehicle turns and comes back the way the other went.
		expect(forward.place(4, 6.1).turning).toBe(true);

		const loopForward = createRouteSampler(square, "right").place(4, 3);
		const loopBack = createRouteSampler(square, "right", { reverse: true }).place(4, 3);
		expect(loopForward).toMatchObject({ stream: "forward", centre: 7, direction: 1 });
		expect(loopBack).toMatchObject({ stream: "reverse", direction: -1 });
		expect(loopBack.centre).toBeCloseTo(1);
	});

	it("drives loops the other way round when reversed", () => {
		const back = createRouteSampler(square, "right", { reverse: true });
		// From (4, 0) heading -X, two units later it's at (2, 0).
		const later = back.at(4, 2);
		expect(later.position[0]).toBeCloseTo(2);
		expect(later.position[1]).toBeCloseTo(0);
		// Past the first point it carries on up the closing side (0, 10) → (0, 0), backwards.
		const corner = back.at(4, 6);
		expect(corner.position[0]).toBeCloseTo(0);
		expect(corner.position[1]).toBeCloseTo(2);
	});

	it("puts a reversed vehicle in the other lane", () => {
		const sided = road({ ...line, drivingLane: "side", style: "road_01" });
		const forward = createRouteSampler(sided, "right").at(5);
		const back = createRouteSampler(sided, "right", { reverse: true }).at(5);
		expect(forward.position[1]).toBeGreaterThan(0);
		expect(back.position[1]).toBeLessThan(0);
	});
});

describe("projectOntoRoad", () => {
	it("finds the nearest point, its side and the road's direction there", () => {
		const right = projectOntoRoad(square, [4, 1]);
		expect(right?.offset).toBeCloseTo(4);
		expect(right?.gap).toBeCloseTo(1);
		// The square runs +X along its first side; right of +X is +Z.
		expect(right?.side).toBeGreaterThan(0);
		expect(right?.heading).toBeCloseTo(0);
		expect(projectOntoRoad(square, [4, -1])?.side).toBeLessThan(0);
	});

	it("includes the closing segment of loops", () => {
		const hit = projectOntoRoad(square, [0.5, 5]);
		expect(hit?.offset).toBeCloseTo(35);
		expect(hit?.gap).toBeCloseTo(0.5);
	});

	it("reports the road's height and width at the point", () => {
		const ramp = road({
			width: 2,
			points: [
				[0, 0, 0],
				[10, 0, 2],
			],
		});
		const hit = projectOntoRoad(ramp, [5, 0]);
		expect(hit?.halfWidth).toBeCloseTo(1);
		expect(hit?.height).toBeGreaterThan(0.5);
		expect(hit?.height).toBeLessThan(1.5);
	});
});
