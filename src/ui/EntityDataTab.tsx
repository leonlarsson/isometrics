import { matchingNameOf } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { useWorldData } from "#/editor/worldData";
import { dataDrivenFields, SCALE_RANGE, SCALE_SETTING, valuesOfEntity } from "#/parts/propData";
import { resolveProps, type TAnyPart } from "#/parts/registry";
import type { TFieldSpec } from "#/parts/types";
import { formatEntry } from "#/scene/format";
import { columnOfKey, rowKeyMatching, rowKeysOf, tableOfRow, valuesWithRow } from "#/scene/rowData";
import type { TDataBinding, TDataRowRef, TEntity } from "#/scene/schema";

import { Button } from "./Button";
import { DataDrivenField } from "./DataDrivenField";
import {
	ComboboxField,
	Hint,
	resetToDefault,
	Section,
	SelectField,
	SliderField,
	SwitchField,
} from "./fields";

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
	const shown = valuesWithRow(data, ref).filter((entry) => columnOfKey(entry.key) !== null);

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
						like a game, a club or a warehouse.
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

					<Hint>
						{shown.length > 0
							? `Its row now: ${shown.map((entry) => `${entry.name} ${formatEntry(entry)}`).join(", ")}. Pick its columns as “Row: …” wherever a value is picked.`
							: "Its row has no values now (no data)."}
					</Hint>

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
const rangeOf = (field: Extract<TFieldSpec, { type: "number" }>) => ({
	min: field.min,
	max: field.max,
	step: field.step,
});

/**
 * Its size and its part's settings, each by hand or from data (ADR-0109): a
 * number placed between two values on a straight or log scale, an on/off
 * setting switched by a value.
 */
const SizesFromDataSection = ({ entity, part }: { entity: TEntity; part: TAnyPart }) => {
	const data = useWorldData();
	const values = valuesOfEntity(entity, data);
	const updateEntity = useEditor((s) => s.updateEntity);
	const setEntityProp = useEditor((s) => s.setEntityProp);
	const props = resolveProps(part, entity.props) as Record<string, unknown>;
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
	const fields = dataDrivenFields(part).filter(
		(field) => field.type === "number" || field.type === "boolean",
	);

	return (
		<Section
			id="data.sizes"
			icon="chart"
			title="Sizes from data"
			keywords="size scale props floors grow log scale data follows"
		>
			<Hint>
				A size or setting can follow a value or a column of its row: bigger numbers, bigger
				buildings.
			</Hint>

			<DataDrivenField
				kind="range"
				binding={entity.data[SCALE_SETTING]}
				data={values}
				range={{ ...SCALE_RANGE, step: 0.05, format: (value) => `×${value.toFixed(2)}` }}
				onBindingChange={(binding, coalesce) => setBinding(SCALE_SETTING, binding, coalesce)}
			>
				<SliderField
					label="Size"
					value={entity.scale}
					min={0.1}
					max={10}
					sliderMax={4}
					step={0.05}
					onChange={(scale) =>
						updateEntity(
							entity.id,
							(draft) => {
								draft.scale = scale;
							},
							{ coalesce: `${entity.id}:scale` },
						)
					}
					inherit={resetToDefault(
						entity.scale,
						1,
						() =>
							updateEntity(entity.id, (draft) => {
								draft.scale = 1;
							}),
						"1",
					)}
				/>
			</DataDrivenField>

			{fields.map((field) => (
				<DataDrivenField
					key={field.key}
					kind={field.type === "number" ? "range" : "switch"}
					binding={entity.data[field.key]}
					data={values}
					range={field.type === "number" ? rangeOf(field) : undefined}
					onBindingChange={(binding, coalesce) => setBinding(field.key, binding, coalesce)}
				>
					{field.type === "number" ? (
						<SliderField
							label={field.label}
							value={Number(props[field.key])}
							min={field.min}
							max={field.max}
							step={field.step}
							onChange={(value) =>
								setEntityProp(entity.id, field.key, value, {
									coalesce: `${entity.id}:prop:${field.key}`,
								})
							}
							hasNoDefault
							hint="Also in the Shape tab."
						/>
					) : (
						<SwitchField
							label={field.label}
							checked={Boolean(props[field.key])}
							onChange={(on) => setEntityProp(entity.id, field.key, on)}
							hasNoDefault
							hint="Also in the Shape tab."
						/>
					)}
				</DataDrivenField>
			))}
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

			<SizesFromDataSection entity={entity} part={part} />
		</>
	);
};
