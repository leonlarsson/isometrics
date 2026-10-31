import { formatValue } from "#/scene/format";
import { cellOf, rowKeyOf } from "#/scene/rowData";
import type { TDataTable } from "#/scene/schema";

import styles from "./DataTableView.module.css";

interface IDataTableViewProps {
	columns: TDataTable["columns"];
	rows: TDataTable["rows"];
	/** The column that names each row, marked in its header; "" for none. */
	keyColumn: string;
	/** The most rows shown; the rest are counted below. */
	mostRows: number;
	/** What follows each row, by row key (ADR-0108): shown in an On the map column. */
	followers?: ReadonlyMap<string, readonly string[]>;
}

/** A data table's rows as a grid, numbers right-aligned with their units (data study). */
export const DataTableView = ({
	columns,
	rows,
	keyColumn,
	mostRows,
	followers,
}: IDataTableViewProps) => {
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

						{followers && <th scope="col">On the map</th>}
					</tr>
				</thead>

				<tbody>
					{shown.map((row, index) => (
						<tr key={String(cellOf(row, keyColumn) ?? index)}>
							{columns.map((column) => {
								const cell = cellOf(row, column.key) ?? null;
								return (
									<td
										key={column.key}
										className={typeof cell === "number" ? styles.number : undefined}
									>
										{cell === null ? (
											<span className={styles.empty}>no data</span>
										) : (
											formatValue(cell, column.unit)
										)}
									</td>
								);
							})}

							{followers && (
								<td>{followers.get(rowKeyOf({ keyColumn }, row, index))?.join(", ") || "—"}</td>
							)}
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
