/**
 * Periods of the day for PeriodsField, without React: reading and writing
 * 24-hour times, where a period lies on the 24-hour strip, and dragging it.
 * Hours run 0–24 (19.5 = 19:30); a period that ends before it starts runs
 * past midnight.
 */

/** A stretch of the day in hours (19.5 = 19:30); one that ends before it starts runs past midnight. */
export interface ITimePeriod {
	from: number;
	until: number;
}

/** "19:30" for 19.5 hours; 24 is midnight, "00:00". */
export const formatClock = (hours: number) => {
	const minutes = Math.round(hours * 60) % (24 * 60);
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
};

/** 19.5 for "19:30" (also "1930", "19.30" or "19"); null while it isn't a time yet. */
export const parseClock = (text: string) => {
	const match = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(text.trim());
	if (!match) {
		return null;
	}
	const hours = Number(match[1]);
	const minutes = Number(match[2] ?? 0);
	return minutes < 60 && hours * 60 + minutes <= 24 * 60 ? hours + minutes / 60 : null;
};

/** One stretch of the strip a period covers; one past midnight covers two. */
export interface IPeriodSpan {
	/** Which period it belongs to. */
	index: number;
	start: number;
	end: number;
	/** Its left edge is the period's start, its right edge the period's end (not midnight). */
	startsPeriod: boolean;
	endsPeriod: boolean;
}

/** Where each period lies on the 24-hour strip. */
export const periodSpans = (periods: readonly ITimePeriod[]): IPeriodSpan[] =>
	periods.flatMap(({ from, until }, index): IPeriodSpan[] => {
		if (from < until) {
			return [{ index, start: from, end: until, startsPeriod: true, endsPeriod: true }];
		}
		if (from === until) {
			return [];
		}
		// Past midnight: from its start to midnight, and from midnight to its end.
		return [
			{ index, start: from, end: 24, startsPeriod: true, endsPeriod: false },
			...(until > 0
				? [{ index, start: 0, end: until, startsPeriod: false, endsPeriod: true }]
				: []),
		];
	});

/** Dragged times snap to quarter hours. */
const SNAP = 0.25;

const snap = (hours: number) => Math.round(hours / SNAP) * SNAP;

/** An hour back within the day, 0 to under 24. */
const wrap = (hours: number) => ((hours % 24) + 24) % 24;

/** What a drag on the strip changes. */
export type TPeriodDrag =
	/** A period's bar, moved whole (around midnight too). */
	| { kind: "move"; index: number; from: number; original: ITimePeriod }
	/** One end of a period. */
	| { kind: "start" | "end"; index: number }
	/** An empty part of the strip: a new period from there (`index` once it exists). */
	| { kind: "add"; from: number; index: number | null };

/**
 * The periods after dragging to `hour` (0–24 across the strip): moved,
 * stretched or added, snapped to quarter hours. A period never shrinks to
 * nothing; a drag too short to add one leaves them as they were.
 */
export const dragPeriods = (
	periods: readonly ITimePeriod[],
	drag: TPeriodDrag,
	hour: number,
): ITimePeriod[] => {
	const next = [...periods];
	switch (drag.kind) {
		case "move": {
			const shift = snap(hour - drag.from);
			const { from, until } = drag.original;
			next[drag.index] = {
				from: wrap(from + shift),
				until: until === 24 && shift === 0 ? 24 : wrap(until + shift),
			};
			return next;
		}
		case "start": {
			const period = periods[drag.index];
			const from = wrap(snap(hour));
			if (from !== wrap(period.until)) {
				next[drag.index] = { ...period, from };
			}
			return next;
		}
		case "end": {
			const period = periods[drag.index];
			const until = snap(hour);
			if (wrap(until) !== period.from) {
				next[drag.index] = { ...period, until };
			}
			return next;
		}
		case "add": {
			const a = snap(drag.from);
			const b = snap(hour);
			if (Math.abs(b - a) < SNAP) {
				return drag.index === null ? next : next.filter((_, i) => i !== drag.index);
			}
			const period = { from: Math.min(a, b), until: Math.max(a, b) };
			if (drag.index === null) {
				return [...next, period];
			}
			next[drag.index] = period;
			return next;
		}
	}
};
