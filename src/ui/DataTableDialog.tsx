import { useState } from "react";

import { followersByRow } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { partNameOf } from "#/parts/registry";
import type { TDataTable } from "#/scene/schema";

import { Button, ButtonGroup } from "./Button";
import { DataTableView } from "./DataTableView";
import { Dialog } from "./Dialog";
import { PlaceRowsDialog } from "./PlaceRowsDialog";

/** The most rows the table viewer draws; a world's tables can hold thousands. */
const MOST_ROWS = 500;

/**
 * A data table to look at: all its columns, its first rows, and what follows
 * each row on the map (data study, ADR-0108), with a way to place one for each.
 */
export const DataTableDialog = ({
	table,
	origin,
	onClose,
}: {
	table: TDataTable;
	/** Where it comes from, in words. */
	origin: string;
	onClose: () => void;
}) => {
	const entities = useEditor((s) => s.scene.entities);
	const [placing, setPlacing] = useState(false);
	const followers = new Map(
		[...followersByRow(entities, table.key)].map(([rowKey, list]) => [
			rowKey,
			list.map((entity) => entity.name || partNameOf(entity.kind) || entity.kind),
		]),
	);

	if (placing) {
		return (
			<PlaceRowsDialog
				table={table}
				onClose={() => {
					setPlacing(false);
				}}
			/>
		);
	}
	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onClose()}
			title={table.name || table.key}
			description={`${table.rows.length.toLocaleString()} rows × ${table.columns.length} columns · ${origin}`}
			closeLabel="Close"
			wide
			initialFocus="dialog"
		>
			<ButtonGroup>
				<Button size="sm" icon="building" onClick={() => setPlacing(true)}>
					Place one for each row…
				</Button>
			</ButtonGroup>

			<DataTableView
				columns={table.columns}
				rows={table.rows}
				keyColumn={table.keyColumn}
				mostRows={MOST_ROWS}
				followers={followers}
			/>
		</Dialog>
	);
};
