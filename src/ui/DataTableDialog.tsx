import type { TDataTable } from "#/scene/schema";

import { DataTableView } from "./DataTableView";
import { Dialog } from "./Dialog";

/** The most rows the table viewer draws; a world's tables can hold thousands. */
const MOST_ROWS = 500;

/** A data table to look at: all its columns, its first rows (data study). */
export const DataTableDialog = ({
	table,
	origin,
	onClose,
}: {
	table: TDataTable;
	/** Where it comes from, in words. */
	origin: string;
	onClose: () => void;
}) => (
	<Dialog
		open
		onOpenChange={(open) => !open && onClose()}
		title={table.name || table.key}
		description={`${table.rows.length.toLocaleString()} rows × ${table.columns.length} columns · ${origin}`}
		closeLabel="Close"
		wide
		initialFocus="dialog"
	>
		<DataTableView
			columns={table.columns}
			rows={table.rows}
			keyColumn={table.keyColumn}
			mostRows={MOST_ROWS}
		/>
	</Dialog>
);
