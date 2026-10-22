import { useHotkey } from "@tanstack/react-hotkeys";
import { useEffect, useRef, useState } from "react";

import type { ISceneItem } from "#/editor/framing";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { getPart, partsByCategory, resolveColors } from "#/parts/registry";
import { CATEGORY_LABELS } from "#/parts/types";
import { AREA_TYPE_LABELS } from "#/scene/areas";
import { formatEntry } from "#/scene/format";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TScene } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { IconButton, IconButtonGroup } from "./Button";
import { GroupLabel, Hint, Kbd, SearchField, SwitchField } from "./fields";
import { List, ListItem } from "./List";
import { areaSwatch, roadSwatch } from "./swatches";

import styles from "./Outliner.module.css";

interface IOutlinerRow {
	item: ISceneItem;
	group: string;
	/** Its own name, possibly empty. */
	name: string;
	/** What it's called without a name: the part, road style or area type. */
	fallback: string;
	swatch: string;
	hidden: boolean;
	locked: boolean;
	/** The first data value it shows, formatted, if any. */
	value: string | null;
}

const ROADS = "Roads";
const AREAS = "Areas";
const OTHER = "Other";

const keyOf = (item: ISceneItem) => `${item.kind}:${item.id}`;

/** Every object, road and area as a row, objects grouped by part category. */
const rowsOf = (scene: TScene, palette: IScenePalette): IOutlinerRow[] => {
	const firstValue = (keys: string[]) => {
		const key = keys[0];
		return key ? formatEntry(scene.data.find((entry) => entry.key === key)) : null;
	};
	return [
		...scene.entities.map((entity): IOutlinerRow => {
			const part = getPart(entity.kind);
			const { color, accent } = part
				? resolveColors(part, entity, palette)
				: { color: palette.selection, accent: palette.selection };
			return {
				item: { kind: "entity", id: entity.id },
				group: part ? CATEGORY_LABELS[part.category] : OTHER,
				name: entity.name,
				fallback: part?.name ?? entity.kind,
				swatch: `linear-gradient(135deg, ${color} 55%, ${accent} 55%)`,
				hidden: entity.hidden,
				locked: entity.locked,
				value: firstValue(entity.label?.dataKeys ?? entity.details.dataKeys),
			};
		}),
		...scene.roads.map(
			(road): IOutlinerRow => ({
				item: { kind: "road", id: road.id },
				group: ROADS,
				name: road.name,
				fallback: ROAD_STYLE_LABELS[road.style],
				swatch: roadSwatch(road, palette),
				hidden: road.hidden,
				locked: road.locked,
				value: null,
			}),
		),
		...scene.areas.map(
			(area): IOutlinerRow => ({
				item: { kind: "area", id: area.id },
				group: AREAS,
				name: area.name,
				fallback: AREA_TYPE_LABELS[area.type],
				swatch: areaSwatch(area, palette),
				hidden: area.hidden,
				locked: area.locked,
				value: null,
			}),
		),
	];
};

/** Groups in palette order, then roads and areas. */
const GROUP_ORDER = [
	...partsByCategory().map(([category]) => CATEGORY_LABELS[category]),
	OTHER,
	ROADS,
	AREAS,
];

/** Every word of the query must appear in the row's name, kind or group. */
const matches = (row: IOutlinerRow, query: string) => {
	const text = `${row.name} ${row.fallback} ${row.group}`.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => text.includes(word));
};

/**
 * Everything in the world as a list, like Blender's outliner: click to
 * select, double-click (or F2) to rename, and hide or lock each item. Hovering
 * a row highlights its item in the world. See docs/adr/0035-outliner.md.
 */
export const Outliner = () => {
	const scene = useEditor((s) => s.scene);
	const selectedKey = useEditor((s) =>
		s.selectedId
			? `entity:${s.selectedId}`
			: s.selectedRoadId
				? `road:${s.selectedRoadId}`
				: s.selectedAreaId
					? `area:${s.selectedAreaId}`
					: null,
	);
	const palette = usePalette();
	const [query, setQuery] = useState("");
	const [onlyData, setOnlyData] = useState(false);
	const [renaming, setRenaming] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const store = () => useEditor.getState();
	const select = (item: ISceneItem) => {
		const state = store();
		if (item.kind === "entity") {
			state.select(item.id);
		} else if (item.kind === "road") {
			state.selectRoad(item.id);
		} else {
			state.selectArea(item.id);
		}
	};
	const rename = (item: ISceneItem, name: string) => {
		const state = store();
		const recipe = (thing: { name: string }) => {
			thing.name = name;
		};
		if (item.kind === "entity") {
			state.updateEntity(item.id, recipe);
		} else if (item.kind === "road") {
			state.updateRoad(item.id, recipe);
		} else {
			state.updateArea(item.id, recipe);
		}
	};

	// A row under the pointer when the outliner goes away mustn't stay highlighted.
	useEffect(() => () => store().setHovered(null), []);

	// Keep the selected row in view when something is selected in the scene.
	useEffect(() => {
		listRef.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest" });
	}, [selectedKey]);

	useHotkey("F2", () => setRenaming(selectedKey), {
		enabled: selectedKey !== null,
		meta: { name: "Rename the selection" },
	});

	const rows = rowsOf(scene, palette);
	const shown = rows.filter(
		(row) => (!query.trim() || matches(row, query)) && (!onlyData || row.value !== null),
	);
	const groups = GROUP_ORDER.filter((group) => shown.some((row) => row.group === group));

	return (
		<div className={styles.outliner}>
			<div className={styles.top}>
				<h2 className={styles.heading}>Outliner</h2>

				<div className={styles.filters}>
					<SearchField label="Search the world" value={query} onChange={setQuery} />

					<SwitchField
						label="Only things that show data"
						checked={onlyData}
						onChange={setOnlyData}
					/>
				</div>
			</div>

			<div ref={listRef} className={styles.list}>
				{rows.length === 0 && (
					<Hint>Nothing in this world yet. Add something from Add to scene.</Hint>
				)}

				{rows.length > 0 && groups.length === 0 && <Hint>Nothing matches.</Hint>}

				{groups.map((group) => (
					<section key={group} className={styles.group}>
						<GroupLabel as="h3">{group}</GroupLabel>

						<List>
							{shown
								.filter((row) => row.group === group)
								.map((row) => {
									const key = keyOf(row.item);
									const label = row.name || row.fallback;
									return (
										<ListItem
											key={key}
											label={label}
											meta={row.value ?? undefined}
											swatch={row.swatch}
											current={key === selectedKey}
											muted={row.hidden}
											onClick={() => select(row.item)}
											onHover={(hovering) => store().setHovered(hovering ? row.item : null)}
											rename={{
												value: row.name,
												placeholder: row.fallback,
												editing: renaming === key,
												onEditingChange: (editing) => setRenaming(editing ? key : null),
												onCommit: (name) => rename(row.item, name),
											}}
											actions={
												<IconButtonGroup>
													<IconButton
														icon={row.hidden ? "eyeOff" : "eye"}
														label={row.hidden ? `Show ${label} (H)` : `Hide ${label} (H)`}
														pressed={row.hidden}
														onClick={() => store().setItemFlag(row.item, "hidden", !row.hidden)}
													/>

													<IconButton
														icon={row.locked ? "lock" : "unlock"}
														label={row.locked ? `Unlock ${label}` : `Lock ${label}`}
														pressed={row.locked}
														onClick={() => store().setItemFlag(row.item, "locked", !row.locked)}
													/>
												</IconButtonGroup>
											}
										/>
									);
								})}
						</List>
					</section>
				))}

				{rows.length > 0 && (
					<>
						<Hint>
							Double-click a name or press <Kbd>F2</Kbd> to rename.
						</Hint>

						<Hint>
							<Kbd>H</Kbd> hides or shows, <Kbd>Alt</Kbd>+<Kbd>H</Kbd> shows all, <Kbd>F</Kbd> zooms
							to it.
						</Hint>
					</>
				)}
			</div>
		</div>
	);
};
