import { dataRangeOf, rangeBindingFor, withDataRange } from "#/editor/dataRange";
import { matchingNameOf } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { useWorldData } from "#/editor/worldData";
import { dataDrivenFields, SCALE_RANGE, SCALE_SETTING, valuesOfEntity } from "#/parts/propData";
import type { TAnyPart } from "#/parts/registry";
import type { TFieldSpec } from "#/parts/types";
import { formatEntry } from "#/scene/format";
import { columnOfKey, rowKeyMatching, rowKeysOf, tableOfRow, valuesWithRow } from "#/scene/rowData";
import {
	DataBindingSchema,
	type TDataBinding,
	type TDataRowRef,
	type TEntity,
} from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { DataBindingFields } from "./DataBindingFields";
import { ComboboxField, FieldGroup, Hint, resetToDefault, Section, SelectField } from "./fields";
import { List, ListItem } from "./List";

/** A table with more rows than this picks its row from a list with a search. */
const ROWS_IN_A_SELECT = 30;

/**
 * The table row a thing follows (ADR-0108): which table, which row, what its
 * row holds now, and matching it by name. Without tables, the table choice is
 * greyed out with a way to the Data tab. For objects and roads alike.
 */
export const TableRowSection = ({
	dataRow: ref,
	name,
	setRow,
	what = "Its card, tiles, colours, lights and sizes",
}: {
	dataRow: TDataRowRef | null;
	/** The thing's name, to match a row by. */
	name: string;
	setRow: (next: TDataRowRef | null) => void;
	/** What can follow its row, in words. */
	what?: string;
}) => {
	const data = useWorldData();
	const setTab = useEditor((s) => s.setTab);
	const table = tableOfRow(data, ref);
	const rowKeys = table ? rowKeysOf(table) : [];
	const hasTables = data.tables.length > 0;
	const columns = valuesWithRow(data, ref).filter(
		(entry) => columnOfKey(entry.key) !== null && columnOfKey(entry.key) !== table?.keyColumn,
	);

	return (
		<Section
			id="data.row"
			icon="list"
			title="Table row"
			keywords="data table row follows columns spreadsheet"
		>
			<SelectField
				label="Table"
				value={ref?.tableKey ?? ""}
				options={[
					{ value: "", label: "None" },
					// A table that's gone stays shown until another is picked.
					...(ref && !table ? [{ value: ref.tableKey, label: `${ref.tableKey} (gone)` }] : []),
					...(hasTables
						? data.tables.map((each) => ({ value: each.key, label: each.name || each.key }))
						: [{ value: "_none", label: "A table (no tables yet)", disabled: true }]),
				]}
				onChange={(tableKey) => {
					const next = data.tables.find((each) => each.key === tableKey);
					// The row matching its name, else the first.
					setRow(
						next
							? { tableKey, rowKey: rowKeyMatching(next, name) ?? rowKeysOf(next)[0] ?? "" }
							: null,
					);
				}}
				inherit={resetToDefault(ref?.tableKey ?? "", "", () => setRow(null), "none")}
				hint={`${what} can then show or follow its row's columns.`}
			/>

			{!hasTables && (
				<>
					<Hint>
						Read a spreadsheet, a link or an API in the Data tab to get a table: a row per thing,
						like a warehouse, a shop or a city.
					</Hint>

					<Button size="sm" icon="chart" onClick={() => setTab("data")}>
						Open the Data tab
					</Button>
				</>
			)}

			{ref && table && (
				<>
					{rowKeys.length > ROWS_IN_A_SELECT ? (
						<ComboboxField
							label="Row"
							value={ref.rowKey}
							groups={[
								{
									label: table.name || table.key,
									options: rowKeys.map((key) => ({ value: key, label: key })),
								},
							]}
							onChange={(rowKey) => setRow({ ...ref, rowKey })}
							hasNoDefault
						/>
					) : (
						<SelectField
							label="Row"
							value={ref.rowKey}
							options={[
								...(rowKeys.includes(ref.rowKey)
									? []
									: [{ value: ref.rowKey, label: `${ref.rowKey} (not in the table)` }]),
								...rowKeys.map((key) => ({ value: key, label: key })),
							]}
							onChange={(rowKey) => setRow({ ...ref, rowKey })}
							hasNoDefault
						/>
					)}

					{/* Its row's columns and what they hold now; the one naming the row is the Row above. */}
					{columns.length > 0 ? (
						<List>
							{columns.map((entry) => (
								<ListItem key={entry.key} label={entry.name} meta={formatEntry(entry)} muted />
							))}
						</List>
					) : (
						<Hint>Its row has no values now (no data).</Hint>
					)}

					<Hint>Pick its columns as “Row: …” wherever a value is picked.</Hint>

					<Button
						size="sm"
						icon="search"
						onClick={() => {
							const rowKey = rowKeyMatching(table, name);
							if (rowKey === undefined) {
								notify(
									"No row matches its name",
									`No row of ${table.name || table.key} is called “${name}”.`,
									"error",
								);
							} else {
								setRow({ ...ref, rowKey });
							}
						}}
					>
						Take the row matching its name
					</Button>
				</>
			)}
		</Section>
	);
};

/** How a prop's field shows a setting from data. */
const fieldRangeOf = (field: Extract<TFieldSpec, { type: "number" }>) => ({
	min: field.min,
	max: field.max,
	step: field.step,
});

/** A setting of an object that can follow data: its size, or a number or switch of its part. */
interface IFollowingSetting {
	key: string;
	label: string;
	kind: "range" | "switch";
	range?: { min: number; max: number; step: number; format?: (setting: number) => string };
	/** What it starts at, low and high, when it starts following data. */
	startsAt?: { low: number; high: number };
}

/**
 * What of an object follows data (ADR-0109, ADR-0123): only the settings that
 * do, each with what it follows and how ("Size follows Visitors: 1,180 → ×0.6
 * to 1,410 → ×2"), its fields to change that, Use its lowest and highest, and
 * Stop following; then one row to make another follow data. Settings set by
 * hand stay in the Object and Shape tabs, which say when one follows data.
 */
const FollowsDataSection = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const data = useWorldData();
	const values = valuesOfEntity(entity, data);
	const updateEntity = useEditor((s) => s.updateEntity);
	const openDataWindow = useEditor((s) => s.openDataWindow);
	const setBinding = (setting: string, binding: TDataBinding | null, coalesce?: string) =>
		updateEntity(
			entity.id,
			(draft) => {
				if (binding) {
					draft.data[setting] = binding;
				} else {
					delete draft.data[setting];
				}
			},
			coalesce ? { coalesce: `${entity.id}:data:${setting}:${coalesce}` } : undefined,
		);
	// A value's lowest and highest, a row's column over the whole table: where a size starts.
	const rangeOf = (key: string) => dataRangeOf(data, key, entity.dataRow);
	const settings: IFollowingSetting[] = [
		{
			key: SCALE_SETTING,
			label: "Size",
			kind: "range",
			range: { ...SCALE_RANGE, step: 0.05, format: (value) => `×${value.toFixed(2)}` },
			// An object grows from a bit smaller to twice its size: ×4 fills the view.
			startsAt: { low: 0.6, high: 2 },
		},
		...dataDrivenFields(part).flatMap((field): IFollowingSetting[] =>
			field.type === "number"
				? [{ key: field.key, label: field.label, kind: "range", range: fieldRangeOf(field) }]
				: field.type === "boolean"
					? [{ key: field.key, label: field.label, kind: "switch" }]
					: [],
		),
	];
	const following = settings.filter((setting) => entity.data[setting.key]);
	const free = settings.filter((setting) => !entity.data[setting.key]);
	// A size starts on a value it can use (a number); a switch on any.
	const firstKeyFor = (kind: IFollowingSetting["kind"]) =>
		(kind === "range" ? values.find((entry) => typeof entry.value === "number") : values[0])?.key ??
		"";

	const start = (key: string) => {
		const setting = settings.find((each) => each.key === key);
		if (!setting) {
			return;
		}
		const valueKey = firstKeyFor(setting.kind);
		setBinding(
			key,
			setting.kind === "range"
				? rangeBindingFor(data, valueKey, entity.dataRow, setting.startsAt)
				: DataBindingSchema.parse({ key: valueKey }),
		);
	};

	return (
		<Section
			id="data.sizes"
			icon="chart"
			title="Follows data"
			keywords="size scale props floors grow log scale data follows switch"
		>
			{following.length === 0 && (
				<Hint>
					Nothing of it follows data yet. Make its size or a setting follow a value or a column of
					its row: bigger numbers, bigger buildings.
				</Hint>
			)}

			{following.map((setting) => {
				const binding = entity.data[setting.key];
				if (!binding) {
					return null;
				}
				const found = setting.kind === "range" ? rangeOf(binding.key) : null;
				const isDataRange =
					found !== null &&
					binding.valueAtLowSetting === found.min &&
					binding.valueAtHighSetting === found.max;
				return (
					<FieldGroup key={setting.key} title={`${setting.label} follows data`}>
						<DataBindingFields
							kind={setting.kind}
							binding={binding}
							data={values}
							range={setting.range}
							// Another value picked: its range comes with it.
							onChange={(next, coalesce) =>
								setBinding(
									setting.key,
									setting.kind === "range" && next.key !== binding.key
										? withDataRange(next, data, entity.dataRow)
										: next,
									coalesce,
								)
							}
						/>

						<ButtonGroup>
							{setting.kind === "range" && (
								<Button
									size="sm"
									icon="reset"
									disabled={found === null || isDataRange}
									onClick={() =>
										setBinding(setting.key, withDataRange(binding, data, entity.dataRow))
									}
								>
									Use its lowest and highest
								</Button>
							)}

							<Button size="sm" icon="close" onClick={() => setBinding(setting.key, null)}>
								Stop following
							</Button>
						</ButtonGroup>
					</FieldGroup>
				);
			})}

			{values.length === 0 ? (
				<>
					<Hint>No values yet: add data first, then make its size or a setting follow it.</Hint>

					<ButtonGroup>
						<Button size="sm" icon="plus" onClick={() => openDataWindow({ kind: "add" })}>
							Add data
						</Button>
					</ButtonGroup>
				</>
			) : (
				free.length > 0 && (
					<SelectField
						label="Make follow data"
						value=""
						options={[
							{ value: "", label: "Pick a setting…", disabled: true },
							...free.map((setting) => ({ value: setting.key, label: setting.label })),
						]}
						onChange={start}
						hasNoDefault
						hint="Its range starts from the data's lowest to its highest."
					/>
				)
			)}
		</Section>
	);
};

/** The object's Data tab: the row it follows, and its sizes from data (ADR-0108, ADR-0109). */
export const EntityDataTab = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const updateEntity = useEditor((s) => s.updateEntity);
	return (
		<>
			<TableRowSection
				dataRow={entity.dataRow}
				name={matchingNameOf(entity)}
				setRow={(next) =>
					updateEntity(entity.id, (draft) => {
						draft.dataRow = next;
					})
				}
			/>

			<FollowsDataSection entity={entity} part={part} />
		</>
	);
};
