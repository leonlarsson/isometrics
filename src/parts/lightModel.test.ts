import { describe, expect, it } from "vitest";

import { DataBindingSchema, EntityLightSchema, type TEntityLight } from "#/scene/schema";
import { scenePalettes } from "#/scene/theme";

import { type IPartLights, resolveLights } from "./lightModel";

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
const bind = (key: string, options: { above?: number; full?: number } = {}) =>
	DataBindingSchema.parse({ key, ...options });

const entity = (lights: Record<string, TEntityLight> | "auto" | "on" | "off" = {}, props = {}) => ({
	props,
	accent: null,
	lights,
});

describe("resolveLights (ADR-0058)", () => {
	it("lights after dark, dimmer at dusk, and headlights only while driving", () => {
		expect(resolveLights(car, entity(), { palette: day, driving: true }).rain.on).toBe(false);
		expect(resolveLights(car, entity(), { palette: dusk, driving: false })).toMatchObject({
			rain: { on: true, level: 0.4, color: "#ff2a2a" },
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
				headlights: setting({ mode: "on", color: "#ffffff", strength: 2, reach: 4 }),
				rain: setting({ mode: "off" }),
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
			resolveLights(car, entity({ rain: setting({ data: { on: bind(key) }, mode: "off" }) }), {
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
					rain: setting({ data: { strength: bind("visitors", full === null ? {} : { full }) } }),
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
			lit({ windows: setting({ data: { litPanes: bind("occupancy", { full: 100 }) } }) }),
		).toEqual([0.45, 0.2]);
		// Never more than all of them.
		expect(
			lit({ windows: setting({ data: { litPanes: bind("occupancy", { full: 10 }) } }) })[0],
		).toBe(1);
	});
});
