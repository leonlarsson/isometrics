import { useState } from "react";

import { followersByRow } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { partNameOf } from "#/parts/registry";
import type { TDataTable } from "#/scene/schema";

import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTableView } from "./DataTableView";
import { Hint, Section } from "./fields";
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
}: {
	table: TDataTable;
	/** Where its rows come from, in a sentence (`tableInWords`). */
	origin: string;
	/** Just added: Show it in the world comes first, said as the next step. */
	isNew: boolean;
}) => {
	const entities = useEditor((s) => s.scene.entities);
	const removeDataTable = useEditor((s) => s.removeDataTable);
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
