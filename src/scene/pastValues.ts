import type { TDataPoint } from "./schema";

/**
 * A value's past values, kept by hand (ADR-0123): recorded, added, changed and
 * removed one at a time. Always oldest first, one per date, so trends and the
 * story bar read them as they always have. No React.
 */

/** A date a past value can have: a year, a month, a day, or a day and time ("2026", "2026-10", "2026-10-30"). */
const PAST_DATE = /^\d{4}(-\d{2}(-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?)?)?$/;

export const isPastDate = (text: string) => {
	const trimmed = text.trim();
	return (
		PAST_DATE.test(trimmed) &&
		!Number.isNaN(Date.parse(trimmed.length === 4 ? `${trimmed}-01-01` : trimmed))
	);
};

/** Today as a past value's date, in this browser's own time zone ("2026-11-02"). */
export const todayAsDate = (now = new Date()) =>
	`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const byDate = (a: TDataPoint, b: TDataPoint) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

/** The past with `point` in it: today's (or that date's) entry replaced, else added, oldest first. */
export const recordPoint = (history: readonly TDataPoint[], point: TDataPoint): TDataPoint[] =>
	[...history.filter((each) => each.at !== point.at), point].sort(byDate);

/**
 * The past with the entry at `index` changed. A date another entry already has
 * isn't taken (null): one entry per date.
 */
export const changePoint = (
	history: readonly TDataPoint[],
	index: number,
	next: TDataPoint,
): TDataPoint[] | null => {
	if (history.some((each, at) => at !== index && each.at === next.at)) {
		return null;
	}
	return history.map((each, at) => (at === index ? next : each)).sort(byDate);
};

/** The past without the entry at `index`. */
export const removePoint = (history: readonly TDataPoint[], index: number): TDataPoint[] =>
	history.filter((_, at) => at !== index);

/**
 * The date a new entry starts on: the day before the oldest (to fill in the
 * past), or today when there are none; a month or a year before, for pasts
 * kept by month or year.
 */
export const dateForNewEntry = (history: readonly TDataPoint[], today = todayAsDate()) => {
	const oldest = history[0]?.at;
	if (!oldest) {
		return today;
	}
	if (/^\d{4}$/.test(oldest)) {
		return String(Number(oldest) - 1);
	}
	const month = /^(\d{4})-(\d{2})$/.exec(oldest);
	if (month) {
		const at = new Date(Number(month[1]), Number(month[2]) - 2, 1);
		return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
	}
	const day = new Date(`${oldest.slice(0, 10)}T12:00:00`);
	day.setDate(day.getDate() - 1);
	return todayAsDate(day);
};
