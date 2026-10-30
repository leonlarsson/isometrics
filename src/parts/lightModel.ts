import type { TComesOn, TDataEntry, TEntity, TEntityLight, TTimePeriod } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { readColor, readPeriods, readScale, readSwitch, type TBindingKind } from "./dataBinding";
import type { ILightSpec, IResolvedLight, TColorDefault } from "./types";

/**
 * Lights as a shared model (ADR-0058): a part declares its lights
 * (`ILightSpec`), an object stores settings for some of them by id
 * (`TEntityLight`, everything null while it's as the part has it), and this
 * works out each light's state for drawing, reading data through
 * dataBinding.ts. No React here.
 */

/** What a part needs for its lights: their specs. */
export interface IPartLights {
	lights?: readonly ILightSpec[];
}

/** The world around a light right now. */
export interface ILightContext {
	/** For how dark it is (`night`, 0–1, with the world's light setting applied) and lamplight. */
	palette: IScenePalette;
	/** It drives along a road (lights with `when: "driving"` are only on then). */
	driving: boolean;
	/** The world's data, for lights switched or dimmed by a value. */
	data?: readonly TDataEntry[];
	/** The world's hour (null without a time of day), for lights on a schedule. */
	hour?: number | null;
}

/**
 * How dark it must be (`night`) for lights that switch on at once after dark:
 * all of them at the same moment. Lights meant to switch at other times get a
 * schedule; grouping is the user's, not the app's.
 */
export const SWITCH_ON_DARKNESS = 0.3;

/**
 * Lights on day and night by themselves (`when: "always"`, a traffic signal):
 * how bright they are by day, as a part of their strength; fully after dark.
 * Lit in the sun, but not glowing in it.
 */
export const DAYLIGHT_LEVEL = 0.2;

/** On a schedule, one by one or gradually: how long it takes to come fully on, and to go off, in hours. */
const SCHEDULE_RAMP_HOURS = 1;

/**
 * How far on a light is in a period, 0–1: rising over its first hour,
 * falling over its last (one by one: people arriving and going home).
 */
const periodRamp = (hour: number, period: TTimePeriod) => {
	if (!inPeriod(hour, period)) {
		return 0;
	}
	const since = (hour - period.from + 24) % 24;
	const left = ((period.until % 24) - hour + 24) % 24 || 24;
	return Math.min(1, since / SCHEDULE_RAMP_HOURS, left / SCHEDULE_RAMP_HOURS);
};

/**
 * Window lights that come on one by one after dark: none lit until `night`
 * passes 0.1, all of their lit panes by 0.6.
 */
const panesLitByDark = (night: number) => Math.min(1, Math.max(0, (night - 0.1) / 0.5));

/** How a light comes on after dark, as set or as its part has it; one by one only for window lights. */
export const comesOnOf = (spec: ILightSpec, setting: TEntityLight | undefined): TComesOn => {
	const comesOn = setting?.comesOn ?? spec.comesOn ?? "atOnce";
	return comesOn === "oneByOne" && spec.shape !== "windows" ? "atOnce" : comesOn;
};

/** Whether an hour falls in a period; one that ends before it starts runs past midnight. */
export const inPeriod = (hour: number, { from, until }: TTimePeriod) =>
	from < until ? hour >= from && hour < until : from > until ? hour >= from || hour < until : false;

const resolveColor = (value: TColorDefault, palette: IScenePalette) =>
	typeof value === "function" ? value(palette) : value;

/** The most a light's strength goes to (300%). */
export const MAX_STRENGTH = 3;

/**
 * Which of a light's settings can follow data, and how each reads its value
 * (dataBinding.ts): switched on and off, a number, or a colour. To make another
 * setting follow data, add it here, read it in `resolveLight` and give it a
 * row in the Lights tab (DataDrivenField); saved worlds need nothing, since
 * a light's `data` is a map by setting.
 */
export const LIGHT_DATA = {
	on: "switch",
	strength: "scale",
	color: "color",
	litPaneShare: "scale",
	schedule: "periods",
} as const satisfies Record<string, TBindingKind>;

export type TLightDataTarget = keyof typeof LIGHT_DATA;

/** What a light is like before the world (darkness, driving, data) comes in: as its part has it. */
export const lightDefaults = (spec: ILightSpec, palette: IScenePalette) => ({
	color: resolveColor(spec.color ?? palette.lamplight, palette),
	strength: spec.strength ?? 1,
	reach: spec.reach ?? 1,
	litPaneShare: spec.litPaneShare ?? 1,
	paneWeight: spec.paneWeight ?? 1,
});

/** One light as it is right now. */
export const resolveLight = (
	spec: ILightSpec,
	entity: Pick<TEntity, "lights">,
	{ palette, driving, data, hour = null }: ILightContext,
): IResolvedLight => {
	const setting = entity.lights[spec.id];
	const defaults = lightDefaults(spec, palette);
	// Settings that follow data take the value when it reads as one; otherwise their own.
	const bound = setting?.data ?? {};
	const color = readColor(bound.color, data) ?? setting?.color ?? defaults.color;
	const reach = setting?.reach ?? defaults.reach;
	let litPaneShare =
		readScale(bound.litPaneShare, data, { max: 1 }) ??
		setting?.litPaneShare ??
		defaults.litPaneShare;
	const strength =
		readScale(bound.strength, data, { max: MAX_STRENGTH }) ??
		setting?.strength ??
		defaults.strength;

	let level: number;
	if (bound.on) {
		// Switched by a value: on while it says so, day and night (off without the value).
		level = readSwitch(bound.on, data) ? strength : 0;
	} else {
		const mode = setting?.whenOn ?? "auto";
		if (mode === "off") {
			level = 0;
		} else if (mode === "on") {
			level = strength;
		} else if (mode === "schedule") {
			// Like a timer: on during its periods (off without a time of day), coming on as set.
			const comesOn = comesOnOf(spec, setting);
			// From a data value holding times (opening hours) while it reads as them.
			const periods = readPeriods(bound.schedule, data) ?? setting?.schedule ?? [];
			if (hour === null) {
				level = 0;
			} else if (comesOn === "atOnce") {
				// Fully on for the whole period, exactly: lights with the same schedule switch together.
				level = periods.some((period) => inPeriod(hour, period)) ? strength : 0;
			} else {
				const ramp = Math.max(0, ...periods.map((period) => periodRamp(hour, period)));
				if (comesOn === "gradually") {
					level = strength * ramp;
				} else {
					litPaneShare *= ramp;
					level = litPaneShare > 0 ? strength : 0;
				}
			}
		} else if (spec.when === "always") {
			// Day and night, glowing as it gets dark.
			level = strength * (DAYLIGHT_LEVEL + (1 - DAYLIGHT_LEVEL) * palette.night);
		} else if (spec.when === "driving" && !driving) {
			level = 0;
		} else if (comesOnOf(spec, setting) === "gradually") {
			// Fades in with the dusk.
			level = palette.night * strength;
		} else if (comesOnOf(spec, setting) === "oneByOne") {
			// Pane after pane: more of its panes light up as it gets darker, each fully.
			litPaneShare *= panesLitByDark(palette.night);
			level = litPaneShare > 0 ? strength : 0;
		} else {
			// At once when it's dark enough.
			level = palette.night >= SWITCH_ON_DARKNESS ? strength : 0;
		}
	}
	return {
		on: level > 0,
		level,
		color,
		reach,
		litPaneShare,
		paneWeight: setting?.paneWeight ?? defaults.paneWeight,
	};
};

/** Every light of a part on an object, by id, as it is right now. */
export const resolveLights = (
	part: IPartLights,
	entity: Pick<TEntity, "lights">,
	context: ILightContext,
): Record<string, IResolvedLight> =>
	Object.fromEntries(
		(part.lights ?? []).map((spec) => [spec.id, resolveLight(spec, entity, context)]),
	);

/** A part's lights with no object around them (previews, thumbnails): as the part has them, parked. */
export const resolvePartLights = (part: IPartLights, palette: IScenePalette) =>
	resolveLights(part, { lights: {} }, { palette, driving: false });
