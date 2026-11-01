import { useState } from "react";

import {
	dataFoundIn,
	hasNoAddress,
	sourceKindOf,
	sourceNameOf,
	type TDataKind,
} from "#/editor/dataList";
import { refreshSource } from "#/editor/sourceRefresh";
import { type TDataWindowAt, useEditor } from "#/editor/store";
import { formatEntry } from "#/scene/format";
import type { TDataSource, TDataTable, TDataValue } from "#/scene/schema";

import { Button } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { Hint, Section } from "./fields";
import { Icon, type TIconName } from "./Icon";
import { List, ListItem } from "./List";
import { Sparkline } from "./Sparkline";
import { Tooltip } from "./Tooltip";
import { type TSourceTone, useSourceStatuses } from "./useSourceStatuses";

import styles from "./DataList.module.css";

/** A source's icon, by how it's read; its tooltip says so in words. */
const sourceIconOf = (source: TDataSource): TIconName =>
	source.kind === "file" ? "file" : hasNoAddress(source) ? "alert" : "globe";

/** The mark before a status, so it isn't told by colour alone (ADR-0089). */
const TONE_ICONS: Partial<Record<TSourceTone, TIconName>> = {
	waiting: "lock",
	failed: "alert",
	reading: "clock",
	read: "check",
};

const isAt = (at: TDataWindowAt | null, kind: "value" | "table", key: string) =>
	at?.kind === kind && at.key === key;

/** "19 rows", "1 row". */
const rowsOf = (table: TDataTable) =>
	table.rows.length === 1 ? "1 row" : `${table.rows.length.toLocaleString()} rows`;

interface IDataListProps {
	/** What the search above the list holds. */
	query: string;
	/** What's open in the Data window, marked in the list. */
	at: TDataWindowAt | null;
	onOpen: (at: TDataWindowAt) => void;
}

/**
 * The world's data by kind (ADR-0123): chips to show all of it or only its
 * values, tables or sources, then a card for each kind. A value's or a table's
 * row says where it comes from (and whether that waits for a yes); a source's
 * row says what kind it is and how it's doing, with Allow while it waits.
 * Every row opens its page in the Data window. Shared by the Data tab and the
 * window.
 */
export const DataList = ({ query, at, onOpen }: IDataListProps) => {
	const data = useEditor((s) => s.scene.data);
	const { statusOf, waitingIds } = useSourceStatuses();
	const [kind, setKind] = useState<TDataKind>("all");
	const found = dataFoundIn(data, query);
	const sourceOf = (item: TDataValue | TDataTable) =>
		item.source ? data.sources.find((source) => source.id === item.source?.sourceId) : undefined;

	/** Where a value or table comes from, under its name: its source, and whether that waits. */
	const originOf = (item: TDataValue | TDataTable) => {
		const source = sourceOf(item);
		if (!item.source) {
			return "typed by hand";
		}
		if (!source) {
			return "from a source that's gone";
		}
		return (
			<span className={styles.origin}>
				{waitingIds.has(source.id) && <Icon name="lock" size={11} />}

				<span className={styles.originName}>{sourceNameOf(source)}</span>

				{waitingIds.has(source.id) && (
					<span className={styles.originTail}>· waiting for your yes</span>
				)}
			</span>
		);
	};

	const shows = (each: Exclude<TDataKind, "all">) => kind === "all" || kind === each;
	const nothing = (what: string) => (
		<Hint>{query.trim() ? `No ${what} match “${query.trim()}”.` : `No ${what} yet.`}</Hint>
	);

	return (
		<>
			<div className={styles.kinds}>
				<ChipGroup
					label="Show"
					size="sm"
					value={kind}
					onChange={setKind}
					chips={[
						{ value: "all", label: "All" },
						{ value: "values", label: "Values", count: found.values.length },
						{ value: "tables", label: "Tables", count: found.tables.length },
						{ value: "sources", label: "Sources", count: found.sources.length },
					]}
				/>
			</div>

			{shows("values") && (kind !== "all" || found.values.length > 0) && (
				<Section icon="chart" title="Values" isRegion>
					{found.values.length > 0 ? (
						<List>
							{found.values.map((value) => (
								<ListItem
									key={value.key}
									label={
										<span className={styles.line}>
											<span className={styles.name}>{value.name || value.key}</span>

											<Sparkline
												points={value.history}
												label={`${value.name || value.key} over time`}
											/>

											<span className={styles.value}>{formatEntry(value)}</span>
										</span>
									}
									meta={originOf(value)}
									stacked
									current={isAt(at, "value", value.key)}
									onClick={() => onOpen({ kind: "value", key: value.key })}
								/>
							))}
						</List>
					) : (
						nothing("values")
					)}
				</Section>
			)}

			{shows("tables") && (kind !== "all" || found.tables.length > 0) && (
				<Section icon="list" title="Tables" isRegion>
					{found.tables.length > 0 ? (
						<List>
							{found.tables.map((table) => (
								<ListItem
									key={table.key}
									label={
										<span className={styles.line}>
											<span className={styles.name}>{table.name || table.key}</span>

											<span className={styles.rows}>{rowsOf(table)}</span>
										</span>
									}
									meta={originOf(table)}
									stacked
									current={isAt(at, "table", table.key)}
									onClick={() => onOpen({ kind: "table", key: table.key })}
								/>
							))}
						</List>
					) : (
						nothing("tables")
					)}
				</Section>
			)}

			{shows("sources") && (kind !== "all" || found.sources.length > 0) && (
				<Section icon="download" title="Sources" isRegion>
					{found.sources.length > 0 ? (
						<List>
							{found.sources.map((source) => {
								const status = statusOf(source);
								const toneIcon = TONE_ICONS[status.tone];
								return (
									<ListItem
										key={source.id}
										label={
											<span className={styles.line}>
												<Tooltip label={sourceKindOf(source)}>
													<span className={styles.kindIcon}>
														<Icon name={sourceIconOf(source)} size={13} />
													</span>
												</Tooltip>

												<span className={styles.name}>{sourceNameOf(source)}</span>
											</span>
										}
										meta={
											<span className={styles.status} data-tone={status.tone}>
												{toneIcon && <Icon name={toneIcon} size={11} />}

												{status.detail ? (
													<Tooltip label={status.detail}>
														<span className={styles.detail}>{status.text}</span>
													</Tooltip>
												) : (
													<span>{status.text}</span>
												)}
											</span>
										}
										stacked
										current={at?.kind === "source" && at.id === source.id}
										onClick={() => onOpen({ kind: "source", id: source.id })}
										actions={
											waitingIds.has(source.id) && (
												<span className={styles.allow}>
													<Button
														size="sm"
														icon="check"
														onClick={() => void refreshSource(source, { asked: true })}
													>
														Allow
													</Button>
												</span>
											)
										}
									/>
								);
							})}
						</List>
					) : (
						nothing("sources")
					)}
				</Section>
			)}

			{kind === "all" && found.values.length + found.tables.length + found.sources.length === 0 && (
				<p className={styles.none}>{`Nothing matches “${query.trim()}”.`}</p>
			)}
		</>
	);
};
