import type { IInherit } from "./InheritAction";

/**
 * Default / Reset for a value with a plain default (ADR-0105): Default while it
 * equals `fallback`, else Reset, which calls `onReset`. `shown` is the default
 * in words, for Reset's tooltip.
 */
export const resetToDefault = <T>(
	value: T,
	fallback: T,
	onReset: () => void,
	shown?: string,
): IInherit => ({
	from: "default",
	inherited: JSON.stringify(value) === JSON.stringify(fallback),
	onReset,
	value: shown ?? inWords(fallback),
});

/** A default in words, for Reset's tooltip: on / off, a number, a list, or empty. */
const inWords = (value: unknown): string | undefined => {
	if (typeof value === "boolean") {
		return value ? "on" : "off";
	}
	if (typeof value === "number") {
		return `${value}`;
	}
	if (Array.isArray(value)) {
		return value.length ? value.join(", ") : "none";
	}
	if (typeof value === "string") {
		return value === "" ? "empty" : value;
	}
	return undefined;
};

/**
 * Default / Reset for each of a record's settings against its defaults
 * (ADR-0105), e.g. a road's against a new road's: `const reset =
 * resetsAgainst(road, ROAD_DEFAULTS, write)`, then `inherit={reset("width")}`.
 * `write` sets one setting back (one undo step); `fallback` stands in for the
 * record's default where it depends on more (a road's width on its kind).
 */
export const resetsAgainst =
	<T extends object>(
		current: T,
		defaults: T,
		write: <K extends keyof T>(key: K, value: T[K]) => void,
	) =>
	<K extends keyof T>(key: K, shown?: string, fallback: T[K] = defaults[key]) =>
		resetToDefault(current[key], fallback, () => write(key, fallback), shown);
