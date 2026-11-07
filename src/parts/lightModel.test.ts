import { describe, expect, it } from "vitest";

import { DataBindingSchema, EntityLightSchema, type TEntityLight } from "#/scene/schema";
import { scenePalettes } from "#/scene/theme";

import {
	DAYLIGHT_LEVEL,
	darknessSeenBy,
	hourSeenBy,
	type IPartLights,
	resolveLights,
} from "./lightModel";

const night = { ...scenePalettes.light, night: 1 };
const day = { ...scenePalettes.light, night: 0 };
const dusk = { ...scenePalettes.light, night: 0.5 };

/** A stand-in part with a light of each kind of switching. */
const car: IPartLights = {
	lights: [
		{ id: "headlights", name: "Headlights", shape: "beam", when: "driving", reach: 2.4 },
		{ id: "rain", name: "Rain light", shape: "lens", color: "#ff2a2a", strength: 0.8 },
	],
};

const lamp: IPartLights = {
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			shape: "pool",
			reach: 2.3,
			color: "#ffe8a3",
		},
	],
};

const setting = (fields: Partial<TEntityLight>) => EntityLightSchema.parse(fields);

/** A data binding to the value `key`, with options. */
const bind = (key: string, options: { switchesOnAbove?: number; valueAtFull?: number } = {}) =>
	DataBindingSchema.parse({ key, ...options });

const entity = (lights: Record<string, TEntityLight> = {}) => ({ lights });

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
			litPaneShare: 1,
			paneWeight: 1,
		});
	});

	it("leaves a light its part starts off dark at night, until the object says when", () => {
		const glow: IPartLights = {
			lights: [{ id: "glow", name: "Glow", shape: "glow", whenOn: "off" }],
		};
		expect(resolveLights(glow, entity(), { palette: night, driving: false }).glow.on).toBe(false);
		const afterDark = entity({ glow: setting({ whenOn: "auto" }) });
		expect(resolveLights(glow, afterDark, { palette: night, driving: false }).glow.on).toBe(true);
		expect(resolveLights(glow, afterDark, { palette: day, driving: false }).glow.on).toBe(false);
		const always = entity({ glow: setting({ whenOn: "on" }) });
		expect(resolveLights(glow, always, { palette: day, driving: false }).glow.on).toBe(true);
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
			litPaneShare: 1,
			paneWeight: 1,
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

	it("is as its part has it until the object sets it", () => {
		const set = resolveLights(lamp, entity({ lamp: setting({ strength: 0.5 }) }), {
			palette: night,
			driving: false,
		});
		expect(set.lamp.level).toBe(0.5);
		expect(resolveLights(lamp, entity(), { palette: night, driving: false }).lamp).toMatchObject({
			color: "#ffe8a3",
			reach: 2.3,
		});
	});

	it("switches a light by a data value, day and night", () => {
		const data = [
			{ key: "alert", name: "Alert", value: 1, unit: "" },
			{ key: "calm", name: "Calm", value: "off", unit: "" },
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
		const data = [{ key: "visitors", name: "Visitors", value: 150, unit: "" }];
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
			{ key: "status", name: "Status", value: "red", unit: "" },
			{ key: "word", name: "Word", value: "open", unit: "" },
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
			{ id: "windows", name: "Windows", shape: "windows", litPaneShare: 0.28 },
			{ id: "screens", name: "Screens", shape: "windows", litPaneShare: 0.2 },
		],
	};

	it("lights the part's share of each window light's panes, the object's own, or a data value's", () => {
		const data = [{ key: "occupancy", name: "Occupancy", value: 45, unit: "%" }];
		const lit = (lights: Record<string, TEntityLight>) => {
			const resolved = resolveLights(tower, entity(lights), {
				palette: night,
				driving: false,
				data,
			});
			return [resolved.windows.litPaneShare, resolved.screens.litPaneShare];
		};
		expect(lit({})).toEqual([0.28, 0.2]);
		expect(lit({ screens: setting({ litPaneShare: 0.9 }) })).toEqual([0.28, 0.9]);
		expect(
			lit({
				windows: setting({ data: { litPaneShare: bind("occupancy", { valueAtFull: 100 }) } }),
			}),
		).toEqual([0.45, 0.2]);
		// Never more than all of them.
		expect(
			lit({
				windows: setting({ data: { litPaneShare: bind("occupancy", { valueAtFull: 10 }) } }),
			})[0],
		).toBe(1);
	});
	it("splits the windows by the object's weights, else the part's", () => {
		const weights = (lights: Record<string, TEntityLight>) => {
			const resolved = resolveLights(tower, entity(lights), { palette: night, driving: false });
			return [resolved.windows.paneWeight, resolved.screens.paneWeight];
		};
		expect(weights({})).toEqual([1, 1]);
		expect(
			weights({ windows: setting({ paneWeight: 70 }), screens: setting({ paneWeight: 30 }) }),
		).toEqual([70, 30]);
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
				{
					id: "windows",
					name: "Windows",
					shape: "windows",
					litPaneShare: 0.4,
					comesOn: "oneByOne",
				},
			],
		};
		const windows = (night: number, lights = {}) =>
			resolveLights(tower, entity(lights), { palette: at(night), driving: false }).windows;
		expect(windows(0.1)).toMatchObject({ on: false, litPaneShare: 0 });
		expect(windows(0.35).level).toBe(1);
		expect(windows(0.35).litPaneShare).toBeCloseTo(0.2);
		expect(windows(1)).toMatchObject({ level: 1, litPaneShare: 0.4 });
		// At once: all its lit panes together, once it's dark enough.
		const atOnce = { windows: setting({ comesOn: "atOnce" }) };
		expect(windows(0.1, atOnce).on).toBe(false);
		expect(windows(0.4, atOnce)).toMatchObject({ level: 1, litPaneShare: 0.4 });
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

	it("takes its schedule from a value holding times, like opening hours, else its own", () => {
		const shop = (value: string) =>
			resolveLights(
				car,
				entity({
					rain: setting({
						whenOn: "schedule",
						schedule: [{ from: 20, until: 22 }],
						data: { schedule: bind("hours") },
					}),
				}),
				{
					palette: day,
					driving: false,
					hour: 10,
					data: [{ key: "hours", value }],
				},
			).rain.on;
		expect(shop("09:00-17:30")).toBe(true);
		expect(shop("7-9, 16:30-19")).toBe(false);
		// Not times: its own periods (20–22, so off at 10).
		expect(shop("closed today")).toBe(false);
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
			lights: [{ id: "windows", name: "Windows", shape: "windows", litPaneShare: 0.4 }],
		};
		const windows = (hour: number) =>
			resolveLights(tower, entity({ windows: setting({ ...evening, comesOn: "oneByOne" }) }), {
				palette: day,
				driving: false,
				hour,
			}).windows;
		expect(windows(18.5)).toMatchObject({ level: 1 });
		expect(windows(18.5).litPaneShare).toBeCloseTo(0.2);
		expect(windows(21).litPaneShare).toBeCloseTo(0.4);
		expect(windows(22.5).litPaneShare).toBeCloseTo(0.2);
		expect(windows(23).on).toBe(false);
	});
});

describe("the darkness an object's lights see", () => {
	const at = (night: number) => ({ ...scenePalettes.light, night });
	const building: IPartLights = {
		lights: [
			{ id: "windows", name: "Windows", shape: "windows", litPaneShare: 0.6, comesOn: "oneByOne" },
			{ id: "shops", name: "Shops", shape: "glow" },
			{ id: "beacon", name: "Beacon", shape: "lens" },
			{ id: "signal", name: "Signal", shape: "lens", when: "always" },
			{ id: "cabin", name: "Cabin", shape: "glow", when: "driving" },
		],
	};
	const looks = [
		entity({ beacon: setting({ whenOn: "off" }), signal: setting({ whenOn: "off" }) }),
		entity({ signal: setting({ whenOn: "on" }), windows: setting({ comesOn: "atOnce" }) }),
		entity({ signal: setting({ whenOn: "off" }), shops: setting({ comesOn: "gradually" }) }),
		entity({ signal: setting({ whenOn: "schedule" }), windows: setting({ whenOn: "off" }) }),
		entity({
			signal: setting({ data: { on: bind("open") } }),
			windows: setting({ litPaneShare: 0.3 }),
		}),
		entity(),
	];

	it("lights every light just as the world's darkness does, at every step of a dusk", () => {
		for (const look of looks) {
			for (let step = 0; step <= 100; step++) {
				const night = step / 100;
				const seen = darknessSeenBy(building, look, night);
				expect(seen).toBeLessThanOrEqual(night);
				for (const driving of [false, true]) {
					expect(resolveLights(building, look, { palette: at(seen), driving, hour: 12 })).toEqual(
						resolveLights(building, look, { palette: at(night), driving, hour: 12 }),
					);
				}
			}
		}
	});

	it("stays the same while none of its lights change, so the object isn't drawn again", () => {
		const lamps = entity({
			signal: setting({ whenOn: "off" }),
			windows: setting({ whenOn: "off" }),
		});
		const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
		// Only the beacon, shops and cabin, which come on at once: one change over the whole dusk.
		expect(new Set(steps.map((night) => darknessSeenBy(building, lamps, night))).size).toBe(2);
		// Without lights that follow the dark at all: none.
		expect(darknessSeenBy({ lights: [] }, entity(), 0.8)).toBe(0);
		expect(darknessSeenBy(lamp, entity({ lamp: setting({ whenOn: "on" }) }), 0.8)).toBe(0);
	});
});

describe("the hour an object's lights on a schedule see", () => {
	const shop: IPartLights = {
		lights: [
			{ id: "windows", name: "Windows", shape: "windows", litPaneShare: 0.8 },
			{ id: "sign", name: "Sign", shape: "glow" },
			{ id: "porch", name: "Porch", shape: "lens" },
		],
	};
	const looks = [
		entity({
			sign: setting({ whenOn: "schedule", schedule: [{ from: 9, until: 17.5 }] }),
			porch: setting({ whenOn: "schedule", schedule: [{ from: 22, until: 2 }] }),
		}),
		entity({
			windows: setting({
				whenOn: "schedule",
				comesOn: "oneByOne",
				schedule: [
					{ from: 6, until: 8.25 },
					{ from: 18, until: 23 },
				],
			}),
			sign: setting({
				whenOn: "schedule",
				comesOn: "gradually",
				schedule: [{ from: 20, until: 1 }],
			}),
		}),
		entity({ porch: setting({ whenOn: "schedule", schedule: [] }) }),
		entity(),
	];

	it("lights every light just as the world's hour does, round the clock", () => {
		for (const look of looks) {
			for (let step = 0; step < 24 * 20; step++) {
				const hour = step / 20;
				const seen = hourSeenBy(shop, look, hour);
				expect(seen).not.toBeNull();
				expect(resolveLights(shop, look, { palette: day, driving: false, hour: seen })).toEqual(
					resolveLights(shop, look, { palette: day, driving: false, hour }),
				);
			}
		}
		expect(hourSeenBy(shop, looks[0], null)).toBeNull();
	});

	it("changes only at a timer's edges, so the object isn't drawn again in between", () => {
		const hours = Array.from({ length: 24 * 4 }, (_, i) => i / 4);
		const seen = new Set(hours.map((hour) => hourSeenBy(shop, looks[0], hour)));
		// The sign's 9 and 17.5, the porch's 22 and 2.
		expect([...seen].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([2, 9, 17.5, 22]);
		expect(hourSeenBy(shop, looks[3], 13)).toBe(0);
	});
});
