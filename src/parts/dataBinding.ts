import * as THREE from "three";

import type { TDataBinding, TDataEntry } from "#/scene/schema";

/**
 * Settings driven by data (ADR-0058): a `TDataBinding` names a data value and
 * how to read it, and these read it the way the setting needs. Three kinds:
 *
 * - `switch`: on or off: a number above `above` (0 by default), or the text
 *   on, yes or true; anything else is off.
 * - `scale`: a number: the value ÷ `full` (1 by default), so `full` gives 100%.
 * - `color`: any CSS colour: a name, #rgb or #rrggbb, rgb() or hsl().
 *
 * Each returns undefined when the value is missing or doesn't read as that
 * kind, so the setting keeps its own value. Making another setting follow data
 * is choosing its kind; nothing here is about lights in particular. No React.
 */

export type TBindingKind = "switch" | "scale" | "color";

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
	return entry && binding ? switchesOn(entry.value, binding.above ?? 0) : undefined;
};

/** A scale binding's reading: the value ÷ `full`, between `min` and `max`; undefined if it isn't a number. */
export const readScale = (
	binding: TDataBinding | undefined,
	data: readonly TDataEntry[] | undefined,
	{ min = 0, max = Number.POSITIVE_INFINITY }: { min?: number; max?: number } = {},
) => {
	const value = dataNumber(boundEntry(binding, data)?.value);
	return binding && Number.isFinite(value)
		? Math.min(max, Math.max(min, value / (binding.full ?? 1)))
		: undefined;
};

/** A colour binding's reading: #rrggbb, or undefined if the value isn't a colour. */
export const readColor = (
	binding: TDataBinding | undefined,
	data: readonly TDataEntry[] | undefined,
) => cssColor(boundEntry(binding, data)?.value) ?? undefined;
