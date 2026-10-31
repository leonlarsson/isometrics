import { valuesWithRow } from "#/scene/rowData";
import type { TDataValue, TEntity, TWorldData } from "#/scene/schema";

import { boundEntry, readSetting, readSwitch } from "./dataBinding";
import { getPart, type TAnyPart } from "./registry";
import type { TFieldSpec } from "./types";

/**
 * An object's sizes and props that follow data (ADR-0109): its `data` map, by
 * prop name or `scale`. A number prop is placed between its range on a
 * straight or log scale, an on/off prop switches, a choice takes a value that
 * names one of its options, text takes the value as it is. What's drawn reads
 * the object as these make it (`entityAsDrawn`); what's stored never changes.
 */

/** The key in an object's `data` map for its size (its `scale`). */
export const SCALE_SETTING = "scale";

/** The sizes the Size from data offers by default, as a field's range. */
export const SCALE_RANGE = { min: 0.25, max: 4 };

/** The props of a part that can follow data: numbers, switches, choices and text. */
export const dataDrivenFields = (part: TAnyPart) =>
	part.fields.filter((field) => field.type !== "dataKey");

/** A prop's value from data, as its field reads it; undefined to keep its own. */
export const propFromData = (
	field: TFieldSpec,
	binding: TEntity["data"][string] | undefined,
	data: readonly TDataValue[] | undefined,
): unknown => {
	if (!binding) {
		return undefined;
	}
	switch (field.type) {
		case "number": {
			const value = readSetting(binding, data, field);
			return value === undefined
				? undefined
				: Math.min(field.max, Math.max(field.min, Math.round(value / field.step) * field.step));
		}
		case "boolean":
			return readSwitch(binding, data);
		case "select": {
			const text = String(boundEntry(binding, data)?.value ?? "")
				.trim()
				.toLowerCase();
			return field.options.find(
				(option) => option.value.toLowerCase() === text || option.label.toLowerCase() === text,
			)?.value;
		}
		case "text": {
			const value = boundEntry(binding, data)?.value;
			return value === undefined ? undefined : String(value);
		}
		default:
			return undefined;
	}
};

/** An object's size from data, if it follows data and the value is a number. */
export const scaleFromData = (
	entity: Pick<TEntity, "data">,
	data: readonly TDataValue[] | undefined,
) => {
	const value = readSetting(entity.data[SCALE_SETTING], data, SCALE_RANGE);
	return value === undefined ? undefined : Math.min(10, Math.max(0.1, value));
};

/** Whether any of an object's props or its size follow data. */
export const followsDataInSize = (entity: Pick<TEntity, "data">) =>
	Object.keys(entity.data ?? {}).length > 0;

/** Per object and data: the object as drawn, so it stays the same object while neither changes. */
const drawn = new WeakMap<TEntity, { data: readonly TDataValue[] | undefined; entity: TEntity }>();

/**
 * An object as it's drawn now: its props and size as data sets them (the
 * object itself when nothing of it follows data, or nothing reads yet).
 */
export const entityAsDrawn = (
	entity: TEntity,
	data: readonly TDataValue[] | undefined,
): TEntity => {
	if (!data || !followsDataInSize(entity)) {
		return entity;
	}
	const cached = drawn.get(entity);
	if (cached && cached.data === data) {
		return cached.entity;
	}
	const part = getPart(entity.kind);
	const props: Record<string, unknown> = { ...entity.props };
	let changed = false;
	for (const field of part ? dataDrivenFields(part) : []) {
		const value = propFromData(field, entity.data[field.key], data);
		if (value !== undefined) {
			props[field.key] = value;
			changed = true;
		}
	}
	const scale = scaleFromData(entity, data);
	const result =
		changed || scale !== undefined
			? { ...entity, props: changed ? props : entity.props, scale: scale ?? entity.scale }
			: entity;
	drawn.set(entity, { data, entity: result });
	return result;
};

/** What an object can read: the world's values and its row's columns (ADR-0108). */
export const valuesOfEntity = (entity: Pick<TEntity, "dataRow">, data: TWorldData) =>
	valuesWithRow(data, entity.dataRow);
