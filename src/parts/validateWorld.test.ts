import { describe, expect, it } from "vitest";

import { createEmptyScene, TEMPLATES } from "#/templates";

import { issuesForAi, validatePatch, validateWorld } from "./validateWorld";

/**
 * Warnings a template is known to have, each a thing to fix in the template (found when
 * the check came in): any other is new, and fails. Fixed, take it out.
 */
const KNOWN_WARNINGS: Record<string, string[]> = {};

/** A small world of these things on an empty ground, checked: its warnings, one per line. */
const warningsOf = (world: Record<string, unknown>) =>
	validateWorld(JSON.parse(JSON.stringify({ ...createEmptyScene(), ...world })))
		.warnings.map((issue) => `${issue.where}: ${issue.what}`)
		.join("\n");

/** A straight road along x, from `from` to `to`, 2.4 wide. */
const straightRoad = (
	id: string,
	from: number,
	to: number,
	more: Record<string, unknown> = {},
) => ({
	id,
	points: [
		[from, 0],
		[to, 0],
	],
	...more,
});

describe("checking a world", () => {
	it.each(TEMPLATES.map((template) => [template.id, template.create] as const))(
		"%s checks out with no problems or warnings but those known",
		(id, create) => {
			const check = validateWorld(JSON.parse(JSON.stringify(create())));
			expect(check.problems).toEqual([]);
			expect(check.warnings.map((issue) => issue.where)).toEqual(KNOWN_WARNINGS[id] ?? []);
			expect(check.isValid).toBe(true);
		},
	);

	it("says what isn't a world at all", () => {
		expect(validateWorld([]).isUnreadable).toBe(true);
		expect(validateWorld({ hello: 1 }).isUnreadable).toBe(true);
	});

	it("names problems by path and id, and what opening would repair", () => {
		const check = validateWorld({
			version: 1,
			entities: [
				{ id: "a", kind: "house_01", position: [0, 0] },
				{ id: "b", kind: "house_01", position: "here" },
				{ id: "a", kind: "house_01", position: [2, 0] },
			],
		});
		expect(check.isValid).toBe(false);
		expect(check.problems.some((issue) => issue.where.startsWith('entities[1] "b".position'))).toBe(
			true,
		);
		expect(check.problems.some((issue) => issue.what.includes('id "a" is used twice'))).toBe(true);
		expect(check.repairs).toContain("object");
	});

	it("warns of what opens but won't look as meant", () => {
		const world = {
			...createEmptyScene({ ground: { width: 20, depth: 20 } }),
			entities: [
				{ id: "x", kind: "spaceship_99", position: [0, 0] },
				{
					id: "h",
					kind: "house_01",
					position: [9.8, 0],
					props: { wings: 2 },
					dataRow: { tableKey: "nope", rowKey: "r" },
					label: { isShown: true, dataKeys: ["sales"] },
				},
			],
			camera: { openingViewpointId: "gone" },
		};
		const check = validateWorld(JSON.parse(JSON.stringify(world)));
		const said = check.warnings.map((issue) => `${issue.where}: ${issue.what}`).join("\n");
		expect(said).toContain('"spaceship_99" isn\'t a part kind');
		expect(said).toContain('no prop "wings"');
		expect(said).toContain('table "nope"');
		expect(said).toContain('shows "sales", which reads nothing');
		expect(said).toContain("over the ground's edge");
		expect(said).toContain('"gone" isn\'t one of its viewpoints');
		expect(issuesForAi(check)).toContain("send the whole world again");
	});

	it("warns of an area following a row that isn't there, or weather following nothing (ADR-0152)", () => {
		const said = warningsOf({
			data: {
				enabled: true,
				tables: [
					{
						key: "districts",
						keyColumn: "district",
						columns: [{ key: "district" }, { key: "complaints" }],
						rows: [{ district: "North", complaints: 3 }],
					},
				],
			},
			areas: [
				{
					id: "north",
					kind: "hidden_area_01",
					points: [
						[0, 0],
						[4, 0],
						[4, 4],
					],
					dataRow: { tableKey: "districts", rowKey: "North" },
					weather: { data: { rainAmount: { key: "row.complaints" } } },
				},
				{
					id: "south",
					kind: "hidden_area_01",
					points: [
						[0, 5],
						[4, 5],
						[4, 9],
					],
					dataRow: { tableKey: "districts", rowKey: "South" },
					weather: { data: { rainAmount: { key: "row.mood" } } },
				},
			],
		});
		expect(said).not.toContain('"north"');
		expect(said).toContain('areas[1] "south".dataRow: follows row "South"');
		expect(said).toContain('areas[1] "south".weather.data.rainAmount: follows "row.mood"');
	});

	it("warns of junction ends that aren't road ends meeting at one place (ADR-0136)", () => {
		const world = {
			...createEmptyScene(),
			roads: [
				{
					id: "a",
					points: [
						[0, 0],
						[5, 0],
					],
				},
				{
					id: "b",
					points: [
						[5.1, 0],
						[5, 5],
					],
				},
				{
					id: "c",
					points: [
						[20, 0],
						[30, 0],
					],
				},
			],
			junctions: [
				{
					id: "j",
					ends: [
						{ roadId: "a", end: "end" },
						{ roadId: "b", end: "start" },
						{ roadId: "c", end: "start" },
						{ roadId: "gone", end: "end" },
					],
				},
			],
		};
		const check = validateWorld(JSON.parse(JSON.stringify(world)));
		const said = check.warnings.map((issue) => `${issue.where}: ${issue.what}`).join("\n");
		expect(said).toContain('junctions[0] "j".ends[1]: the start of road "b" isn\'t quite where');
		expect(said).toContain('the start of road "c" is 15.0 from the junction');
		expect(said).toContain('road "gone" doesn\'t exist');
		expect(said).not.toContain("fewer than two");
	});
});

describe("warning of objects inside each other", () => {
	it("names each pair once, with how much they overlap", () => {
		const said = warningsOf({
			entities: [
				{ id: "a", kind: "house_01", position: [0, 0] },
				{ id: "b", kind: "house_01", position: [1, 0] },
			],
		});
		expect(said).toContain('entities[0] "a".position: stands inside "b": they overlap by 1.7');
		expect(said).not.toContain('"b".position');
	});

	it("passes over what's meant to sit on or in things, and what stands on another", () => {
		const said = warningsOf({
			entities: [
				{ id: "house", kind: "house_01", position: [0, 0] },
				// Apart.
				{ id: "neighbour", kind: "house_01", position: [10, 0] },
				// A marker, a flat zone, a hidden object and a vehicle on a road, all in the house.
				{ id: "beacon", kind: "beacon_01", position: [0, 0] },
				{ id: "zone", kind: "zone_01", position: [0, 0] },
				{ id: "hidden", kind: "house_01", position: [0.5, 0], isHidden: true },
				{ id: "car", kind: "car_01", position: [0, 0], follow: { roadId: "r" } },
				// A container stacked on another (ADR-0138).
				{ id: "low", kind: "shipping_container_01", position: [20, 0] },
				{ id: "high", kind: "shipping_container_01", position: [20, 0], altitude: 0.7 },
			],
			roads: [straightRoad("r", -30, -20)],
		});
		expect(said).not.toContain("stands inside");
	});

	it("stops counting pairs in a world of thousands in one place", () => {
		const check = validateWorld(
			JSON.parse(
				JSON.stringify({
					...createEmptyScene(),
					entities: Array.from({ length: 2000 }, (_, i) => ({
						id: `e${i}`,
						kind: "house_01",
						position: [0, 0],
					})),
				}),
			),
		);
		expect(
			check.warnings.some((issue) => issue.what === "and more objects inside each other"),
		).toBe(true);
	});
});

describe("warning of objects on roads", () => {
	it("warns of one whose middle or most of it is on a road", () => {
		const said = warningsOf({
			entities: [
				{ id: "middle", kind: "house_01", position: [0, 0] },
				// In the middle of a small ring road: its middle off the road, but most of it on it.
				{ id: "most", kind: "house_01", position: [0, 30] },
			],
			roads: [
				straightRoad("main", -20, 20),
				{
					id: "ring",
					points: [
						[-2, 28],
						[2, 28],
						[2, 32],
						[-2, 32],
					],
					loops: true,
					cornerRadius: 2,
				},
			],
		});
		expect(said).toContain(
			'entities[0] "middle".position: [0, 0] is on road "main" (its middle): vehicles on the road drive through it',
		);
		expect(said).toContain('entities[1] "most".position: [0, 30] is on road "ring" (most of it)');
	});

	it("sums up more than ten", () => {
		const said = warningsOf({
			entities: Array.from({ length: 13 }, (_, i) => ({
				id: `h${i}`,
				kind: "bench_01",
				position: [i * 2 - 12, 0],
			})),
			roads: [straightRoad("main", -20, 20)],
		});
		expect(said.match(/is on road "main"/g)).toHaveLength(10);
		expect(said).toContain("entities: and 3 more objects on roads");
	});

	it("passes over what stands beside it, at its kerb, parked on it, made for it or under it", () => {
		const said = warningsOf({
			entities: [
				{ id: "beside", kind: "house_01", position: [0, 4] },
				// A lamp at the kerb, reaching just onto the road.
				{ id: "lamp", kind: "street_lamp_01", position: [4, 1.3] },
				{ id: "parked", kind: "car_01", position: [-4, 0.5] },
				{ id: "tunnel", kind: "tunnel_01", position: [10, 0] },
				{ id: "hidden", kind: "house_01", position: [-10, 0], isHidden: true },
				// Under a bridge, and on a hidden route.
				{ id: "under", kind: "house_01", position: [0, 30] },
				{ id: "route", kind: "house_01", position: [0, -30] },
			],
			roads: [
				straightRoad("main", -20, 20),
				{
					id: "bridge",
					points: [
						[-10, 30, 4],
						[10, 30, 4],
					],
				},
				{
					id: "ferry",
					kind: "hidden_route_01",
					points: [
						[-10, -30],
						[10, -30],
					],
				},
			],
		});
		expect(said).not.toContain("is on road");
	});
});

describe("warning of flows that can't work", () => {
	it("warns of a flow on a road too short for its vehicles to reach full size", () => {
		const said = warningsOf({
			roads: [
				straightRoad("stub", 0, 3, { flow: { enabled: true } }),
				straightRoad("long", 0, 20, { flow: { enabled: true } }),
				// Off: no flow to draw.
				straightRoad("off", 0, 3),
			].map((road, index) => ({ ...road, points: road.points.map(([x]) => [x, index * 10]) })),
		});
		expect(said).toContain(
			'roads[0] "stub".flow: the road is 3 long, too short for its flow\'s vehicles to reach full size',
		);
		expect(said).toContain("at least 4.3");
		expect(said).not.toContain('"long".flow');
		expect(said).not.toContain('"off".flow');
	});

	it("warns once of a flow on a road joined at a junction, unless its amount follows data", () => {
		const said = warningsOf({
			roads: [
				straightRoad("west", -20, 0, { flow: { enabled: true } }),
				straightRoad("east", 0, 20),
				{
					id: "south",
					points: [
						[0, 0],
						[0, 20],
					],
					flow: { enabled: true },
					data: { vehicleDensity: { key: "busy" } },
				},
			],
			junctions: [
				{
					id: "j",
					ends: [
						{ roadId: "west", end: "end" },
						{ roadId: "east", end: "start" },
						{ roadId: "south", end: "start" },
					],
				},
			],
			data: { enabled: true, values: [{ key: "busy", label: "Busy", value: 3 }] },
		});
		expect(said.match(/joined at a junction/g)).toHaveLength(1);
		expect(said).toContain(
			'roads[0] "west".flow: the road is joined at a junction, but its flow\'s vehicles stay on this road',
		);
		expect(said).toContain("turn on its `flow.drivesThroughJunctions`");
		expect(said).toContain("place vehicle objects that follow the road (`follow`)");
	});

	it("doesn't warn of a flow that drives on through its junction (ADR-0147), only of one with none", () => {
		const said = warningsOf({
			roads: [
				// Too short for a flow that keeps to it, but driving on it shrinks nowhere.
				straightRoad("west", -3, 0, { flow: { enabled: true, drivesThroughJunctions: true } }),
				straightRoad("east", 0, 20),
				straightRoad("alone", 40, 60, { flow: { enabled: true, drivesThroughJunctions: true } }),
			],
			junctions: [
				{
					id: "j",
					ends: [
						{ roadId: "west", end: "end" },
						{ roadId: "east", end: "start" },
					],
				},
			],
		});
		expect(said).not.toContain('"west".flow');
		expect(said).toContain(
			'roads[2] "alone".flow.drivesThroughJunctions: is on, but the road has no junction at either end',
		);
	});
});

describe("warning of one-way roads and turns that can't work (ADR-0148)", () => {
	it("warns of a one-way road into a junction with no way out, and of turns that aren't there", () => {
		const said = warningsOf({
			roads: [
				straightRoad("in", -20, 0, { isOneWay: true }),
				// One-way towards the junction too: no way out of it for "in".
				{
					id: "other",
					points: [
						[0, 20],
						[0, 0],
					],
					isOneWay: true,
				},
				straightRoad("out", 0, 20),
			],
			junctions: [
				{
					id: "j",
					ends: [
						{
							roadId: "in",
							end: "end",
							leadsTo: [
								{ roadId: "other", end: "end" },
								{ roadId: "nowhere", end: "start" },
							],
						},
						{ roadId: "other", end: "end" },
						{ roadId: "out", end: "start" },
					],
				},
			],
		});
		expect(said).toContain(
			'junctions[0] "j".ends[0].leadsTo: names the end of one-way road "other"',
		);
		expect(said).toContain('names the start of road "nowhere", which isn\'t another end');
		expect(said).toContain(
			'junctions[0] "j".ends[0]: one-way road "in" leads into this junction, but no way out of it is allowed (its leadsTo)',
		);
	});

	it("says nothing of one-way roads that lead on", () => {
		const said = warningsOf({
			roads: [
				straightRoad("in", -20, 0, { isOneWay: true }),
				straightRoad("out", 0, 20, { isOneWay: true }),
			],
			junctions: [
				{
					id: "j",
					ends: [
						{ roadId: "in", end: "end" },
						{ roadId: "out", end: "start" },
					],
				},
			],
		});
		expect(said).toBe("");
	});
});

describe("checking a patch", () => {
	it("checks the world it makes, says what it changes, and its own problems by place", () => {
		const world = createEmptyScene({ title: "Harbour" });
		const fine = validatePatch(world, {
			isPatch: true,
			entities: { add: [{ id: "h", kind: "house_01", name: "Corner house", position: [0, 0] }] },
		});
		expect(fine.isValid).toBe(true);
		expect(fine.changes).toBe("Adds Corner house.");

		const broken = validatePatch(world, {
			isPatch: true,
			entities: {
				change: [{ id: "nope", scale: 2 }],
				add: [{ id: "x", kind: "spaceship_99", position: [0, 0] }],
			},
		});
		expect(broken.isValid).toBe(false);
		expect(broken.problems[0].where).toBe("patch entities.change[0]");
		expect(broken.warnings.some((issue) => issue.what.includes("isn't a part kind"))).toBe(true);
		expect(issuesForAi(broken)).toContain("send the whole patch again");
	});
});

describe("very big worlds", () => {
	it("are warned of, not refused", () => {
		const world = {
			...createEmptyScene(),
			entities: Array.from({ length: 20_001 }, (_, i) => ({
				id: `e${i}`,
				kind: "house_01",
				position: [0, 0],
			})),
		};
		const check = validateWorld(JSON.parse(JSON.stringify(world)));
		expect(check.isUnreadable).toBe(false);
		expect(check.warnings.some((issue) => issue.what.includes("20,001 objects"))).toBe(true);
	});
});

describe("warning of a junction's ends at different altitudes (ADR-0148)", () => {
	it("says which end is left out, how far above it is, and how to fix it", () => {
		const said = warningsOf({
			roads: [
				straightRoad("low", -20, 0),
				{
					id: "high",
					points: [
						[0, 0, 3],
						[20, 0, 3],
					],
				},
			],
			junctions: [
				{
					id: "j",
					ends: [
						{ roadId: "low", end: "end" },
						{ roadId: "high", end: "start" },
					],
				},
			],
		});
		expect(said).toContain(
			'junctions[0] "j".ends[1]: the start of road "high" is at altitude 3.0, 3.0 above the junction\'s first end: it\'s left out (put it at the same altitude, or ramp the road to it)',
		);
	});
});

describe("warning of vehicles that would appear from nowhere (ADR-0148)", () => {
	const ring = (withEntry: boolean) => ({
		roads: [
			{
				id: "a",
				isOneWay: true,
				points: [
					[0, 0],
					[20, 0],
				],
			},
			{
				id: "b",
				isOneWay: true,
				points: [
					[20, 0],
					[20, 20],
				],
			},
			{
				id: "c",
				isOneWay: true,
				points: [
					[20, 20],
					[0, 0],
				],
			},
			{
				id: "d",
				isOneWay: true,
				points: [
					[20, 20],
					[40, 20],
				],
			},
			...(withEntry
				? [
						{
							id: "in",
							isOneWay: true,
							points: [
								[-20, 0],
								[0, 0],
							],
						},
					]
				: []),
		],
		junctions: [
			{
				id: "j0",
				ends: [
					{ roadId: "c", end: "end" },
					{ roadId: "a", end: "start" },
					...(withEntry ? [{ roadId: "in", end: "end" }] : []),
				],
			},
			{
				id: "j1",
				ends: [
					{ roadId: "a", end: "end" },
					{ roadId: "b", end: "start" },
				],
			},
			{
				id: "j2",
				ends: [
					{ roadId: "b", end: "end" },
					{ roadId: "c", end: "start" },
					{ roadId: "d", end: "start" },
				],
			},
		],
	});

	it("warns of a one-way dead end in a network nothing drives into, not once one road does", () => {
		expect(warningsOf(ring(false))).toContain(
			'one-way road "d" leads to a dead end, but no road drives into its network from an open end',
		);
		expect(warningsOf(ring(true))).not.toContain("drives into its network");
	});
});
