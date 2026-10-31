import type { Draft } from "immer";

import { SCALE_SETTING } from "#/parts/propData";
import { getPart, resolveProps } from "#/parts/registry";
import { groundHeightAt } from "#/scene/areas";
import { looseName, rowKeyFor, rowKeyMatching, rowKeyOf, rowKeysOf } from "#/scene/rowData";
import {
	DataBindingSchema,
	EntitySchema,
	RoadSchema,
	type TDataBinding,
	type TDataTable,
	type TEntity,
	type TRoad,
	type TScene,
	type TVec2,
} from "#/scene/schema";

import { newId } from "./store";

/**
 * Objects and tables (ADR-0108): giving many objects their rows at once, by
 * their names, and placing an object for each row of a table, already
 * following it. Recipes for a store draft (`commit`), so each is one undo step.
 */

/** The name an object is matched to a row by: its own, else its card's title. */
export const matchingNameOf = (entity: Pick<TEntity, "name" | "label">) =>
	entity.name.trim() || entity.label.title.trim();

/** What assigning rows by name did: the objects that got a row, and those that didn't. */
export interface IRowAssignment {
	matched: { id: string; name: string; rowKey: string }[];
	unmatched: { id: string; name: string }[];
}

/**
 * Each of the objects `ids` follows the row of `table` whose key matches its
 * name (loosely: case, spaces and punctuation don't matter). Objects whose
 * name matches no row keep what they followed.
 */
export const assignRowsByName = (
	scene: Draft<TScene>,
	ids: readonly string[],
	table: Pick<TDataTable, "key" | "keyColumn" | "rows">,
): IRowAssignment => {
	const result: IRowAssignment = { matched: [], unmatched: [] };
	for (const id of ids) {
		const entity = scene.entities.find((each) => each.id === id);
		if (!entity) {
			continue;
		}
		const name = matchingNameOf(entity);
		const rowKey = rowKeyMatching(table, name);
		if (rowKey === undefined) {
			result.unmatched.push({ id, name });
		} else {
			entity.dataRow = { tableKey: table.key, rowKey };
			result.matched.push({ id, name, rowKey });
		}
	}
	return result;
};

/** The smallest and largest number in a column, for a size's range. */
export const columnRange = (
	table: Pick<TDataTable, "rows">,
	column: string,
	positiveOnly = false,
) => {
	const numbers = table.rows
		.map((row) => row[column])
		.filter((cell): cell is number => typeof cell === "number" && (!positiveOnly || cell > 0));
	return numbers.length === 0 ? null : { min: Math.min(...numbers), max: Math.max(...numbers) };
};

/**
 * A size binding for a column: from its smallest value to its largest, on a
 * straight or log scale (a log scale starts at its smallest value above 0).
 */
export const sizeBindingFor = (
	table: Pick<TDataTable, "rows">,
	column: string,
	usesLogScale: boolean,
	setting: { low?: number; high?: number } = {},
): TDataBinding => {
	const range = columnRange(table, column, usesLogScale);
	return DataBindingSchema.parse({
		key: rowKeyFor(column),
		usesLogScale,
		valueAtLowSetting: range?.min ?? null,
		valueAtHighSetting: range && range.max > range.min ? range.max : null,
		lowSetting: setting.low ?? null,
		highSetting: setting.high ?? null,
	});
};

export type TRowLayout = "grid" | "line" | "circle";

/** Where the `index`th of `count` objects stands in a layout, `spacing` apart, round `centre`. */
export const layoutSpot = (
	layout: TRowLayout,
	index: number,
	count: number,
	spacing: number,
	centre: TVec2 = [0, 0],
): TVec2 => {
	if (layout === "line") {
		return [centre[0] + (index - (count - 1) / 2) * spacing, centre[1]];
	}
	if (layout === "circle") {
		// A ring whose neighbours are `spacing` apart, starting at the top (−z) and going round.
		const radius = count < 2 ? 0 : Math.max(spacing, (count * spacing) / (2 * Math.PI));
		const angle = (index / Math.max(1, count)) * Math.PI * 2;
		return [centre[0] + Math.sin(angle) * radius, centre[1] - Math.cos(angle) * radius];
	}
	const columns = Math.ceil(Math.sqrt(count));
	const rows = Math.ceil(count / columns);
	const column = index % columns;
	const row = Math.floor(index / columns);
	return [
		centre[0] + (column - (columns - 1) / 2) * spacing,
		centre[1] + (row - (rows - 1) / 2) * spacing,
	];
};

export interface IPlaceForEachRow {
	table: TDataTable;
	/** The part to place. */
	kind: string;
	layout: TRowLayout;
	/** Grid units between neighbours. */
	spacing: number;
	/** A column of numbers that sizes each, or "" for none. */
	sizeColumn: string;
	/** Which setting the size column drives: "scale", or one of the part's number props. */
	sizeSetting: string;
	usesLogScale: boolean;
	/** Columns shown on each card, besides its name. */
	cardColumns: string[];
	centre?: TVec2;
}

/**
 * An object for each row of a table, already following its row: named by the
 * row's key, laid out in a grid, a line or a circle, sized by a column, with a
 * card showing columns and tiles for the rest. Returns the new objects' ids.
 */
export const placeForEachRow = (scene: Draft<TScene>, options: IPlaceForEachRow): string[] => {
	const { table, kind, layout, spacing, sizeColumn, sizeSetting, usesLogScale, cardColumns } =
		options;
	const part = getPart(kind);
	const keys = rowKeysOf(table);
	const sizeField = part?.fields.find(
		(field) => field.key === sizeSetting && field.type === "number",
	);
	const data: Record<string, TDataBinding> = {};
	if (sizeColumn && (sizeSetting === SCALE_SETTING || sizeField)) {
		data[sizeSetting] = sizeBindingFor(
			table,
			sizeColumn,
			usesLogScale,
			sizeSetting === SCALE_SETTING ? { low: 0.6, high: 2 } : {},
		);
	}
	const tiles = table.columns
		.filter((column) => column.key !== table.keyColumn)
		.map((column) => rowKeyFor(column.key));
	return keys.map((rowKey, index) => {
		const position = layoutSpot(layout, index, keys.length, spacing, options.centre);
		const entity = EntitySchema.parse({
			id: newId(kind),
			kind,
			name: rowKey,
			position,
			altitude: groundHeightAt(scene.areas, position),
			dataRow: { tableKey: table.key, rowKey },
			data: structuredClone(data),
			label: {
				isShown: true,
				title: "",
				dataKeys: cardColumns.map(rowKeyFor),
				offset: [0, 2, 0],
				tag: "",
			},
			details: { description: "", dataKeys: tiles },
		});
		scene.entities.push(entity);
		return entity.id;
	});
};

/** Which objects follow each row of a table, by row key, for the table's viewer. */
export const followersByRow = (
	entities: readonly Pick<TEntity, "id" | "name" | "kind" | "dataRow">[],
	tableKey: string,
) => {
	const byRow = new Map<string, Pick<TEntity, "id" | "name" | "kind">[]>();
	for (const entity of entities) {
		if (entity.dataRow?.tableKey === tableKey) {
			const list = byRow.get(entity.dataRow.rowKey) ?? [];
			list.push(entity);
			byRow.set(entity.dataRow.rowKey, list);
		}
	}
	return byRow;
};

export interface IRoadForEachRow {
	table: TDataTable;
	/** The columns naming where each row goes from and to: objects' names. */
	fromColumn: string;
	toColumn: string;
	/** A column of numbers for how much goes, or "" for none. */
	amountColumn: string;
	kind: TRoad["kind"];
	/** The widest a road gets, at the column's largest amount, in grid units. */
	widest: number;
}

/** What drawing a road for each row did: the roads drawn, and the rows whose ends weren't found. */
export interface IRoadsDrawn {
	ids: string[];
	unmatched: string[];
}

/**
 * A road for each row of a "from, to, amount" table (ADR-0112): from the
 * object named in its from column to the one named in its to column (names
 * matched loosely), following its row, its width showing the amount: from a
 * lane's width at 0 to `widest` at the column's largest, and its vehicles per
 * length of road too (from one every 20 units to three every 10), so short
 * roads can't hide an amount.
 */
export const drawRoadsForEachRow = (
	scene: Draft<TScene>,
	options: IRoadForEachRow,
): IRoadsDrawn => {
	const { table, fromColumn, toColumn, amountColumn, kind, widest } = options;
	const byName = (name: string) =>
		scene.entities.find((entity) => looseName(matchingNameOf(entity)) === looseName(name));
	const range = amountColumn ? columnRange(table, amountColumn) : null;
	const result: IRoadsDrawn = { ids: [], unmatched: [] };
	table.rows.forEach((row, index) => {
		const rowKey = rowKeyOf(table, row, index);
		const from = byName(String(row[fromColumn] ?? ""));
		const to = byName(String(row[toColumn] ?? ""));
		if (!from || !to || from === to) {
			result.unmatched.push(rowKey);
			return;
		}
		// From the edge of one to the edge of the other, so vehicles don't drive through them.
		const [fx, fz] = from.position;
		const [tx, tz] = to.position;
		const distance = Math.hypot(tx - fx, tz - fz) || 1;
		const edge = (entity: Draft<TEntity>) => {
			const part = getPart(entity.kind);
			const [w, d] = part ? part.footprint(resolveProps(part, entity.props)) : [1, 1];
			return Math.min(distance * 0.4, (Math.max(w, d) / 2) * entity.scale + 0.5);
		};
		const ux = (tx - fx) / distance;
		const uz = (tz - fz) / distance;
		const start: TVec2 = [fx + ux * edge(from), fz + uz * edge(from)];
		const end: TVec2 = [tx - ux * edge(to), tz - uz * edge(to)];
		const road = RoadSchema.parse({
			id: newId("road"),
			kind,
			name: `${matchingNameOf(from)} → ${matchingNameOf(to)}`,
			points: [start, end],
			showsCentreLine: false,
			dataRow: { tableKey: table.key, rowKey },
			width: Math.min(2, widest),
			flow: { isOn: true, vehicleCountAlong: 2 },
			data: amountColumn
				? {
						width: {
							key: rowKeyFor(amountColumn),
							valueAtLowSetting: 0,
							valueAtHighSetting: range?.max ?? null,
							lowSetting: 0.6,
							highSetting: Math.max(0.6, widest),
						},
						vehicleDensity: {
							key: rowKeyFor(amountColumn),
							valueAtLowSetting: 0,
							valueAtHighSetting: range?.max ?? null,
							lowSetting: 0.5,
							highSetting: 3,
						},
					}
				: {},
		});
		scene.roads.push(road);
		result.ids.push(road.id);
	});
	return result;
};
