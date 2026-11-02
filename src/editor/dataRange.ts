import { columnOfKey, tableOfRow } from "#/scene/rowData";
import {
	DataBindingSchema,
	type TDataBinding,
	type TDataRowRef,
	type TWorldData,
} from "#/scene/schema";

import { columnRange } from "./dataRows";

/**
 * Where a size or amount following data starts (ADR-0123): from the lowest to
 * the highest number the data has, so it moves as soon as it's set, instead
 * of a fixed 0 to 100 that a number like 1,410 is always above.
 */

/** The numbers a value has had: its past values and the one it shows now. */
const numbersOf = (data: Pick<TWorldData, "values">, key: string) => {
	const value = data.values.find((each) => each.key === key);
	if (!value) {
		return [];
	}
	return [...value.history.map((point) => point.value), value.value].filter(
		(each): each is number => typeof each === "number",
	);
};

/**
 * The lowest and highest number a value or a column of the thing's row has
 * (a value: over its past and now; a column: over the table's rows), or null
 * when it has none. A value that has only ever had one number goes from 0 to it.
 */
export const dataRangeOf = (
	data: Pick<TWorldData, "values" | "tables">,
	key: string,
	dataRow: TDataRowRef | null,
): { min: number; max: number } | null => {
	const column = columnOfKey(key);
	if (column !== null) {
		const table = tableOfRow(data, dataRow);
		return table ? columnRange(table, column) : null;
	}
	const numbers = numbersOf(data, key);
	if (numbers.length === 0) {
		return null;
	}
	const min = Math.min(...numbers);
	const max = Math.max(...numbers);
	return min < max ? { min, max } : max > 0 ? { min: 0, max } : null;
};

/**
 * A binding for a size or amount following `key`, its range from the data's
 * lowest to highest (`dataRangeOf`), and what the setting is at each end
 * (null: the setting's own smallest and largest).
 */
export const rangeBindingFor = (
	data: Pick<TWorldData, "values" | "tables">,
	key: string,
	dataRow: TDataRowRef | null,
	setting: { low?: number; high?: number } = {},
): TDataBinding => {
	const range = dataRangeOf(data, key, dataRow);
	return DataBindingSchema.parse({
		key,
		valueAtLowSetting: range?.min ?? null,
		valueAtHighSetting: range?.max ?? null,
		lowSetting: setting.low ?? null,
		highSetting: setting.high ?? null,
	});
};

/** The range a binding gets from its data now (Use its lowest and highest), or the binding as it is. */
export const withDataRange = (
	binding: TDataBinding,
	data: Pick<TWorldData, "values" | "tables">,
	dataRow: TDataRowRef | null,
): TDataBinding => {
	const range = dataRangeOf(data, binding.key, dataRow);
	return range
		? { ...binding, valueAtLowSetting: range.min, valueAtHighSetting: range.max }
		: binding;
};
