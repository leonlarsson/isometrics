import type { TDataPoint, TWorldData } from "./schema";

/**
 * Stories (ADR-0114): the world's data as it was on a date, from the past its
 * sources gave (values' `history`, tables' `history`). Everything that shows or
 * follows data reads it through `worldDataAt`, so a slider over the dates
 * plays the whole world through time. No React.
 */

/** Every date the world's data has a value for, oldest first. */
export const storyDates = (data: Pick<TWorldData, "values" | "tables">): string[] =>
	[
		...new Set([
			...data.values.flatMap((value) => value.history.map((point) => point.at)),
			...data.tables.flatMap((table) => table.history.map((past) => past.at)),
		]),
	].sort();

/** The points of a past up to a date, oldest first. */
const upTo = (history: readonly TDataPoint[], at: string) =>
	history.filter((point) => point.at <= at);

/**
 * The world's data as it was on `at`: each value its last point by then (and
 * its past up to then), each table its last rows by then. A value or table
 * whose past starts later has no data then: values are left out, tables
 * empty. One without a past stays as it is.
 */
export const worldDataAt = (data: TWorldData, at: string): TWorldData => ({
	...data,
	values: data.values.flatMap((value) => {
		if (value.history.length === 0) {
			return [value];
		}
		const past = upTo(value.history, at);
		const then = past.at(-1);
		return then ? [{ ...value, value: then.value, history: past }] : [];
	}),
	tables: data.tables.map((table) => {
		if (table.history.length === 0) {
			return table;
		}
		const past = table.history.filter((each) => each.at <= at);
		return { ...table, rows: past.at(-1)?.rows ?? [], history: past };
	}),
});
