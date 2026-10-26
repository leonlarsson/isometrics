import { describe, expect, it } from "vitest";

import { getPart, PARTS } from "#/parts/registry";

import {
	LEGACY_AREA_TYPES,
	LEGACY_PART_KINDS,
	LEGACY_ROAD_STYLES,
	upgradeLegacyIds,
} from "./legacy";
import { parseScene } from "./migrate";
import { parseOrRepairScene } from "./repair";
import type { TEntityLight } from "./schema";
import { AreaTypeSchema, RoadStyleSchema } from "./schema";

const oldWorld = () => ({
	version: 1,
	entities: [
		{ id: "e1", kind: "tower", position: [0, 0] },
		{ id: "e2", kind: "van", position: [4, 0] },
		{ id: "e3", kind: "house_01", position: [8, 0] },
	],
	roads: [
		{
			id: "r1",
			style: "hidden",
			points: [
				[0, 0],
				[5, 0],
			],
		},
	],
	areas: [
		{
			id: "a1",
			type: "water",
			points: [
				[0, 0],
				[4, 0],
				[4, 4],
			],
		},
	],
});

/** Every id in use, per kind of thing, with its table of old ids. */
const CURRENT = [
	{ what: "part kind", ids: PARTS.map((part) => part.kind), legacy: LEGACY_PART_KINDS },
	{ what: "road style", ids: RoadStyleSchema.options, legacy: LEGACY_ROAD_STYLES },
	{ what: "area type", ids: AreaTypeSchema.options, legacy: LEGACY_AREA_TYPES },
];

describe("current ids", () => {
	it("are snake_case with a two-digit variant number (ADR-0050)", () => {
		for (const { what, ids } of CURRENT) {
			for (const id of ids) {
				expect(id, `${what} ${id}`).toMatch(/^[a-z]+(?:_[a-z]+)*_\d{2}$/);
			}
		}
	});

	it("are never an old id, so an old world can't be upgraded into the wrong thing", () => {
		for (const { what, ids, legacy } of CURRENT) {
			for (const id of ids) {
				expect(Object.hasOwn(legacy, id), `${what} ${id} is also an old id`).toBe(false);
			}
		}
	});
});

describe("legacy ids", () => {
	it("map to ids that exist", () => {
		for (const kind of Object.values(LEGACY_PART_KINDS)) {
			expect(getPart(kind), kind).toBeDefined();
		}
		for (const style of Object.values(LEGACY_ROAD_STYLES)) {
			expect(RoadStyleSchema.safeParse(style).success, style).toBe(true);
		}
		for (const type of Object.values(LEGACY_AREA_TYPES)) {
			expect(AreaTypeSchema.safeParse(type).success, type).toBe(true);
		}
	});

	it("are upgraded when a world is parsed, without repairs", () => {
		const { scene, report } = parseOrRepairScene(oldWorld());
		expect(report).toBeNull();
		expect(scene.entities.map((entity) => entity.kind)).toEqual([
			"office_tower_01",
			"delivery_van_01",
			"house_01",
		]);
		expect(scene.roads[0].style).toBe("hidden_route_01");
		expect(scene.areas[0].type).toBe("water_01");
	});

	it("are upgraded in a world that needs repairing for another reason", () => {
		const world = { ...oldWorld(), driving: "sideways" };
		const { scene, report } = parseOrRepairScene(world);
		expect(report?.fixed).toBe(1);
		expect(scene.entities[0].kind).toBe("office_tower_01");
		expect(scene.roads[0].style).toBe("hidden_route_01");
		expect(scene.areas[0].type).toBe("water_01");
	});

	it("leave the input untouched, so it can be kept as a backup", () => {
		const world = oldWorld();
		const before = structuredClone(world);
		parseScene(world);
		expect(world).toEqual(before);
	});

	it("leave a world without old ids as it is", () => {
		const world = { version: 1, entities: [{ id: "e1", kind: "house_01" }] };
		expect(upgradeLegacyIds(world)).toBe(world);
	});

	it("don't treat inherited object keys as old ids", () => {
		const world = { version: 1, entities: [{ id: "e1", kind: "toString" }] };
		expect(upgradeLegacyIds(world)).toBe(world);
	});
});

describe("legacy viewpoints", () => {
	it("say how the camera shows them as a projection instead of perspective: true or false", () => {
		const scene = parseScene({
			version: 1,
			viewpoints: [
				{ id: "a", perspective: true },
				{ id: "b", perspective: false },
				{ id: "c", projection: "perspective" },
				{ id: "d", projection: "diorama" },
			],
		});
		expect(scene.viewpoints.map((v) => v.projection)).toEqual([
			"perspective",
			"orthographic",
			"perspective",
			"orthographic",
		]);
		expect(scene.viewpoints[0]).not.toHaveProperty("perspective");
	});
});

describe("renamed fields (ADR-0071)", () => {
	const binding = { key: "queue", above: 5, full: 50, low: 10, high: 90 };
	const oldWorld = {
		version: 1,
		driving: "left",
		turns: "sharp",
		onScreen: {
			title: false,
			subtitle: false,
			timeOfDay: false,
			labelCards: false,
			details: false,
			viewpointBar: false,
		},
		lighting: { lights: "on" },
		traffic: { spacing: false, overtaking: false },
		camera: { turntable: true, tiltShift: true },
		roads: [
			{
				id: "r",
				points: [
					[0, 0],
					[4, 0],
					[4, 4],
				],
				closed: true,
				markings: false,
				railings: false,
				lane: "centre",
				turns: "sharp",
			},
		],
		entities: [
			{
				id: "car",
				kind: "car_01",
				follow: { roadId: "r", turns: "smooth" },
				lights: { headlights: { mode: "off", data: { strength: binding } } },
				colors: { body: { data: { color: binding } } },
			},
		],
		data: [{ key: "queue", value: 1 }],
	};

	it("keep their values under the new names, without repairs", () => {
		const { scene, report } = parseOrRepairScene(structuredClone(oldWorld));
		expect(report).toBeNull();
		expect(scene.drivingSide).toBe("left");
		expect(scene.turnStyle).toBe("sharp");
		expect(Object.values(scene.onScreen).every((shown) => shown === false)).toBe(true);
		expect(scene.lighting.whenLightsAreOn).toBe("on");
		expect(scene.traffic).toEqual({ keepSpacing: false, allowOvertaking: false });
		expect(scene.camera).toMatchObject({ turntableOn: true, tiltShiftOn: true });
		expect(scene.roads[0]).toMatchObject({
			loops: true,
			showMarkings: false,
			showRailings: false,
			drivingLane: "centre",
			turnStyle: "sharp",
		});
		const [car] = scene.entities;
		expect(car.follow?.turnStyle).toBe("smooth");
		const lights = car.lights as Record<string, TEntityLight>;
		expect(lights.headlights.whenOn).toBe("off");
		const renamed = { onAbove: 5, valueAtFull: 50, valueAtLowColor: 10, valueAtHighColor: 90 };
		expect(lights.headlights.data.strength).toMatchObject(renamed);
		expect(car.colors.body.data.color).toMatchObject(renamed);
	});

	it("leave the input untouched, and a value under the new name wins", () => {
		const input = structuredClone(oldWorld);
		upgradeLegacyIds(input);
		expect(input).toEqual(oldWorld);
		expect(parseScene({ version: 1, driving: "left", drivingSide: "right" }).drivingSide).toBe(
			"right",
		);
	});
});
