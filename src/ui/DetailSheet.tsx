import { selectSelectedEntity, useEditor } from "#/editor/store";
import { useViewShowsData } from "#/editor/viewData";
import { useWorldData } from "#/editor/worldData";
import { valuesOfEntity } from "#/parts/propData";
import { partNameOf } from "#/parts/registry";
import { columnOfKey, tableOfRow } from "#/scene/rowData";
import type { TDataSource, TDataValue, TWorldData } from "#/scene/schema";

import { ButtonGroup, IconButton } from "./Button";
import { CameraFollowButtons } from "./CameraFollowBar";
import { DataReading } from "./DataReading";
import { formatWhen } from "./Sparkline";

import styles from "./DetailSheet.module.css";

/** The source a value is read from, if the world still has it. */
const sourceOf = (data: TWorldData, entry: TDataValue | undefined) =>
	entry?.source ? data.sources.find((source) => source.id === entry.source?.sourceId) : undefined;

/** Where data comes from and when it was read, in one line: "Steam only, last 30 days, read 20 Oct 2026". */
export const sourceLine = (source: TDataSource) =>
	[
		source.about || source.name,
		source.lastReadAt ? `read ${formatWhen(source.lastReadAt.slice(0, 10))}` : "",
	]
		.filter(Boolean)
		.join(", ");

/**
 * The bottom sheet for the thing opened in View mode (ADR-0063, ADR-0110): its
 * title and tag, where its data comes from and when it was read, a tile per
 * value (its past, change and flag; "no data" greyed where it has none, with a
 * note where the value's own differs), its description, and its source as a link.
 */
export const DetailSheet = () => {
	const mode = useEditor((s) => s.mode);
	const entity = useEditor(selectSelectedEntity);
	const worldData = useWorldData();
	const select = useEditor((s) => s.select);
	const shown = useEditor((s) => s.scene.onScreen.showsDetails);
	// The data shown as tables takes the place of the map and what's on it (ADR-0110).
	const showsData = useViewShowsData((s) => s.showsData);

	if (mode !== "view" || !entity || !shown || showsData) {
		return null;
	}

	const data = valuesOfEntity(entity, worldData);
	const keys = entity.details.dataKeys.length ? entity.details.dataKeys : entity.label.dataKeys;
	const title = entity.name || entity.label.title || partNameOf(entity.kind) || "Object";
	const entries = keys.map((key) => ({ key, entry: data.find((d) => d.key === key) }));
	// Its main source: its row's table's, else its first value's.
	const table = tableOfRow(worldData, entity.dataRow);
	const main =
		(table?.source
			? worldData.sources.find((source) => source.id === table.source?.sourceId)
			: undefined) ?? entries.map(({ entry }) => sourceOf(worldData, entry)).find(Boolean);
	const link = main?.pageUrl ?? (main?.kind === "link" ? main.url : null);

	return (
		<aside className={styles.sheet} data-label-obstacle="" aria-label={`${title} details`}>
			<header className={styles.header}>
				<div>
					<h2 className={styles.title}>
						{title}

						{entity.label.tag && <span className={styles.tag}>{entity.label.tag}</span>}
					</h2>

					{main && <p className={styles.description}>{sourceLine(main)}</p>}
				</div>

				<IconButton icon="close" label="Close details" size="md" onClick={() => select(null)} />
			</header>

			{entity.follow && (
				<ButtonGroup>
					<CameraFollowButtons entityId={entity.id} />
				</ButtonGroup>
			)}

			{entries.length > 0 && (
				<div className={styles.tiles}>
					{entries.map(({ key, entry }) => (
						<div key={key} className={styles.tile}>
							<DataReading entry={entry} label={columnOfKey(key) ?? key} size="huge" />

							{entry?.about && <span className={styles.about}>{entry.about}</span>}
						</div>
					))}
				</div>
			)}

			{entity.details.description && <p className={styles.note}>{entity.details.description}</p>}

			{main && (
				<p className={styles.source}>
					Source:{" "}
					{link ? (
						<a href={link} target="_blank" rel="noreferrer">
							{main.name || link}
						</a>
					) : (
						main.name || "this world's data"
					)}
				</p>
			)}
		</aside>
	);
};
