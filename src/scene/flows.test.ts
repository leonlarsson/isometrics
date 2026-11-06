import { describe, expect, it } from "vitest";

import {
	createFlowTrip,
	FLOW_EASE_LENGTH,
	flowDrivesOn,
	flowVehicleSeed,
	flowVehicleSize,
	type IFlowTripOptions,
} from "./flows";
import { roadNetworkOf } from "./junctions";
import { roadsDriven } from "./network";
import {
	JunctionSchema,
	RoadFlowSchema,
	RoadSchema,
	type TJunction,
	type TRoad,
	type TRoadInput,
} from "./schema";

const road = (id: string, points: TRoadInput["points"], input: Partial<TRoadInput> = {}): TRoad =>
	RoadSchema.parse({ id, points, cornerRadius: 0, ...input });

const junction = (id: string, ...ends: [string, "start" | "end"][]): TJunction =>
	JunctionSchema.parse({ id, ends: ends.map(([roadId, end]) => ({ roadId, end })) });

const drivingOn = { flow: { enabled: true, drivesThroughJunctions: true } };

/** Two roads end to end at a junction, the second a dead end; a third on its own. */
const network = () =>
	roadNetworkOf(
		[
			road(
				"first",
				[
					[0, 0],
					[20, 0],
				],
				drivingOn,
			),
			road("second", [
				[20, 0],
				[20, 20],
			]),
			road(
				"alone",
				[
					[40, 0],
					[60, 0],
				],
				drivingOn,
			),
		],
		[junction("j", ["first", "end"], ["second", "start"])],
	);

const tripOptions = (more: Partial<IFlowTripOptions> = {}): IFlowTripOptions => ({
	driving: "right",
	smoothing: 0.5,
	reverse: false,
	offset: 5,
	length: 20,
	index: 0,
	...more,
});

describe("a flow that drives on through junctions (ADR-0147)", () => {
	it("is off by default, and only drives on from a road with a junction at an end", () => {
		expect(RoadFlowSchema.parse({}).drivesThroughJunctions).toBe(false);
		const roads = network();
		const first = roads.roadById("first") as TRoad;
		const alone = roads.roadById("alone") as TRoad;
		expect(flowDrivesOn(roads, first)).toBe(true);
		expect(flowDrivesOn(roads, { ...first, flow: { ...first.flow, enabled: false } })).toBe(false);
		expect(
			flowDrivesOn(roads, { ...first, flow: { ...first.flow, drivesThroughJunctions: false } }),
		).toBe(false);
		expect(flowDrivesOn(roads, alone)).toBe(false);
	});

	it("crosses the junction onto the next road, whole, without shrinking there", () => {
		const trip = createFlowTrip(network(), "first", tripOptions());
		// From 5 along the first road: past its end (15 on) it's on the second.
		expect(roadsDriven(trip, 25)).toEqual(["first", "second"]);
		const atJunction = trip.at(0, 15);
		expect(atJunction.position[0]).toBeGreaterThan(18);
		// Where a flow keeping to its road shrinks to nothing, driving on it stays whole.
		expect(flowVehicleSize(5 + 15, 20, false)).toBeCloseTo(0);
		expect(flowVehicleSize(5 + 15, 20, true)).toBe(1);
		expect(flowVehicleSize(5 + 400, 20, true)).toBe(1);
	});

	it("turns round at a dead end and drives back, as a vehicle object does", () => {
		const trip = createFlowTrip(network(), "first", tripOptions());
		// The second road ends nowhere: it turns round there and comes back to the first.
		expect(roadsDriven(trip, 60)).toEqual(["first", "second", "first"]);
		const directions = new Set<number>();
		for (let d = 16; d < 50; d += 0.5) {
			const place = trip.place(0, d);
			if (place.network?.roadId === "second") {
				directions.add(place.direction);
			}
		}
		expect([...directions].sort()).toEqual([-1, 1]);
	});

	it("drives the other way from the road's last point, on to the junction at its first", () => {
		const roads = network();
		// The second road driven against its points goes from its dead end back onto the first.
		const trip = createFlowTrip(roads, "second", tripOptions({ reverse: true, offset: 2 }));
		expect(trip.place(0, 0).network).toMatchObject({ roadId: "second" });
		expect(trip.place(0, 0).direction).toBe(-1);
		expect(trip.at(0, 0).position[1]).toBeCloseTo(18, 0);
		expect(roadsDriven(trip, 30)[1]).toBe("first");
	});

	it("grows in once, at the start of its stream", () => {
		expect(flowVehicleSize(0, 20, true)).toBe(0);
		expect(flowVehicleSize(FLOW_EASE_LENGTH / 2, 20, true)).toBeCloseTo(0.5);
		expect(flowVehicleSize(FLOW_EASE_LENGTH, 20, true)).toBe(1);
		// Round again past its road's length it doesn't grow in a second time.
		expect(flowVehicleSize(20.1, 20, true)).toBe(1);
	});

	it("takes the same way every time for the same vehicle, a seed from its road, way and place", () => {
		const roads = roadNetworkOf(
			[
				road(
					"in",
					[
						[-20, 0],
						[0, 0],
					],
					drivingOn,
				),
				road("east", [
					[0, 0],
					[20, 0],
				]),
				road("north", [
					[0, 0],
					[0, -20],
				]),
				road("south", [
					[0, 0],
					[0, 20],
				]),
			],
			[junction("x", ["in", "end"], ["east", "start"], ["north", "start"], ["south", "start"])],
		);
		const ways = (index: number) =>
			roadsDriven(createFlowTrip(roads, "in", tripOptions({ index })), 200, 0.5);
		expect(ways(3)).toEqual(ways(3));
		const one = createFlowTrip(roads, "in", tripOptions({ index: 3 }));
		const again = createFlowTrip(roads, "in", tripOptions({ index: 3 }));
		for (let d = 0; d < 200; d += 7) {
			expect(again.at(0, d)).toEqual(one.at(0, d));
		}
		// Vehicles of a stream don't all go the same way.
		const firstTurns = new Set(Array.from({ length: 12 }, (_, index) => ways(index)[1]));
		expect(firstTurns.size).toBeGreaterThan(1);
		expect(flowVehicleSeed("in", false, 3)).not.toBe(flowVehicleSeed("in", true, 3));
		expect(flowVehicleSeed("in", false, 3)).not.toBe(flowVehicleSeed("in", false, 4));
	});
});

describe("a flow that keeps to its road", () => {
	it("grows in and shrinks out at its ends every time round, exactly as before (ADR-0112)", () => {
		// The size as RoadFlow worked it out before flows could drive on.
		const before = (distance: number, length: number) => {
			const along = length > 0 ? distance % length : 0;
			return Math.min(1, along / FLOW_EASE_LENGTH, (length - along) / FLOW_EASE_LENGTH);
		};
		for (const length of [0, 3, 12.5, 40]) {
			for (let distance = 0; distance < 100; distance += 0.37) {
				expect(Object.is(flowVehicleSize(distance, length, false), before(distance, length))).toBe(
					true,
				);
			}
		}
	});
});
