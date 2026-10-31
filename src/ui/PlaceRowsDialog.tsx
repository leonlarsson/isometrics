import { useState } from "react";

import { placeForEachRow, type TRowLayout } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { SCALE_SETTING } from "#/parts/propData";
import { getPart, PARTS, partName } from "#/parts/registry";
import { CATEGORY_LABELS, type TPartCategory } from "#/parts/types";
import type { TDataTable } from "#/scene/schema";

import { Dialog } from "./Dialog";
import {
	CheckboxGroupField,
	ComboboxField,
	Hint,
	SelectField,
	SliderField,
	SwitchField,
} from "./fields";

const LAYOUTS: { value: TRowLayout; label: string }[] = [
	{ value: "grid", label: "A grid" },
	{ value: "line", label: "A line" },
	{ value: "circle", label: "A circle" },
];

/** The part a table's rows get first: a cluster if there is one, else a house. */
const firstKind = () =>
	PARTS.find((part) => part.kind.includes("cluster"))?.kind ?? PARTS[0]?.kind ?? "house_01";

/**
 * Place one for each row (ADR-0108): pick a part, a layout and what sizes
 * each, and get an object for every row of a table, named by its row and
 * already following it, as one undo step.
 */
export const PlaceRowsDialog = ({ table, onClose }: { table: TDataTable; onClose: () => void }) => {
	const commit = useEditor((s) => s.commit);
	const numberColumns = table.columns.filter((column) =>
		table.rows.some((row) => typeof row[column.key] === "number"),
	);
	const [kind, setKind] = useState(firstKind);
	const [layout, setLayout] = useState<TRowLayout>("grid");
	const [spacing, setSpacing] = useState(8);
	const [sizeColumn, setSizeColumn] = useState(numberColumns[0]?.key ?? "");
	const [usesLogScale, setUsesLogScale] = useState(false);
	const [cardColumns, setCardColumns] = useState(numberColumns.slice(0, 1).map((c) => c.key));
	const part = getPart(kind);
	const numberProps = (part?.fields ?? []).filter((field) => field.type === "number");
	// A cluster grows by how much of it is built; anything else by its size.
	const [sizeSetting, setSizeSetting] = useState(SCALE_SETTING);
	const settingShown =
		sizeSetting === SCALE_SETTING || numberProps.some((field) => field.key === sizeSetting)
			? sizeSetting
			: SCALE_SETTING;
	const categories = Object.keys(CATEGORY_LABELS) as TPartCategory[];

	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onClose()}
			title={`Place one for each row of ${table.name || table.key}`}
			description={`${table.rows.length.toLocaleString()} objects, each named by its row and following it.`}
			closeLabel="Cancel"
			confirm={{
				label: `Place ${table.rows.length.toLocaleString()} objects`,
				disabled: table.rows.length === 0 || !part,
				onConfirm: () => {
					commit((scene) => {
						placeForEachRow(scene, {
							table,
							kind,
							layout,
							spacing,
							sizeColumn,
							sizeSetting: settingShown,
							usesLogScale,
							cardColumns,
						});
					});
					notify(
						`Placed ${table.rows.length.toLocaleString()} objects`,
						"Each follows its row: change one's card, colours or sizes from data in its Data tab, or select them all to change them together.",
					);
				},
			}}
		>
			<ComboboxField
				label="Part"
				value={kind}
				groups={categories.map((category) => ({
					label: CATEGORY_LABELS[category],
					options: PARTS.filter((each) => each.category === category).map((each) => ({
						value: each.kind,
						label: partName(each),
					})),
				}))}
				onChange={setKind}
				hasNoDefault
			/>

			<SelectField
				label="Layout"
				value={layout}
				options={LAYOUTS}
				onChange={setLayout}
				hasNoDefault
			/>

			<SliderField
				label="Spacing"
				value={spacing}
				min={1}
				max={40}
				step={0.5}
				onChange={setSpacing}
				hasNoDefault
				hint="Grid units between neighbours."
			/>

			<SelectField
				label="Sized by"
				value={sizeColumn}
				options={[
					{ value: "", label: "Nothing" },
					...(numberColumns.length > 0
						? numberColumns.map((column) => ({
								value: column.key,
								label: column.name || column.key,
							}))
						: [{ value: "_none", label: "A column (no columns of numbers)", disabled: true }]),
				]}
				onChange={setSizeColumn}
				hasNoDefault
			/>

			{sizeColumn && (
				<>
					<SelectField
						label="Which grows"
						value={settingShown}
						options={[
							{ value: SCALE_SETTING, label: "Its size" },
							...numberProps.map((field) => ({ value: field.key, label: field.label })),
						]}
						onChange={setSizeSetting}
						hasNoDefault
						hint="From the column's smallest value to its largest."
					/>

					<SwitchField
						label="Log scale"
						checked={usesLogScale}
						onChange={setUsesLogScale}
						hasNoDefault
						hint="Each tenfold the same step: for numbers far apart, like players."
					/>
				</>
			)}

			<CheckboxGroupField
				label="On each card"
				options={table.columns
					.filter((column) => column.key !== table.keyColumn)
					.map((column) => ({ value: column.key, label: column.name || column.key }))}
				value={cardColumns}
				onChange={setCardColumns}
				hasNoDefault
			/>

			<Hint>
				Every other column shows as a tile when one is opened in View mode. Reading the table again
				updates them all.
			</Hint>
		</Dialog>
	);
};
