import { type IDataGroup, isSnapshot } from "#/editor/dataList";
import { refreshSource } from "#/editor/sourceRefresh";
import type { TDataWindowAt } from "#/editor/store";
import { formatEntry } from "#/scene/format";
import type { TDataSource } from "#/scene/schema";

import { Button, IconButton } from "./Button";
import { Hint } from "./fields";
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
 * The world's data as one list (ADR-0123): a heading for each source (its
 * name, how it's doing, and Source details), the values and tables it gave
 * under it, then what was typed by hand. Only the rows open things: a value
 * or a table in the Data window. Shared by the Data tab and the window.
 */
export const DataList = ({ groups, at, onOpen }: IDataListProps) => {
	const { statusOf, waitingIds } = useSourceStatuses();

	return (
		<div className={styles.list}>
			{groups.map((group) => {
				const { source } = group;
				const status = source ? statusOf(source) : null;
				const toneIcon = status ? TONE_ICONS[status.tone] : undefined;
				const isEmpty = group.values.length + group.tables.length === 0;
				return (
					<section key={group.id} className={styles.group} aria-label={group.title}>
						<header className={styles.head}>
							<span className={styles.headIcon}>
								<Icon
									name={source ? sourceIconOf(source) : group.id === "gone" ? "alert" : "edit"}
									size={14}
								/>
							</span>

							<h4 className={styles.title}>{group.title}</h4>

							{source && waitingIds.has(source.id) && (
								<Button
									size="sm"
									icon="check"
									onClick={() => void refreshSource(source, { asked: true })}
								>
									Allow
								</Button>
							)}

							{source && (
								<IconButton
									icon="info"
									label="Source details"
									onClick={() => onOpen({ kind: "source", id: source.id })}
								/>
							)}
						</header>

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

												<span>{`${table.rows.length.toLocaleString()} rows`}</span>

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
					</section>
				);
			})}
		</div>
	);
};
