import * as THREE from "three";

import type { TDataBinding, TDataEntry, TTimePeriod } from "#/scene/schema";

/**
 * Settings driven by data (ADR-0058): a `TDataBinding` names a data value and
 * how to read it, and these read it the way the setting needs. Three kinds:
 *
 * - `switch`: on or off: a number above `above` (0 by default), or the text
 *   on, yes or true; anything else is off.
 * - `scale`: a number: the value ÷ `full` (1 by default), so `full` gives 100%.
 * - `color`: any CSS colour (a name, #rgb or #rrggbb, rgb() or hsl()) as it
 *   is, or a number placed on a colour scale: `lowColor` at `low`, `highColor`
 *   at `high`, mixed in between (a heatmap).
 * - `periods`: times of the day, as text like "09:00-17:30" or
 *   "7-9, 16:30-19" (opening hours, a timetable).
 *
 * Each returns undefined when the value is missing or doesn't read as that
 * kind, so the setting keeps its own value. Making another setting follow data
 * is choosing its kind; nothing here is about lights in particular. No React.
 */

export type TBindingKind = "switch" | "scale" | "color" | "periods";

/** The entry a binding names, if the world still has it. */
export const boundEntry = (
	binding: TDataBinding | undefined,
	data: readonly TDataEntry[] | undefined,
) => (binding ? data?.find((entry) => entry.key === binding.key) : undefined);

/** A data value as a number: numbers as they are, text that reads as one, else NaN. */
export const dataNumber = (value: number | string | undefined) =>
	typeof value === "number" ? value : value === undefined ? Number.NaN : Number.parseFloat(value);

/** Text that switches something on (any case); any other text is off. */
const ON_WORDS = ["on", "yes", "true"];

/**
 * Whether a value switches something on: a number above `above` (0 by
 * default), or the text on, yes or true. Everything else is off (empty, or any
 * other text such as "null" or "open"), so there's one short rule to remember.
 */
export const switchesOn = (value: number | string | undefined, above = 0) => {
	if (value === undefined) {
		return false;
	}
	const text = typeof value === "number" ? String(value) : value.trim().toLowerCase();
	const asNumber = Number(text);
	if (text !== "" && Number.isFinite(asNumber)) {
		return asNumber > above;
	}
	return ON_WORDS.includes(text);
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/;
const NUMBER = String.raw`\d+(?:\.\d+)?`;
const ALPHA = String.raw`(?:\s*,\s*${NUMBER}%?)?`;
const RGB = new RegExp(
	String.raw`^rgba?\(\s*${NUMBER}%?\s*,\s*${NUMBER}%?\s*,\s*${NUMBER}%?${ALPHA}\s*\)$`,
);
const HSL = new RegExp(
	String.raw`^hsla?\(\s*${NUMBER}(?:deg)?\s*,\s*${NUMBER}%\s*,\s*${NUMBER}%${ALPHA}\s*\)$`,
);

/**
 * A value as a colour: any CSS colour name, #rgb or #rrggbb, rgb() or hsl()
 * (with commas; alpha is ignored), as #rrggbb. Null for anything else.
 */
export const cssColor = (value: number | string | undefined): string | null => {
	if (typeof value !== "string") {
		return null;
	}
	const text = value.trim().toLowerCase();
	if (!(HEX.test(text) || text in THREE.Color.NAMES || RGB.test(text) || HSL.test(text))) {
		return null;
	}
	return `#${new THREE.Color().setStyle(text).getHexString()}`;
};

/** A switch binding's reading: on or off, or undefined without a value. */
export const readSwitch = (
	binding: TDataBinding | undefined,
	data: readonly TDataEntry[] | undefined,
) => {
	const entry = boundEntry(binding, data);
	return entry && binding ? switchesOn(entry.value, binding.onAbove ?? 0) : undefined;
};

/** A scale binding's reading: the value ÷ `full`, between `min` and `max`; undefined if it isn't a number. */
export const readScale = (
	binding: TDataBinding | undefined,
	data: readonly TDataEntry[] | undefined,
	{ min = 0, max = Number.POSITIVE_INFINITY }: { min?: number; max?: number } = {},
) => {
	const value = dataNumber(boundEntry(binding, data)?.value);
	return binding && Number.isFinite(value)
		? Math.min(max, Math.max(min, value / (binding.valueAtFull ?? 1)))
		: undefined;
};

/** A colour scale's options as they are in effect: the binding's, else the defaults. */
export const colorScaleOf = (binding: TDataBinding) => ({
	low: binding.valueAtLowColor ?? 0,
	high: binding.valueAtHighColor ?? 100,
	lowColor: binding.lowColor ?? "#2bb58c",
	highColor: binding.highColor ?? "#e0483b",
});

/** Where a number sits on a binding's colour scale: 0 at low, 1 at high, clamped. */
export const colorScalePosition = (binding: TDataBinding, value: number) => {
	const { low, high } = colorScaleOf(binding);
	if (high === low) {
		return value >= high ? 1 : 0;
	}
	return Math.min(1, Math.max(0, (value - low) / (high - low)));
};

/** A number's colour on a binding's colour scale, as #rrggbb. */
export const colorOnScale = (binding: TDataBinding, value: number) => {
	const { lowColor, highColor } = colorScaleOf(binding);
	const mixed = new THREE.Color(lowColor).lerp(
		new THREE.Color(highColor),
		colorScalePosition(binding, value),
	);
	return `#${mixed.getHexString()}`;
};

/**
 * A colour binding's reading, as #rrggbb: a value holding a CSS colour as it
 * is, a number on the colour scale; undefined for anything else.
 */
export const readColor = (
	binding: TDataBinding | undefined,
	data: readonly TDataEntry[] | undefined,
) => {
	const value = boundEntry(binding, data)?.value;
	const asColor = cssColor(value);
	if (asColor || !binding) {
		return asColor ?? undefined;
	}
	const asNumber = dataNumber(value);
	return Number.isFinite(asNumber) ? colorOnScale(binding, asNumber) : undefined;
};

/** A time of day as text, "19:30", "1930", "19.30" or "19", in hours; null if it isn't one. */
const readClock = (text: string) => {
	const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(text.trim());
	if (!match) {
		return null;
	}
	const hours = Number(match[1]);
	const minutes = Number(match[2] ?? 0);
	return minutes < 60 && hours * 60 + minutes <= 24 * 60 ? hours + minutes / 60 : null;
};

/**
 * Times of the day from text, like opening hours: "09:00-17:30", or several
 * separated by commas or semicolons ("7-9, 16:30-19"), each "from-until"
 * (also with "–" or "to"); one that ends before it starts runs past midnight.
 * Undefined unless every part reads as a period.
 */
export const periodsFromText = (value: number | string | undefined): TTimePeriod[] | undefined => {
	if (typeof value !== "string" || value.trim() === "") {
		return undefined;
	}
	const periods: TTimePeriod[] = [];
	for (const part of value.split(/[,;]/)) {
		const ends = part.split(/\s*(?:-|–|—|\bto\b)\s*/i).filter((end) => end.trim() !== "");
		const [from, until] = ends.map(readClock);
		if (ends.length !== 2 || from === null || until === null || from === until) {
			return undefined;
		}
		periods.push({ from, until });
	}
	return periods;
};

/** A periods binding's reading: the times its value holds, or undefined if it doesn't read as times. */
export const readPeriods = (
	binding: TDataBinding | undefined,
	data: readonly TDataEntry[] | undefined,
) => periodsFromText(boundEntry(binding, data)?.value);
