import { formatValue } from "#/scene/format";
import type { TDataTable } from "#/scene/schema";

import styles from "./DataTableView.module.css";

interface IDataTableViewProps {
	columns: TDataTable["columns"];
	rows: TDataTable["rows"];
	/** The column that names each row, marked in its header; "" for none. */
	keyColumn: string;
	/** The most rows shown; the rest are counted below. */
	mostRows: number;
}

/** A data table's rows as a grid, numbers right-aligned with their units (data study). */
export const DataTableView = ({ columns, rows, keyColumn, mostRows }: IDataTableViewProps) => {
	const shown = rows.slice(0, mostRows);
	return (
		<div className={styles.frame}>
			<table className={styles.table}>
				<thead>
					<tr>
						{columns.map((column) => (
							<th key={column.key} scope="col">
								{column.name || column.key}

								{column.key === keyColumn && <span className={styles.tag}>names rows</span>}
							</th>
						))}
					</tr>
				</thead>

				<tbody>
					{shown.map((row, index) => (
						<tr key={String(row[keyColumn] ?? index)}>
							{columns.map((column) => {
								const cell = row[column.key] ?? null;
								return (
									<td
										key={column.key}
										className={typeof cell === "number" ? styles.number : undefined}
									>
										{cell === null ? "" : formatValue(cell, column.unit)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>

			{rows.length > shown.length && (
				<p className={styles.more}>and {(rows.length - shown.length).toLocaleString()} more rows</p>
			)}
		</div>
	);
};
