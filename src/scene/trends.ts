import { formatValue } from "./format";
import type { TDataPoint, TDataValue } from "./schema";

/**
 * What a value's past says about it now (ADR-0110): how much it changed since
 * the point before, and whether it crossed the line it's watched against.
 * Every reading has words and a symbol, so nothing relies on colour. No React.
 */

/** A value's change since its point before: the share it moved, and when that point was. */
export interface IChange {
	share: number;
	since: string;
}

/** The numbers among a value's past points. */
const numbers = (history: readonly TDataPoint[]) =>
	history.filter(
		(point): point is { at: string; value: number } => typeof point.value === "number",
	);

/**
 * How much a value moved since its point before (its last past point is
 * usually now, so the one before that); null without a number now and before.
 */
export const changeOf = (entry: Pick<TDataValue, "value" | "history">): IChange | null => {
	if (typeof entry.value !== "number") {
		return null;
	}
	const past = numbers(entry.history);
	const last = past.at(-1);
	const before = last && last.value === entry.value ? past.at(-2) : last;
	if (!before || before.value === 0) {
		return null;
	}
	return { share: (entry.value - before.value) / Math.abs(before.value), since: before.at };
};

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** When the point before was, as a change says it: "on September", "on 2025", "since 30 Oct". */
export const sinceWords = (at: string) => {
	if (/^\d{4}$/.test(at)) {
		return `on ${at}`;
	}
	const month = /^\d{4}-(\d{2})$/.exec(at);
	if (month) {
		return `on ${MONTHS[Number(month[1]) - 1] ?? at}`;
	}
	const day = /^\d{4}-(\d{2})-(\d{2})/.exec(at);
	if (day) {
		return `since ${Number(day[2])} ${(MONTHS[Number(day[1]) - 1] ?? "").slice(0, 3)}`;
	}
	return `since ${at}`;
};

/** A change in words with its arrow: "▼ 8% on September", "▲ 12% since 30 Oct", "No change since…". */
export const changeWords = (change: IChange) => {
	const percent = Math.round(Math.abs(change.share) * 100);
	if (percent === 0) {
		return `No change ${sinceWords(change.since)}`;
	}
	return `${change.share > 0 ? "▲" : "▼"} ${percent}% ${sinceWords(change.since)}`;
};

/** Whether a value has crossed the line it's watched against: its word, else null. */
export const flagOf = (entry: Pick<TDataValue, "value" | "threshold">) => {
	const { threshold } = entry;
	if (!threshold || typeof entry.value !== "number") {
		return null;
	}
	const crossed =
		threshold.flagsWhen === "above" ? entry.value > threshold.line : entry.value < threshold.line;
	return crossed ? threshold.word || "Watch" : null;
};

/** The line a value is watched against, in words: "under 30", "over 1,000". */
export const thresholdWords = (entry: Pick<TDataValue, "threshold" | "unit">) =>
	entry.threshold
		? `${entry.threshold.flagsWhen === "above" ? "over" : "under"} ${formatValue(entry.threshold.line, entry.unit)}`
		: "";
