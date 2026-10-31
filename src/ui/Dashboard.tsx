import { useHotkey } from "@tanstack/react-hotkeys";

import { followersByRow } from "#/editor/dataRows";
import { useEditor } from "#/editor/store";
import { setViewShowsData, useViewShowsData } from "#/editor/viewData";
import { useWorldData } from "#/editor/worldData";
import { partNameOf } from "#/parts/registry";
import { formatEntry } from "#/scene/format";
import { flagOf } from "#/scene/trends";

import { IconButton } from "./Button";
import { ChipGroup } from "./ChipGroup";
import { DataReading, TrendWords } from "./DataReading";
import { DataTableView } from "./DataTableView";
import { sourceLine } from "./DetailSheet";

import styles from "./Dashboard.module.css";

/**
 * The dashboard half of a world (ADR-0110): chips saying what each encoding
 * means, the Map / Data switch with the data as tables, and tiles for the
 * world's main values along the bottom edge.
 */

/** The legend's chips: "Size 30-day average Steam players, log scale". */
export const LegendChips = () => {
	const legend = useEditor((s) => s.scene.onScreen.legend);
	if (legend.length === 0) {
		return null;
	}
	return (
		<ul className={styles.legend} aria-label="Legend">
			{legend.map((entry) => (
				<li key={`${entry.label}:${entry.meaning}`} className={styles.chip}>
					<strong>{entry.label}</strong> {entry.meaning}
				</li>
			))}
		</ul>
	);
};

/** Whether the world has data to show as tables. */
const useHasData = () =>
	useEditor((s) => s.scene.data.values.length > 0 || s.scene.data.tables.length > 0);

/** The Map / Data switch, in View mode, for a world with data. */
export const MapDataSwitch = () => {
	const showsData = useViewShowsData((s) => s.showsData);
	const shown = useEditor((s) => s.mode === "view" && s.scene.onScreen.showsDataSwitch);
	const hasData = useHasData();
	if (!shown || !hasData) {
		return null;
	}
	return (
		<div className={styles.switch}>
			<ChipGroup
				label="Show the map or the data"
				value={showsData ? "data" : "map"}
				onChange={(value) => setViewShowsData(value === "data")}
				chips={[
					{ value: "map", label: "Map" },
					{ value: "data", label: "Data" },
				]}
				size="sm"
			/>
		</div>
	);
};

/**
 * The world's data as tables (Data in the switch): each table with what
 * follows its rows on the map, then its values with their change and flag.
 * Also the accessible way to read the world.
 */
export const WorldDataView = () => {
	const showsData = useViewShowsData((s) => s.showsData);
	const inView = useEditor((s) => s.mode === "view");
	const data = useWorldData();
	const entities = useEditor((s) => s.scene.entities);
	const roads = useEditor((s) => s.scene.roads);
	const open = showsData && inView;
	useHotkey("Escape", () => setViewShowsData(false), {
		enabled: open,
		meta: { name: "Back to the map" },
	});
	if (!open) {
		return null;
	}
	const sourceName = (sourceId: string | undefined) => {
		const source = data.sources.find((each) => each.id === sourceId);
		return source ? sourceLine(source) : "typed by hand";
	};
	return (
		<section className={styles.dataView} aria-label="The world's data" data-label-obstacle="">
			<header className={styles.dataHeader}>
				<h2>The data</h2>

				<IconButton icon="close" label="Back to the map" onClick={() => setViewShowsData(false)} />
			</header>

			{data.tables.map((table) => {
				const followers = new Map<string, string[]>();
				for (const [rowKey, list] of followersByRow(entities, table.key)) {
					followers.set(
						rowKey,
						list.map((each) => each.name || partNameOf(each.kind) || each.kind),
					);
				}
				for (const road of roads) {
					if (road.dataRow?.tableKey === table.key) {
						const list = followers.get(road.dataRow.rowKey) ?? [];
						followers.set(road.dataRow.rowKey, [...list, road.name || "Road"]);
					}
				}
				return (
					<div key={table.key} className={styles.block}>
						<h3>{table.name || table.key}</h3>

						<p className={styles.meta}>{sourceName(table.source?.sourceId)}</p>

						<DataTableView
							columns={table.columns}
							rows={table.rows}
							keyColumn={table.keyColumn}
							mostRows={200}
							followers={followers}
						/>
					</div>
				);
			})}

			{data.values.length > 0 && (
				<div className={styles.block}>
					<h3>Values</h3>

					<table className={styles.values}>
						<thead>
							<tr>
								<th scope="col">Value</th>

								<th scope="col">Now</th>

								<th scope="col">Change</th>

								<th scope="col">Where from</th>
							</tr>
						</thead>

						<tbody>
							{data.values.map((entry) => (
								<tr key={entry.key}>
									<th scope="row">{entry.name || entry.key}</th>

									<td className={styles.number}>
										{formatEntry(entry)}

										{flagOf(entry) && ` ⚠ ${flagOf(entry)}`}
									</td>

									<td>
										<TrendWords entry={entry} />
									</td>

									<td>{entry.about || sourceName(entry.source?.sourceId)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
};

/** Tiles for the world's main values along the bottom edge, in View mode. */
export const ValueTiles = () => {
	const keys = useEditor((s) => s.scene.onScreen.tileKeys);
	const inView = useEditor((s) => s.mode === "view");
	const values = useWorldData().values;
	if (!inView || keys.length === 0) {
		return null;
	}
	return (
		<ul className={styles.tiles} aria-label="Main values" data-label-obstacle="">
			{keys.map((key) => {
				const entry = values.find((each) => each.key === key);
				return (
					<li key={key} className={styles.tile}>
						<DataReading entry={entry} label={key} />
					</li>
				);
			})}
		</ul>
	);
};
