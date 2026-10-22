import * as THREE from "three";
import { beforeEach, describe, expect, it } from "vitest";

import { useEditor } from "#/editor/store";
import { SceneSchema, type TRoadInput } from "#/scene/schema";

import { createVehicleRouteDrag, findRouteDrop } from "./routeDrop";

const load = (road: Partial<TRoadInput>, driving: "right" | "left" = "right") =>
	useEditor.getState().loadScene(
		SceneSchema.parse({
			version: 1,
			driving,
			roads: [
				{
					id: "r",
					cornerRadius: 0,
					points: [
						[0, 0],
						[10, 0],
					],
					...road,
				},
			],
		}),
	);

/** A ray straight down onto the ground at (x, z). */
const down = (x: number, z: number) =>
	new THREE.Ray(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));

describe("findRouteDrop", () => {
	beforeEach(() => load({}));

	it("misses when the pointer isn't over a road", () => {
		expect(findRouteDrop(down(5, 4), { vehicleLength: 1 })).toBeNull();
	});

	it("picks the direction of the lane under the pointer", () => {
		// Driving on the right: going +X, the lane is on the +Z side.
		const forward = findRouteDrop(down(5.2, 0.6), { vehicleLength: 1 });
		expect(forward).toMatchObject({ roadId: "r", reverse: false, offset: 5, rotation: 0 });
		expect(forward?.position[1]).toBeGreaterThan(0);

		const back = findRouteDrop(down(5.2, -0.6), { vehicleLength: 1 });
		expect(back).toMatchObject({ reverse: true, offset: 5, rotation: 180 });
		expect(back?.position[1]).toBeLessThan(0);
	});

	it("swaps lanes when driving on the left", () => {
		load({}, "left");
		expect(findRouteDrop(down(5, 0.6), { vehicleLength: 1 })?.reverse).toBe(true);
	});

	it("picks the direction by the half of the road on roads without lanes too", () => {
		for (const road of [{ lane: "centre" as const }, { style: "hidden" as const }]) {
			load(road);
			const forward = findRouteDrop(down(5, 0.3), { vehicleLength: 1 });
			expect(forward).toMatchObject({ reverse: false, rotation: 0 });
			expect(forward?.position[1]).toBeCloseTo(0);
			expect(findRouteDrop(down(5, -0.3), { vehicleLength: 1 })).toMatchObject({
				reverse: true,
				rotation: 180,
			});
		}
	});

	it("parks on an elevated road at its height", () => {
		load({
			points: [
				[0, 0, 3],
				[10, 0, 3],
			],
		});
		// Seen from an angle, the deck is where the ray is at height 3, not where it meets the ground.
		const slanted = new THREE.Ray(
			new THREE.Vector3(5, 13, 10.6),
			new THREE.Vector3(0, -1, -1).normalize(),
		);
		expect(findRouteDrop(slanted, { vehicleLength: 1 })).toMatchObject({ height: 3 });
	});
});

describe("createVehicleRouteDrag", () => {
	/** Two parallel roads along X, at z = 0 and z = 6, and a van driving the first. */
	const loadWithDriver = () => {
		useEditor.getState().loadScene(
			SceneSchema.parse({
				version: 1,
				roads: [
					{
						id: "a",
						cornerRadius: 0,
						points: [
							[0, 0],
							[10, 0],
						],
					},
					{
						id: "b",
						cornerRadius: 0,
						points: [
							[0, 6],
							[10, 6],
						],
					},
				],
				entities: [
					{ id: "van", kind: "van", rotation: 0, follow: { roadId: "a", speed: 4, offset: 2 } },
				],
			}),
		);
	};
	const van = () => useEditor.getState().scene.entities.find((e) => e.id === "van");
	const options = { coalesce: "drag:test", gesture: true };
	const pose = { position: [3, 0.5] as [number, number], elevation: 0, rotation: 0 };

	beforeEach(loadWithDriver);

	it("doesn't pick up a driving vehicle without knowing where it is", () => {
		expect(createVehicleRouteDrag("van")).toBeNull();
	});

	it("moves a driving vehicle onto another road, keeping its speed, as one undo step", () => {
		const drag = createVehicleRouteDrag("van", pose);
		drag?.start(options);
		expect(van()?.follow).toBeNull();
		expect(van()?.position).toEqual([3, 0.5]);
		expect(useEditor.getState().rerouting).toBe(true);

		expect(drag?.move(down(7, 6.6), [7, 6.6], false, options)).toBe(true);
		drag?.end(true, options);
		expect(van()?.follow).toMatchObject({ roadId: "b", offset: 7, reverse: false, speed: 4 });
		expect(useEditor.getState().followOffer).toBeNull();
		expect(useEditor.getState().rerouting).toBe(false);

		useEditor.getState().undo();
		expect(van()?.follow).toMatchObject({ roadId: "a", offset: 2 });
	});

	it("parks a driving vehicle dropped off the roads", () => {
		const drag = createVehicleRouteDrag("van", pose);
		drag?.start(options);
		expect(drag?.move(down(5, 3), [5, 3], false, options)).toBe(false);
		drag?.end(true, options);
		expect(van()?.follow).toBeNull();
	});

	it("offers to drive a parked vehicle dropped on a road", () => {
		useEditor.getState().updateEntity("van", (e) => {
			e.follow = null;
		});
		const drag = createVehicleRouteDrag("van");
		drag?.start(options);
		drag?.move(down(7, 6.6), [7, 6.6], false, options);
		drag?.end(true, options);
		expect(van()?.follow).toBeNull();
		expect(useEditor.getState().followOffer).toMatchObject({ roadId: "b", offset: 7 });
	});
});
