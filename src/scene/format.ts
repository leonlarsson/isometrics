import type { TDataValue, TNumberStyle, TYesNoStyle } from "./schema";

const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const full = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, useGrouping: false });
const compact = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/** How each style writes yes and no. */
export const YES_NO_WORDS: Record<TYesNoStyle, { yes: string; no: string }> = {
	yesNo: { yes: "yes", no: "no" },
	trueFalse: { yes: "true", no: "false" },
	onOff: { yes: "on", no: "off" },
	checks: { yes: "✓", no: "✗" },
};

/** Whether a value is a yes or a no (what true and false are read as), or neither. */
export const yesNoOf = (value: number | string): "yes" | "no" | null => {
	const text = typeof value === "string" ? value.trim().toLowerCase() : "";
	return text === "yes" || text === "no" ? text : null;
};

/** A yes or no in a style (yes / no without one); null when the value is neither. */
const yesNoText = (value: string, style: TYesNoStyle | null) => {
	const yesNo = yesNoOf(value);
	return yesNo && style ? YES_NO_WORDS[style][yesNo] : null;
};

/**
 * Format a data value for display, in its number style: "full" (374160),
 * "grouped" (374,160) or "short" (374.6K); without one, grouped, and short from
 * 100,000 (1.5M).
 */
export const formatValue = (
	value: number | string,
	unit = "",
	style: TNumberStyle | null = null,
	yesNoStyle: TYesNoStyle | null = null,
): string => {
	if (typeof value !== "number") {
		return `${yesNoText(value, yesNoStyle) ?? value}${unit}`;
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
	return formatValue(entry.value, entry.unit, entry.numberStyle, entry.yesNoStyle);
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

/** A value as typed: a number when it reads as one (kept numeric, so it's formatted), else the text. */
export const parseValue = (raw: string): number | string => {
	const trimmed = raw.trim();
	if (trimmed !== "" && /^-?\d+(\.\d+)?$/.test(trimmed)) {
		return Number(trimmed);
	}
	return raw;
};
