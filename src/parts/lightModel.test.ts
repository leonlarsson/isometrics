import { describe, expect, it } from "vitest";

import { DataBindingSchema, EntityLightSchema, type TEntityLight } from "#/scene/schema";
import { scenePalettes } from "#/scene/theme";

import { DAYLIGHT_LEVEL, type IPartLights, resolveLights } from "./lightModel";

const night = { ...scenePalettes.light, night: 1 };
const day = { ...scenePalettes.light, night: 0 };
const dusk = { ...scenePalettes.light, night: 0.5 };

/** A stand-in part with a light of each kind of switching. */
const car: IPartLights = {
	lights: [
		{ id: "headlights", name: "Headlights", shape: "beam", when: "driving", reach: 2.4 },
		{ id: "rain", name: "Rain light", shape: "lens", color: "#ff2a2a", strength: 0.8 },
	],
	renamedLights: { lamps: "headlights" },
};

const lamp: IPartLights = {
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			shape: "pool",
			reach: 2.3,
			color: "#ffe8a3",
			legacy: ({ props, accent }) => ({
				strength: typeof props.brightness === "number" ? props.brightness : null,
				reach: typeof props.reach === "number" ? props.reach : null,
				color: accent,
			}),
		},
	],
};

const setting = (fields: Partial<TEntityLight>) => EntityLightSchema.parse(fields);

/** A data binding to the value `key`, with options. */
const bind = (key: string, options: { onAbove?: number; valueAtFull?: number } = {}) =>
	DataBindingSchema.parse({ key, ...options });

const entity = (lights: Record<string, TEntityLight> | "auto" | "on" | "off" = {}, props = {}) => ({
	props,
	accent: null,
	lights,
});

describe("resolveLights (ADR-0058)", () => {
	it("lights after dark, at once by default, and headlights only while driving", () => {
		expect(resolveLights(car, entity(), { palette: day, driving: true }).rain.on).toBe(false);
		expect(resolveLights(car, entity(), { palette: dusk, driving: false })).toMatchObject({
			rain: { on: true, level: 0.8, color: "#ff2a2a" },
			headlights: { on: false, level: 0 },
		});
		expect(resolveLights(car, entity(), { palette: night, driving: true }).headlights).toEqual({
			on: true,
			level: 1,
			color: night.lamplight,
			reach: 2.4,
			litPanes: 1,
			weight: 1,
		});
	});

	it("follows an object's own settings per light: always, never, colour, strength, reach", () => {
		const lights = resolveLights(
			car,
			entity({
				headlights: setting({ whenOn: "on", color: "#ffffff", strength: 2, reach: 4 }),
				rain: setting({ whenOn: "off" }),
			}),
			{ palette: day, driving: false },
		);
		expect(lights.headlights).toEqual({
			on: true,
			level: 2,
			color: "#ffffff",
			reach: 4,
			litPanes: 1,
			weight: 1,
		});
		expect(lights.rain.on).toBe(false);
	});

	it("keeps lights that are always on lit by day, dimmer, and glowing fully after dark", () => {
		const signal: IPartLights = {
			lights: [{ id: "red", name: "Red", shape: "lens", when: "always", strength: 2 }],
		};
		expect(resolveLights(signal, entity(), { palette: day, driving: false }).red).toMatchObject({
			on: true,
			level: 2 * DAYLIGHT_LEVEL,
		});
		expect(resolveLights(signal, entity(), { palette: night, driving: false }).red.level).toBe(2);
		const off = entity({ red: setting({ whenOn: "off" }) });
		expect(resolveLights(signal, off, { palette: night, driving: false }).red.on).toBe(false);
	});

	it("reads the one setting older worlds had for all of an object's lights", () => {
		const always = resolveLights(car, entity("on"), { palette: day, driving: false });
		expect(always.headlights.on && always.rain.on).toBe(true);
		const never = resolveLights(car, entity("off"), { palette: night, driving: true });
		expect(never.headlights.on || never.rain.on).toBe(false);
	});

	it("keeps an object's settings for a light whose id changed", () => {
		const lights = resolveLights(car, entity({ lamps: setting({ color: "#00ff00" }) }), {
			palette: night,
			driving: true,
		});
		expect(lights.headlights.color).toBe("#00ff00");
	});

	it("takes what older worlds stored elsewhere (a lamp's props and accent) until it's set", () => {
		const old = resolveLights(
			lamp,
			{ props: { brightness: 2, reach: 5 }, accent: "#ff8800", lights: "auto" },
			{ palette: night, driving: false },
		);
		expect(old.lamp).toEqual({
			on: true,
			level: 2,
			color: "#ff8800",
			reach: 5,
			litPanes: 1,
			weight: 1,
		});
		const set = resolveLights(
			lamp,
			{ props: { brightness: 2 }, accent: "#ff8800", lights: { lamp: setting({ strength: 0.5 }) } },
			{ palette: night, driving: false },
		);
		expect(set.lamp.level).toBe(0.5);
		expect(resolveLights(lamp, entity(), { palette: night, driving: false }).lamp).toMatchObject({
			color: "#ffe8a3",
			reach: 2.3,
		});
	});

	it("switches a light by a data value, day and night", () => {
		const data = [
			{ key: "alert", label: "Alert", value: 1, unit: "" },
			{ key: "calm", label: "Calm", value: "off", unit: "" },
		];
		const lights = (key: string) =>
			resolveLights(car, entity({ rain: setting({ data: { on: bind(key) }, whenOn: "off" }) }), {
				palette: day,
				driving: false,
				data,
			}).rain;
		expect(lights("alert")).toMatchObject({ on: true, level: 0.8 });
		expect(lights("calm").on).toBe(false);
		expect(lights("missing").on).toBe(false);
	});

	it("takes its strength from a data value, against the value at normal strength", () => {
		const data = [{ key: "visitors", label: "Visitors", value: 150, unit: "" }];
		const strength = (full: number | null) =>
			resolveLights(
				car,
				entity({
					rain: setting({
						data: { strength: bind("visitors", full === null ? {} : { valueAtFull: full }) },
					}),
				}),
				{
					palette: night,
					driving: false,
					data,
				},
			).rain.level;
		expect(strength(100)).toBe(1.5);
		expect(strength(10)).toBe(3);
		// Without a usable value it keeps its own strength.
		expect(
			resolveLights(car, entity({ rain: setting({ data: { strength: bind("gone") } }) }), {
				palette: night,
				driving: false,
				data,
			}).rain.level,
		).toBe(0.8);
	});
});

describe("colour by data", () => {
	it("takes its colour from a data value that's a CSS colour, else keeps its own", () => {
		const data = [
			{ key: "status", label: "Status", value: "red", unit: "" },
			{ key: "word", label: "Word", value: "open", unit: "" },
		];
		const color = (key: string) =>
			resolveLights(
				car,
				entity({ rain: setting({ data: { color: bind(key) }, color: "#123456" }) }),
				{
					palette: night,
					driving: false,
					data,
				},
			).rain.color;
		expect(color("status")).toBe("#ff0000");
		expect(color("word")).toBe("#123456");
		expect(color("missing")).toBe("#123456");
	});
});

describe("lit panes", () => {
	const tower: IPartLights = {
		lights: [
			{ id: "windows", name: "Windows", shape: "windows", litPanes: 0.28 },
			{ id: "screens", name: "Screens", shape: "windows", litPanes: 0.2 },
		],
	};

	it("lights the part's share of each window light's panes, the object's own, or a data value's", () => {
		const data = [{ key: "occupancy", label: "Occupancy", value: 45, unit: "%" }];
		const lit = (lights: Record<string, TEntityLight>) => {
			const resolved = resolveLights(tower, entity(lights), {
				palette: night,
				driving: false,
				data,
			});
			return [resolved.windows.litPanes, resolved.screens.litPanes];
		};
		expect(lit({})).toEqual([0.28, 0.2]);
		expect(lit({ screens: setting({ litPanes: 0.9 }) })).toEqual([0.28, 0.9]);
		expect(
			lit({ windows: setting({ data: { litPanes: bind("occupancy", { valueAtFull: 100 }) } }) }),
		).toEqual([0.45, 0.2]);
		// Never more than all of them.
		expect(
			lit({ windows: setting({ data: { litPanes: bind("occupancy", { valueAtFull: 10 }) } }) })[0],
		).toBe(1);
	});
});

describe("when lights come on", () => {
	const at = (night: number) => ({ ...scenePalettes.light, night });

	it("fades in with the dusk when set to, else switches on at once when it's dark enough", () => {
		const fading = entity({ rain: setting({ comesOn: "gradually" }) });
		expect(resolveLights(car, fading, { palette: at(0.5), driving: false }).rain.level).toBe(0.4);
		expect(resolveLights(car, entity(), { palette: at(0.2), driving: false }).rain.level).toBe(0);
		expect(resolveLights(car, entity(), { palette: at(0.3), driving: false }).rain.level).toBe(0.8);
	});

	it("lights windows one by one as it gets darker, or all together at once", () => {
		const tower: IPartLights = {
			lights: [
				{ id: "windows", name: "Windows", shape: "windows", litPanes: 0.4, comesOn: "oneByOne" },
			],
		};
		const windows = (night: number, lights = {}) =>
			resolveLights(tower, entity(lights), { palette: at(night), driving: false }).windows;
		expect(windows(0.1)).toMatchObject({ on: false, litPanes: 0 });
		expect(windows(0.35).level).toBe(1);
		expect(windows(0.35).litPanes).toBeCloseTo(0.2);
		expect(windows(1)).toMatchObject({ level: 1, litPanes: 0.4 });
		// At once: all its lit panes together, once it's dark enough.
		const atOnce = { windows: setting({ comesOn: "atOnce" }) };
		expect(windows(0.1, atOnce).on).toBe(false);
		expect(windows(0.4, atOnce)).toMatchObject({ level: 1, litPanes: 0.4 });
	});

	it("treats one by one as at once for lights that aren't windows", () => {
		const oneByOne = entity({ rain: setting({ comesOn: "oneByOne" }) });
		expect(resolveLights(car, oneByOne, { palette: at(0.4), driving: false }).rain.level).toBe(0.8);
	});

	it("follows a schedule like a timer, with periods past midnight, and stays off without a time of day", () => {
		const timer = entity({
			rain: setting({
				whenOn: "schedule",
				schedule: [
					{ from: 5, until: 8 },
					{ from: 22, until: 2 },
				],
			}),
		});
		const onAt = (hour: number | null) =>
			resolveLights(car, timer, { palette: day, driving: false, hour }).rain.on;
		expect([4.5, 5.5, 7.5, 8.5, 12, 22.5, 23.9, 0, 1.5, 2.5].map(onAt)).toEqual([
			false,
			true,
			true,
			false,
			false,
			true,
			true,
			true,
			true,
			false,
		]);
		expect(onAt(null)).toBe(false);
		// No periods: never on.
		const empty = entity({ rain: setting({ whenOn: "schedule" }) });
		expect(resolveLights(car, empty, { palette: night, driving: false, hour: 6 }).rain.on).toBe(
			false,
		);
	});

	it("on a schedule at once, switches exactly at its times", () => {
		const evening = entity({
			rain: setting({ whenOn: "schedule", schedule: [{ from: 18, until: 23 }] }),
		});
		const onAt = (hour: number) =>
			resolveLights(car, evening, { palette: day, driving: false, hour }).rain.on;
		expect([17.9, 18, 22.9, 23].map(onAt)).toEqual([false, true, true, false]);
	});

	it("on a schedule gradually or one by one, comes on over the first hour and goes over the last", () => {
		const evening = { whenOn: "schedule" as const, schedule: [{ from: 18, until: 23 }] };
		const fading = entity({ rain: setting({ ...evening, comesOn: "gradually" }) });
		const level = (hour: number) =>
			resolveLights(car, fading, { palette: day, driving: false, hour }).rain.level;
		expect(level(18.5)).toBeCloseTo(0.4);
		expect(level(20)).toBeCloseTo(0.8);
		expect(level(22.75)).toBeCloseTo(0.2);
		const tower: IPartLights = {
			lights: [{ id: "windows", name: "Windows", shape: "windows", litPanes: 0.4 }],
		};
		const windows = (hour: number) =>
			resolveLights(tower, entity({ windows: setting({ ...evening, comesOn: "oneByOne" }) }), {
				palette: day,
				driving: false,
				hour,
			}).windows;
		expect(windows(18.5)).toMatchObject({ level: 1 });
		expect(windows(18.5).litPanes).toBeCloseTo(0.2);
		expect(windows(21).litPanes).toBeCloseTo(0.4);
		expect(windows(22.5).litPanes).toBeCloseTo(0.2);
		expect(windows(23).on).toBe(false);
	});
});
