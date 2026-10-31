import {
	ROAD_DATA_SETTINGS,
	roadAsDrawn,
	type TRoadDataSetting,
	valuesOfRoad,
} from "#/editor/roadFlows";
import { selectSelectedEntity, useEditor } from "#/editor/store";
import { useViewShowsData } from "#/editor/viewData";
import { useWorldData } from "#/editor/worldData";
import { valuesOfEntity } from "#/parts/propData";
import { partNameOf } from "#/parts/registry";
import { formatValue } from "#/scene/format";
import { columnOfKey, tableOfRow } from "#/scene/rowData";
import type { TDataSource, TDataValue, TWorldData } from "#/scene/schema";

import { ButtonGroup, IconButton } from "./Button";
import { CameraFollowButtons } from "./CameraFollowBar";
import { DataReading } from "./DataReading";
import { FollowsDataField } from "./FollowsDataField";
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
					{"Source: "}

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

/** How a road setting from data shows now, for the road's sheet. */
const ROAD_SETTING_WORDS: Record<TRoadDataSetting, (value: number) => string> = {
	width: (value) => `${formatValue(value)} wide`,
	vehicleDensity: (value) => `${formatValue(value)} vehicles per 10 units`,
	vehicleCountAlong: (value) => `${formatValue(value)} vehicles along it`,
	vehicleCountAgainst: (value) => `${formatValue(value)} vehicles the other way`,
};

/**
 * The bottom sheet for a road opened in View mode (ADR-0112): its flow in data terms, the row it
 * follows as tiles, which way it goes, and how its amount sets its width and how busy it is.
 */
export const RoadDetailSheet = () => {
	const mode = useEditor((s) => s.mode);
	const stored = useEditor((s) => s.scene.roads.find((road) => road.id === s.selectedRoadId));
	const worldData = useWorldData();
	const selectRoad = useEditor((s) => s.selectRoad);
	const shown = useEditor((s) => s.scene.onScreen.showsDetails);
	const showsData = useViewShowsData((s) => s.showsData);

	if (mode !== "view" || !stored || !shown || showsData) {
		return null;
	}

	const values = valuesOfRoad(stored, worldData);
	const road = roadAsDrawn(stored, values);
	const table = tableOfRow(worldData, road.dataRow);
	const source = table?.source
		? worldData.sources.find((each) => each.id === table.source?.sourceId)
		: undefined;
	const row = values.filter((entry) => columnOfKey(entry.key) !== null);
	const tiles = row.filter((entry) => typeof entry.value === "number");
	const facts = row.filter(
		(entry) => typeof entry.value !== "number" && entry.key !== `row.${table?.keyColumn}`,
	);
	const { vehicleCountAlong: along, vehicleCountAgainst: against } = road.flow;
	const title = road.name || "Road";
	const way = !road.flow.isOn
		? null
		: along > 0 && against > 0
			? "Vehicles drive both ways: the amount has no direction."
			: along > 0
				? "Vehicles drive one way, along it, down the middle; the arrows on it point the way."
				: "Vehicles drive one way, against its points, down the middle; the arrows on it point the way.";

	return (
		<aside className={styles.sheet} data-label-obstacle="" aria-label={`${title} details`}>
			<header className={styles.header}>
				<div>
					<h2 className={styles.title}>{title}</h2>

					{source && <p className={styles.description}>{sourceLine(source)}</p>}
				</div>

				<IconButton icon="close" label="Close details" size="md" onClick={() => selectRoad(null)} />
			</header>

			{(tiles.length > 0 || facts.length > 0) && (
				<div className={styles.tiles}>
					{tiles.map((entry) => (
						<div key={entry.key} className={styles.tile}>
							<DataReading entry={entry} label={entry.name} size="huge" />

							{entry.about && <span className={styles.about}>{entry.about}</span>}
						</div>
					))}

					{facts.map((entry) => (
						<div key={entry.key} className={styles.tile}>
							<DataReading entry={entry} label={entry.name} />
						</div>
					))}
				</div>
			)}

			<div className={styles.explains}>
				{(Object.keys(road.data) as TRoadDataSetting[])
					.filter((setting) => setting in ROAD_DATA_SETTINGS)
					.map((setting) => {
						const words = ROAD_SETTING_WORDS[setting];
						const value =
							setting === "width"
								? road.width
								: setting === "vehicleDensity"
									? (road.flow.vehicleDensity ?? 0)
									: road.flow[setting];
						return (
							<FollowsDataField
								key={setting}
								label={ROAD_DATA_SETTINGS[setting].label}
								binding={road.data[setting]}
								data={values}
								range={ROAD_DATA_SETTINGS[setting]}
								shownNow={words(value)}
								showSetting={(each) => formatValue(Math.round(each * 10) / 10)}
							/>
						);
					})}
			</div>

			{way && <p className={styles.note}>{way}</p>}

			{source && (
				<p className={styles.source}>
					{"Source: "}

					{source.pageUrl ? (
						<a href={source.pageUrl} target="_blank" rel="noreferrer">
							{source.name || source.pageUrl}
						</a>
					) : (
						source.name || "this world's data"
					)}
				</p>
			)}
		</aside>
	);
};
