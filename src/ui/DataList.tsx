import { type IDataGroup, isSnapshot } from "#/editor/dataList";
import { refreshSource } from "#/editor/sourceRefresh";
import type { TDataWindowAt } from "#/editor/store";
import { formatEntry } from "#/scene/format";
import type { TDataSource } from "#/scene/schema";

import { Button, IconButton } from "./Button";
import { Hint, Section } from "./fields";
import { Icon, type TIconName } from "./Icon";
import { List, ListItem } from "./List";
import { Sparkline } from "./Sparkline";
import { Tooltip } from "./Tooltip";
import { type TSourceTone, useSourceStatuses } from "./useSourceStatuses";

import styles from "./DataList.module.css";

/** A source's icon, by how it's read. */
const sourceIconOf = (source: TDataSource): TIconName =>
	source.kind === "file" ? "file" : isSnapshot(source) ? "clock" : "globe";

/** The mark before a status, so it isn't told by colour alone (ADR-0089). */
const TONE_ICONS: Partial<Record<TSourceTone, TIconName>> = {
	waiting: "lock",
	failed: "alert",
	reading: "clock",
	read: "check",
};

const isAt = (at: TDataWindowAt | null, kind: "value" | "table", key: string) =>
	at?.kind === kind && at.key === key;

interface IDataListProps {
	groups: readonly IDataGroup[];
	/** What's open in the Data window, marked in the list. */
	at: TDataWindowAt | null;
	onOpen: (at: TDataWindowAt) => void;
}

/**
 * The world's data as one list (ADR-0123): a card for each source (its name
 * in the header band with Allow and Source details, how it's doing, and the
 * values and tables it gave), then one for what was typed by hand. Only the rows open things: a value
 * or a table in the Data window. Shared by the Data tab and the window.
 */
export const DataList = ({ groups, at, onOpen }: IDataListProps) => {
	const { statusOf, waitingIds } = useSourceStatuses();

	return (
		<>
			{groups.map((group) => {
				const { source } = group;
				const status = source ? statusOf(source) : null;
				const toneIcon = status ? TONE_ICONS[status.tone] : undefined;
				const isEmpty = group.values.length + group.tables.length === 0;
				return (
					<Section
						key={group.id}
						title={group.title}
						icon={source ? sourceIconOf(source) : group.id === "gone" ? "alert" : "edit"}
						isRegion
						actions={
							source && (
								<IconButton
									icon="info"
									label="Source details"
									size="sm"
									onClick={() => onOpen({ kind: "source", id: source.id })}
								/>
							)
						}
					>
						{status && (
							<p className={styles.status} data-tone={status.tone}>
								{toneIcon && <Icon name={toneIcon} size={12} />}

								{status.detail ? (
									<Tooltip label={status.detail}>
										<span className={styles.detail}>{status.text}</span>
									</Tooltip>
								) : (
									<span>{status.text}</span>
								)}

								{/* Allow beside what it answers, not in the header: long names keep their room. */}
								{source && waitingIds.has(source.id) && (
									<span className={styles.allow}>
										<Button
											size="sm"
											icon="check"
											onClick={() => void refreshSource(source, { asked: true })}
										>
											Allow
										</Button>
									</span>
								)}
							</p>
						)}

						{!isEmpty && (
							<List>
								{group.values.map((value) => (
									<ListItem
										key={`value:${value.key}`}
										label={value.name || value.key}
										meta={
											<span className={styles.meta}>
												<Sparkline
													points={value.history}
													label={`${value.name || value.key} over time`}
												/>

												<span className={styles.value}>{formatEntry(value)}</span>

												<Icon name="chevronRight" size={12} />
											</span>
										}
										current={isAt(at, "value", value.key)}
										onClick={() => onOpen({ kind: "value", key: value.key })}
									/>
								))}

								{group.tables.map((table) => (
									<ListItem
										key={`table:${table.key}`}
										label={table.name || table.key}
										meta={
											<span className={styles.meta}>
												<span className={styles.tag}>table</span>

												<span>
													{table.rows.length === 1
														? "1 row"
														: `${table.rows.length.toLocaleString()} rows`}
												</span>

												<Icon name="chevronRight" size={12} />
											</span>
										}
										current={isAt(at, "table", table.key)}
										onClick={() => onOpen({ kind: "table", key: table.key })}
									/>
								))}
							</List>
						)}

						{isEmpty && source && (
							<Hint>
								{waitingIds.has(source.id)
									? "What it gives shows here once it's allowed and read."
									: "It gives nothing yet."}
							</Hint>
						)}
					</Section>
				);
			})}
		</>
	);
};
