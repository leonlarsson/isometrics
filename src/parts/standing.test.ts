import { describe, expect, it } from "vitest";

import { AreaSchema, EntitySchema, type TArea, type TEntity } from "#/scene/schema";

import { altitudeMovedTo, standingAltitudeAt, topsToStandOn } from "./standing";

const box = (id: string, extra: Partial<TEntity> & { props?: Record<string, unknown> } = {}) =>
	EntitySchema.parse({ id, kind: "box_01", ...extra });

const plateau = (height: number): TArea =>
	AreaSchema.parse({
		id: "land",
		kind: "raised_land_01",
		points: [
			[-10, -10],
			[10, -10],
			[10, 10],
			[-10, 10],
		],
		height,
	});

describe("what things stand on (ADR-0138)", () => {
	it("stands on a shape's top within its footprint, the ground beside it", () => {
		const world = { areas: [], entities: [box("a", { props: { width: 2, height: 1.5 } })] };
		expect(standingAltitudeAt(world, [0, 0])).toBe(1.5);
		expect(standingAltitudeAt(world, [0.9, 0.4])).toBe(1.5);
		expect(standingAltitudeAt(world, [1.2, 0])).toBe(0);
		// Never on itself.
		expect(standingAltitudeAt(world, [0, 0], { except: "a" })).toBe(0);
		expect(standingAltitudeAt(world, [0, 0], { except: new Set(["a"]) })).toBe(0);
	});

	it("follows where a shape stands, how it's turned and its size", () => {
		const world = {
			areas: [plateau(2)],
			entities: [
				box("a", {
					position: [5, 5],
					altitude: 2,
					rotation: [0, 90, 0],
					scale: 2,
					props: { width: 2 },
				}),
			],
		};
		// Turned a quarter, its width runs along Z; twice the size, it's 4 by 2 and 2 tall.
		expect(standingAltitudeAt(world, [5, 6.9])).toBe(4);
		expect(standingAltitudeAt(world, [6.9, 5])).toBe(2);
		expect(standingAltitudeAt(world, [0, 0])).toBe(2);
	});

	it("stands on the highest of shapes stacked, and on what's at or below it where it is", () => {
		const world = {
			areas: [],
			entities: [box("bottom"), box("top", { altitude: 1 }), box("other", { position: [3, 0] })],
		};
		expect(standingAltitudeAt(world, [0, 0])).toBe(2);
		expect(standingAltitudeAt(world, [0, 0], { except: "top", base: 1 })).toBe(1);
		// A copy left where the bottom one stands isn't what it stands on.
		expect(standingAltitudeAt(world, [0, 0], { except: "bottom", base: 0 })).toBe(0);
	});

	it("stands on the top of a tipped shape's box as it's turned", () => {
		// Tipped a quarter about X on its foot, a box 3 tall lies along Z, half in the ground.
		const lying = box("a", { rotation: [90, 0, 0], props: { height: 3 } });
		const world = { areas: [], entities: [lying] };
		expect(standingAltitudeAt(world, [0, 2])).toBeCloseTo(0.5);
		const [top] = topsToStandOn(world);
		expect(top.maxZ - top.minZ).toBeCloseTo(3);
		expect(top.highestAltitude).toBeCloseTo(0.5);
	});

	it("keeps out what nothing stands on: other parts, flat ones, hidden and driving ones", () => {
		const world = {
			areas: [],
			entities: [
				EntitySchema.parse({ id: "house", kind: "house_01" }),
				EntitySchema.parse({ id: "zone", kind: "zone_01" }),
				box("hidden", { isHidden: true }),
			],
		};
		expect(topsToStandOn(world)).toHaveLength(0);
		expect(standingAltitudeAt(world, [0, 0])).toBe(0);
	});

	it("moves things onto a shape's top and off it, as high above it as they were", () => {
		const world = {
			areas: [],
			entities: [box("pedestal", { position: [4, 0] }), box("a"), box("sign", { altitude: 0.5 })],
		};
		const a = world.entities[1];
		expect(altitudeMovedTo(world, a, [4, 0])).toBe(1);
		const onTop = { ...a, position: [4, 0] as [number, number], altitude: 1 };
		expect(altitudeMovedTo(world, onTop, [0, 3])).toBe(0);
		// One lifted on purpose keeps its lift.
		expect(altitudeMovedTo(world, world.entities[2], [4, 0])).toBe(1.5);
	});
});
