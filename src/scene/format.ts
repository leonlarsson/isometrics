import type { TDataValue, TNumberStyle } from "./schema";

const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const full = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, useGrouping: false });
const compact = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/**
 * Format a data value for display, in its number style: "full" (374160),
 * "grouped" (374,160) or "short" (374.6K); without one, grouped, and short from
 * 100,000 (1.5M).
 */
export const formatValue = (
	value: number | string,
	unit = "",
	style: TNumberStyle | null = null,
): string => {
	if (typeof value !== "number") {
		return `${value}${unit}`;
	}
	const base =
		style === "full"
			? full.format(value)
			: style === "grouped"
				? plain.format(value)
				: style === "short"
					? Math.abs(value) >= 1000
						? compact.format(value)
						: plain.format(value)
					: Math.abs(value) >= 100_000
						? compact.format(value)
						: plain.format(value);
	return `${base}${unit}`;
};

export const formatEntry = (entry: TDataValue | undefined): string => {
	if (!entry) {
		return "—";
	}
	return formatValue(entry.value, entry.unit, entry.numberStyle);
};

/** Turn free text into a valid data key: "Orders packed" → "orders_packed". */
export const toDataKey = (text: string): string => {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "_")
			.replace(/^_+|_+$/g, "") || "value"
	);
};
