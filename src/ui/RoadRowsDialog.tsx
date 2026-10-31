import { useState } from "react";

import { drawRoadsForEachRow } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { ROAD_KIND_LABELS } from "#/scene/roads";
import type { TDataTable, TRoad } from "#/scene/schema";

import { Dialog } from "./Dialog";
import { Hint, SelectField, SliderField } from "./fields";

/** The columns of a table holding text in some row (names of places). */
export const textColumnsOf = (table: TDataTable) =>
	table.columns.filter((column) => table.rows.some((row) => typeof row[column.key] === "string"));

/**
 * The column a from or to is likely in: one named so ("from", "source"…), else
 * the `nth` column of text that isn't the one naming rows.
 */
const guessColumn = (table: TDataTable, named: RegExp, nth: number) => {
	const texts = textColumnsOf(table);
	return (
		texts.find((column) => named.test(column.key) || named.test(column.name))?.key ??
		texts.filter((column) => column.key !== table.keyColumn)[nth]?.key ??
		texts[nth]?.key ??
		""
	);
};

/**
 * Draw a road for each row (ADR-0112): a "from, to, amount" table becomes
 * roads between the objects its rows name, each following its row, its flow's
 * vehicles as many as the amount says. One undo step.
 */
export const RoadRowsDialog = ({ table, onClose }: { table: TDataTable; onClose: () => void }) => {
	const commit = useEditor((s) => s.commit);
	const texts = textColumnsOf(table);
	const numbers = table.columns.filter((column) =>
		table.rows.some((row) => typeof row[column.key] === "number"),
	);
	const [fromColumn, setFromColumn] = useState(() =>
		guessColumn(table, /^(from|source|origin)/i, 0),
	);
	const [toColumn, setToColumn] = useState(() => guessColumn(table, /^(to|target|dest)/i, 1));
	const [amountColumn, setAmountColumn] = useState(numbers[0]?.key ?? "");
	const [kind, setKind] = useState<TRoad["kind"]>("road_01");
	const [widest, setWidest] = useState(3);
	const columnOptions = texts.map((column) => ({
		value: column.key,
		label: column.name || column.key,
	}));

	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onClose()}
			title={`Draw a road for each row of ${table.name || table.key}`}
			description="From the object its from column names to the one its to column names, wider for more."
			closeLabel="Cancel"
			confirm={{
				label: `Draw ${table.rows.length.toLocaleString()} roads`,
				disabled: !fromColumn || !toColumn || fromColumn === toColumn,
				onConfirm: () => {
					let drawn = { ids: [] as string[], unmatched: [] as string[] };
					commit((scene) => {
						drawn = drawRoadsForEachRow(scene, {
							table,
							fromColumn,
							toColumn,
							amountColumn,
							kind,
							widest,
						});
					});
					notify(
						`Drew ${drawn.ids.length} of ${table.rows.length} roads`,
						drawn.unmatched.length > 0
							? `No objects named as in ${drawn.unmatched.map((key) => `“${key}”`).join(", ")}: rename them to match, then draw again.`
							: "Each follows its row: change its flow in its Data tab.",
						drawn.ids.length === 0 ? "error" : "info",
					);
				},
			}}
		>
			<SelectField
				label="From"
				value={fromColumn}
				options={columnOptions}
				onChange={setFromColumn}
				hasNoDefault
			/>

			<SelectField
				label="To"
				value={toColumn}
				options={columnOptions}
				onChange={setToColumn}
				hasNoDefault
			/>

			<SelectField
				label="Amount"
				value={amountColumn}
				options={[
					{ value: "", label: "None (all as wide)" },
					...numbers.map((column) => ({ value: column.key, label: column.name || column.key })),
				]}
				onChange={setAmountColumn}
				hasNoDefault
			/>

			<SliderField
				label="Widest"
				value={widest}
				min={1}
				max={8}
				step={0.1}
				onChange={setWidest}
				hasNoDefault
				hint="A road's width shows its amount: this wide at the largest, a lane's width at 0, in proportion between. A couple of vehicles drive each one to show which way it goes."
			/>

			<SelectField
				label="Style"
				value={kind}
				options={(Object.keys(ROAD_KIND_LABELS) as TRoad["kind"][]).map((value) => ({
					value,
					label: ROAD_KIND_LABELS[value],
				}))}
				onChange={setKind}
				hasNoDefault
			/>

			<Hint>Names are matched loosely: case, spaces and punctuation don't matter.</Hint>
		</Dialog>
	);
};
