import { afterEach, describe, expect, it, vi } from "vitest";

import { roadNetworkOf } from "#/scene/junctions";
import { createNetworkTrip } from "#/scene/network";
import { SceneSchema } from "#/scene/schema";

import { boundsOf } from "./framing";
import {
	forgetVehicleNow,
	roadOfVehicleNow,
	setVehicleNow,
	subscribeToVehiclesNow,
	vehicleNow,
} from "./vehiclesNow";

/** Two roads meeting at a junction, and a car that starts on the first. */
const world = () =>
	SceneSchema.parse({
		version: 1,
		roads: [
			{
				id: "west",
				points: [
					[-20, 0],
					[0, 0],
				],
				cornerRadius: 0,
			},
			{
				id: "north",
				points: [
					[0, 0],
					[0, -20],
				],
				cornerRadius: 0,
			},
		],
		junctions: [
			{
				id: "j",
				ends: [
					{ roadId: "west", end: "end" },
					{ roadId: "north", end: "start" },
				],
			},
		],
		entities: [{ id: "car", kind: "car_01", follow: { roadId: "west", startDistance: 2 } }],
	});

afterEach(() => forgetVehicleNow("car"));

describe("where vehicles are now (ADR-0136)", () => {
	it("falls back to the road a vehicle starts on until it says where it is", () => {
		const car = world().entities[0];
		expect(roadOfVehicleNow(car)).toEqual({ roadId: "west", drivesTheOtherWay: false });
		expect(roadOfVehicleNow({ ...car, follow: null })).toBeNull();
	});

	it("names the road a vehicle's trip has taken it onto, and which way it drives it", () => {
		const scene = world();
		const car = scene.entities[0];
		const trip = createNetworkTrip(roadNetworkOf(scene.roads, scene.junctions), "west", {
			driving: "right",
			startDistance: 2,
			seed: car.id,
		});
		// Past the junction it's on the north road, as the vehicle draws itself it says so.
		const place = trip.place(2, 30);
		expect(place.network?.roadId).toBe("north");
		setVehicleNow(car.id, {
			roadId: place.network?.roadId ?? "",
			drivesTheOtherWay: place.direction < 0,
			centre: place.centre,
		});
		expect(roadOfVehicleNow(car)).toEqual({ roadId: "north", drivesTheOtherWay: false });
		// Framing it frames the road it's on now, not the one it started on.
		expect(boundsOf(scene, { kind: "entity", id: car.id })).toEqual(
			boundsOf(scene, { kind: "road", id: "north" }),
		);
		forgetVehicleNow(car.id);
		expect(roadOfVehicleNow(car)?.roadId).toBe("west");
	});

	it("tells views only when a vehicle changes road or way, not every frame", () => {
		const told = vi.fn();
		const stop = subscribeToVehiclesNow(told);
		setVehicleNow("car", { roadId: "west", drivesTheOtherWay: false, centre: 1 });
		setVehicleNow("car", { roadId: "west", drivesTheOtherWay: false, centre: 2 });
		expect(told).toHaveBeenCalledTimes(1);
		expect(vehicleNow("car")?.centre).toBe(2);
		setVehicleNow("car", { roadId: "west", drivesTheOtherWay: true, centre: 2 });
		forgetVehicleNow("car");
		forgetVehicleNow("car");
		expect(told).toHaveBeenCalledTimes(3);
		stop();
	});
});
