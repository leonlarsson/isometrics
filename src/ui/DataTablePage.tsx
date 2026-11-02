import type { Draft } from "immer";
import { useState } from "react";

import { followersByRow } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { partNameOf } from "#/parts/registry";
import type { TDataSource, TDataTable } from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTableView } from "./DataTableView";
import { FieldGroup, Hint, Section, SelectField, TextField } from "./fields";
import { PageKind } from "./PageKind";
import { ShowTableInWorld } from "./ShowInWorld";

import styles from "./DataWindow.module.css";

/** The most rows the table viewer draws; a world's tables can hold thousands. */
const MOST_ROWS = 500;

/**
 * A table in the Data window (ADR-0123): what it is in a sentence, what can
 * show it in the world, its rows (and what follows each), and a way to remove it.
 */
export const DataTablePage = ({
	table,
	origin,
	isNew,
	source,
	onConfigure,
}: {
	table: TDataTable;
	/** The source it's read from, if it still exists. */
	source: TDataSource | null;
	/** Choose again how it's read: the source's Configure what's read (a link), or its file again. */
	onConfigure: (source: TDataSource) => void;
	/** Where its rows come from, in a sentence (`tableInWords`). */
	origin: string;
	/** Just added: Show it in the world comes first, said as the next step. */
	isNew: boolean;
}) => {
	const entities = useEditor((s) => s.scene.entities);
	const removeDataTable = useEditor((s) => s.removeDataTable);
	const commit = useEditor((s) => s.commit);
	/** Change this table (typing in a field is one undo step per field, `coalesce`). */
	const change = (recipe: (found: Draft<TDataTable>) => void, coalesce?: string) =>
		commit(
			(scene) => {
				const found = scene.data.tables.find((each) => each.key === table.key);
				if (found) {
					recipe(found);
				}
			},
			coalesce ? { coalesce: `table-${coalesce}:${table.key}` } : undefined,
		);
	const [confirmsRemove, setConfirmsRemove] = useState(false);
	const followers = new Map(
		[...followersByRow(entities, table.key)].map(([rowKey, list]) => [
			rowKey,
			list.map((entity) => entity.name || partNameOf(entity.kind) || entity.kind),
		]),
	);
	const following = [...followers.values()].reduce((sum, list) => sum + list.length, 0);
	const keyName =
		table.columns.find((column) => column.key === table.keyColumn)?.name || table.keyColumn;

	return (
		<>
			<header className={styles.pageHead}>
				<PageKind icon="list" kind="Table" />

				<h3 className={styles.pageTitle}>{table.name || table.key}</h3>

				<p className={styles.pageAbout}>
					{`${origin} `}

					{keyName
						? `Each row is named by its ${keyName}, so objects and roads can take one each.`
						: "Its rows have no names yet, so nothing can pick one."}
				</p>
			</header>

			<Section icon="globe" title={isNew ? "Next: show it in the world" : "Show it in the world"}>
				<ShowTableInWorld table={table} />

				<Hint>
					{following > 0
						? `${following === 1 ? "1 object follows" : `${following} objects follow`} its rows now (the last column below).`
						: "Nothing follows its rows yet."}
				</Hint>
			</Section>

			<Section icon="list" title="Rows">
				<DataTableView
					columns={table.columns}
					rows={table.rows}
					keyColumn={table.keyColumn}
					mostRows={MOST_ROWS}
					followers={followers}
				/>
			</Section>

			<Section icon="edit" title="Settings">
				<TextField
					label="Name"
					value={table.name}
					placeholder={table.key}
					onChange={(name) =>
						change((found) => {
							found.name = name;
						}, "name")
					}
					hasNoDefault
				/>

				<SelectField
					label="Rows named by"
					value={table.keyColumn}
					options={[
						{ value: "", label: "Their order" },
						...table.columns.map((column) => ({
							value: column.key,
							label: column.name || column.key,
						})),
					]}
					onChange={(keyColumn) =>
						change((found) => {
							found.keyColumn = keyColumn;
						})
					}
					hasNoDefault
					hint={
						following > 0
							? `Objects take a row by its name: ${following === 1 ? "the one following it" : `the ${following} following it`} lose their rows when this changes; give them theirs again with Show it in the world.`
							: "A name or an id, different in every row: what objects and roads take a row by."
					}
				/>

				<FieldGroup title="Column names">
					{table.columns.map((column) => (
						<TextField
							key={column.key}
							label={column.field || column.key}
							value={column.name}
							placeholder={column.key}
							onChange={(name) =>
								change((found) => {
									const each = found.columns.find((one) => one.key === column.key);
									if (each) {
										each.name = name;
									}
								}, `column:${column.key}`)
							}
							hasNoDefault
						/>
					))}
				</FieldGroup>

				{source && (source.kind === "file" || source.url) && (
					<ButtonGroup>
						<Button
							size="sm"
							icon={source.kind === "file" ? "upload" : "edit"}
							onClick={() => onConfigure(source)}
						>
							{source.kind === "file" ? "Read the file again…" : "Configure table…"}
						</Button>
					</ButtonGroup>
				)}

				{source && (source.kind === "file" || source.url) && (
					<Hint>
						{source.kind === "file"
							? "Picks the file again, to choose how it's read: which columns, and what names the rows."
							: "Reads its source again to choose which columns it keeps and how many rows, and what else to keep from it."}
					</Hint>
				)}
			</Section>

			<div className={styles.pageFoot}>
				<Button size="sm" icon="trash" variant="danger" onClick={() => setConfirmsRemove(true)}>
					Remove table…
				</Button>
			</div>

			<ConfirmDialog
				open={confirmsRemove}
				onOpenChange={setConfirmsRemove}
				title={`Remove ${table.name || table.key}?`}
				description="Objects and roads that follow its rows keep their settings but show nothing until it's back (Undo brings it back)."
				confirmLabel="Remove table"
				danger
				onConfirm={() => removeDataTable(table.key)}
			/>
		</>
	);
};
