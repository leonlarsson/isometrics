import type { TDataEntry } from "./schema";

const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/** Format a data value for display. Large numbers are compacted (123,400 → 123.4K). */
export const formatValue = (value: number | string, unit = ""): string => {
	const base =
		typeof value === "number"
			? Math.abs(value) >= 100_000
				? compact.format(value)
				: plain.format(value)
			: value;
	return `${base}${unit}`;
};

export const formatEntry = (entry: TDataEntry | undefined): string => {
	if (!entry) {
		return "—";
	}
	return formatValue(entry.value, entry.unit);
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
