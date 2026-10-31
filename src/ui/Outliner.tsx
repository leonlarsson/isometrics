import { useHotkey } from "@tanstack/react-hotkeys";
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type { ISceneItem } from "#/editor/framing";
import { setPanelOpen, usePanelMemory } from "#/editor/panelMemory";
import { setSidePaneOpen } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { useThemePalette } from "#/editor/useTheme";
import { useUsesData, useWorldData } from "#/editor/worldData";
import { FENCE_STYLE_LABELS } from "#/fences/registry";
import { resolveColors, swatchColors } from "#/parts/colorModel";
import { valuesOfEntity } from "#/parts/propData";
import { getPart, partName, partsByCategory } from "#/parts/registry";
import { CATEGORY_LABELS, type TPartCategory } from "#/parts/types";
import { AREA_KIND_LABELS } from "#/scene/areas";
import { formatEntry } from "#/scene/format";
import { ROAD_KIND_LABELS } from "#/scene/roads";
import type { TScene } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { IconButton, IconButtonGroup } from "./Button";
import { CollapsibleSection } from "./CollapsibleSection";
import { Hint, Kbd, SearchField } from "./fields";
import type { TIconName } from "./Icon";
import { CATEGORY_ICONS } from "./inspectorTabs";
import { List, ListItem } from "./List";
import { PaneHeader } from "./PaneHeader";
import { areaSwatch, fenceSwatch, roadSwatch } from "./swatches";
import { useNarrowLayout } from "./useNarrowLayout";

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
const FENCES = "Fences";
const OTHER = "Other";

const keyOf = (item: ISceneItem) => `${item.kind}:${item.id}`;

/**
 * Each object's row as last made, for as long as the object, the palette and the world's data are
 * the same: a change to one object in a world of thousands makes one row again, not all of them.
 */
const madeRows = new WeakMap<
	object,
	{ palette: IScenePalette; data: TScene["data"]; row: IOutlinerRow }
>();

const cachedRow = <T extends object>(
	thing: T,
	palette: IScenePalette,
	data: TScene["data"],
	make: (thing: T) => IOutlinerRow,
) => {
	const made = madeRows.get(thing);
	if (made && made.palette === palette && made.data === data) {
		return made.row;
	}
	const row = make(thing);
	madeRows.set(thing, { palette, data, row });
	return row;
};

/** Every object, road and area as a row, objects grouped by part category. */
const rowsOf = (
	scene: TScene,
	palette: IScenePalette,
	worldData: TScene["data"],
): IOutlinerRow[] => {
	const data = worldData.values;
	const firstValue = (keys: string[], values = data) => {
		const key = keys[0];
		return key ? formatEntry(values.find((entry) => entry.key === key)) : null;
	};
	return [
		...scene.entities.map((each) =>
			cachedRow(each, palette, worldData, (entity): IOutlinerRow => {
				const part = getPart(entity.kind);
				// Its own values: the world's and its row's columns (ADR-0108).
				const own = valuesOfEntity(entity, worldData);
				const { first, second } = part
					? swatchColors(resolveColors(part, entity, palette, own), part)
					: { first: palette.selection, second: palette.selection };
				return {
					item: { kind: "entity", id: entity.id },
					group: part ? CATEGORY_LABELS[part.category] : OTHER,
					name: entity.name,
					fallback: part ? partName(part) : entity.kind,
					swatch: `linear-gradient(135deg, ${first} 55%, ${second} 55%)`,
					hidden: entity.isHidden,
					locked: entity.isLocked,
					// The card's first value, else its detail tiles' (ADR-0104: every object has card settings).
					// With data off (ADR-0115), none: not even "no data".
					value: worldData.isOn
						? firstValue(
								entity.label.dataKeys.length ? entity.label.dataKeys : entity.details.dataKeys,
							)
						: null,
				};
			}),
		),
		...scene.roads.map((each) =>
			cachedRow(
				each,
				palette,
				worldData,
				(road): IOutlinerRow => ({
					item: { kind: "road", id: road.id },
					group: ROADS,
					name: road.name,
					fallback: ROAD_KIND_LABELS[road.kind],
					swatch: roadSwatch(road, palette),
					hidden: road.isHidden,
					locked: road.isLocked,
					value: null,
				}),
			),
		),
		...scene.areas.map((each) =>
			cachedRow(
				each,
				palette,
				worldData,
				(area): IOutlinerRow => ({
					item: { kind: "area", id: area.id },
					group: AREAS,
					name: area.name,
					fallback: AREA_KIND_LABELS[area.kind],
					swatch: areaSwatch(area, palette),
					hidden: area.isHidden,
					locked: area.isLocked,
					value: null,
				}),
			),
		),
		...scene.fences.map((each) =>
			cachedRow(
				each,
				palette,
				worldData,
				(fence): IOutlinerRow => ({
					item: { kind: "fence", id: fence.id },
					group: FENCES,
					name: fence.name,
					fallback: FENCE_STYLE_LABELS[fence.kind],
					swatch: fenceSwatch(fence, palette, data),
					hidden: fence.isHidden,
					locked: fence.isLocked,
					value: null,
				}),
			),
		),
	];
};

/** Groups in palette order, then roads, fences and areas. */
const GROUP_ORDER = [
	...partsByCategory().map(([category]) => CATEGORY_LABELS[category]),
	OTHER,
	ROADS,
	FENCES,
	AREAS,
];

/** Each group's icon on its heading. */
const GROUP_ICONS: Record<string, TIconName> = {
	...Object.fromEntries(
		(Object.keys(CATEGORY_LABELS) as TPartCategory[]).map((category) => [
			CATEGORY_LABELS[category],
			CATEGORY_ICONS[category],
		]),
	),
	[OTHER]: "cube",
	[ROADS]: "road",
	[AREAS]: "area",
	[FENCES]: "fence",
};

/** Every word of the query must appear in the row's name, kind or group. */
const matches = (row: IOutlinerRow, query: string) => {
	const text = `${row.name} ${row.fallback} ${row.group}`.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => text.includes(word));
};

interface IOutlinerRowProps {
	row: IOutlinerRow;
	current: boolean;
	editing: boolean;
	/** Stable across renders (a ref's current function), so rows that didn't change don't redraw. */
	onSelect: (
		item: ISceneItem,
		keys: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
	) => void;
	onRenamingChange: (key: string | null) => void;
}

const store = () => useEditor.getState();

/**
 * One row: drawn again only when its own item, selection or renaming changes,
 * not on every change to the world (a stroke of the paint brush adds dozens of
 * objects; hundreds of rows with their buttons and tooltips made it lag).
 */
const OutlinerRowItem = memo(
	({ row, current, editing, onSelect, onRenamingChange }: IOutlinerRowProps) => {
		const key = keyOf(row.item);
		const label = row.name || row.fallback;
		return (
			<ListItem
				label={label}
				meta={row.value ?? undefined}
				swatch={row.swatch}
				current={current}
				muted={row.hidden}
				onClick={(keys) => onSelect(row.item, keys)}
				onHover={(hovering) => store().setHovered(hovering ? row.item : null)}
				onContextMenu={(at) => store().openContextMenu(row.item, at)}
				rename={{
					value: row.name,
					placeholder: row.fallback,
					editing,
					onEditingChange: (isEditing) => onRenamingChange(isEditing ? key : null),
					onCommit: (name) => store().renameItem(row.item, name),
				}}
				actions={
					<IconButtonGroup>
						<IconButton
							icon={row.hidden ? "eyeOff" : "eye"}
							label={row.hidden ? `Show ${label} (H)` : `Hide ${label} (H)`}
							pressed={row.hidden}
							onClick={() => store().setItemFlag(row.item, "isHidden", !row.hidden)}
						/>

						<IconButton
							icon={row.locked ? "lock" : "unlock"}
							label={row.locked ? `Unlock ${label}` : `Lock ${label}`}
							pressed={row.locked}
							onClick={() => store().setItemFlag(row.item, "isLocked", !row.locked)}
						/>
					</IconButtonGroup>
				}
			/>
		);
	},
	// The row is made afresh each render; what it shows is what counts.
	(before, after) =>
		before.current === after.current &&
		before.editing === after.editing &&
		before.onSelect === after.onSelect &&
		before.onRenamingChange === after.onRenamingChange &&
		before.row.name === after.row.name &&
		before.row.fallback === after.row.fallback &&
		before.row.swatch === after.row.swatch &&
		before.row.hidden === after.row.hidden &&
		before.row.locked === after.row.locked &&
		before.row.value === after.row.value &&
		keyOf(before.row.item) === keyOf(after.row.item),
);

/** Rows are drawn in chunks of this many (see OutlinerRowChunk). */
const CHUNK = 100;

interface IOutlinerRowChunkProps {
	rows: IOutlinerRow[];
	selectedRows: ReadonlySet<string>;
	renaming: string | null;
	onSelect: IOutlinerRowProps["onSelect"];
	onRenamingChange: (key: string | null) => void;
}

/**
 * A run of rows, drawn again only when one of them changes (rows are the same objects while their
 * item is, see cachedRow), or the selection or renaming: a change to one object in a world of
 * thousands makes one chunk's elements again, not every row's.
 */
const OutlinerRowChunk = memo(
	({ rows, selectedRows, renaming, onSelect, onRenamingChange }: IOutlinerRowChunkProps) =>
		rows.map((row) => {
			const key = keyOf(row.item);
			return (
				<OutlinerRowItem
					key={key}
					row={row}
					current={selectedRows.has(key)}
					editing={renaming === key}
					onSelect={onSelect}
					onRenamingChange={onRenamingChange}
				/>
			);
		}),
	(before, after) =>
		before.selectedRows === after.selectedRows &&
		before.renaming === after.renaming &&
		before.onSelect === after.onSelect &&
		before.onRenamingChange === after.onRenamingChange &&
		before.rows.length === after.rows.length &&
		before.rows.every((row, i) => row === after.rows[i]),
);

/** A list split into runs of `size`. */
const chunksOf = <T,>(list: T[], size: number) =>
	Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
		list.slice(i * size, (i + 1) * size),
	);

/**
 * Everything in the world as a list, like Blender's outliner: click to
 * select, double-click (or F2) to rename, and hide or lock each item. Hovering
 * a row highlights its item in the world. See docs/adr/0035-outliner.md.
 */
export const Outliner = () => {
	// Behind the world while it changes fast (a drag changes it every frame): drawn again when there's
	// time, so thousands of rows don't hold up the view (ADR-0092).
	const scene = useDeferredValue(useEditor((s) => s.scene));
	const selectedKey = useEditor((s) =>
		s.selectedId
			? `entity:${s.selectedId}`
			: s.selectedRoadId
				? `road:${s.selectedRoadId}`
				: s.selectedAreaId
					? `area:${s.selectedAreaId}`
					: s.selectedFenceId
						? `fence:${s.selectedFenceId}`
						: null,
	);
	// Every selected row, the active one included (ADR-0064), as one string so it only changes with them.
	const selectedKeys = useEditor((s) => s.selectedItems.map(keyOf).join(" "));
	const palette = useThemePalette();
	const [query, setQuery] = useState("");
	const [onlyData, setOnlyData] = useState(false);
	const [onlySelected, setOnlySelected] = useState(false);
	const [renaming, setRenaming] = useState<string | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	// Folded groups are remembered per browser, with the properties' panels.
	const panels = usePanelMemory();
	const narrow = useNarrowLayout();

	/**
	 * Select a row's item: Ctrl/Cmd-click adds it or takes it out, Shift-click selects the rows
	 * from the active one to it, as listed (ADR-0064).
	 */
	const select = (
		item: ISceneItem,
		{ shiftKey, ctrlKey, metaKey }: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
	) => {
		const state = store();
		if (ctrlKey || metaKey) {
			state.toggleSelected(item);
			return;
		}
		const listed = groups.flatMap((group) =>
			shown.filter((row) => row.group === group).map((row) => row.item),
		);
		const from = listed.findIndex((row) => keyOf(row) === selectedKey);
		const to = listed.findIndex((row) => keyOf(row) === keyOf(item));
		if (shiftKey && from >= 0 && to >= 0) {
			const range = from < to ? listed.slice(from, to + 1) : listed.slice(to, from + 1).reverse();
			state.selectItems(range);
			return;
		}
		if (item.kind === "entity") {
			state.select(item.id);
		} else if (item.kind === "road") {
			state.selectRoad(item.id);
		} else if (item.kind === "fence") {
			state.selectFence(item.id);
		} else {
			state.selectArea(item.id);
		}
	};

	// Rows call the latest select through a stable function, so they needn't redraw when it changes.
	const selectRef = useRef(select);
	selectRef.current = select;
	const [onSelect] = useState(
		() => (item: ISceneItem, keys: Parameters<typeof select>[1]) => selectRef.current(item, keys),
	);

	// A row under the pointer when the outliner goes away mustn't stay highlighted.
	useEffect(() => () => store().setHovered(null), []);

	// A filter switched on or off shows a different list: from its top, not where the old one was.
	useEffect(() => {
		listRef.current?.scrollTo({ top: 0 });
	}, [onlySelected, onlyData]);

	// Keep the selected row in view when something is selected in the scene.
	useEffect(() => {
		listRef.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest" });
	}, [selectedKey]);

	useHotkey("F2", () => setRenaming(selectedKey), {
		enabled: selectedKey !== null,
		meta: { name: "Rename the selection" },
	});

	const data = useWorldData();
	const usesData = useUsesData();
	const rows = useMemo(() => rowsOf(scene, palette, data), [scene, palette, data]);
	const selectedRows = useMemo(() => new Set(selectedKeys.split(" ")), [selectedKeys]);
	const shown = useMemo(
		() =>
			rows.filter(
				(row) =>
					(!query.trim() || matches(row, query)) &&
					(!onlyData || !usesData || row.value !== null) &&
					(!onlySelected || selectedRows.has(keyOf(row.item))),
			),
		[rows, query, onlyData, usesData, onlySelected, selectedRows],
	);
	const groups = useMemo(
		() => GROUP_ORDER.filter((group) => shown.some((row) => row.group === group)),
		[shown],
	);

	// The rows as elements, made again only when what they show changes: an urgent render (the
	// world as it is, before the deferred one) reuses them as they are.
	const sections = useMemo(
		() =>
			groups.map((group) => (
				<CollapsibleSection
					key={group}
					label={group}
					icon={GROUP_ICONS[group]}
					count={shown.filter((row) => row.group === group).length}
					// While searching every match shows, folded or not.
					open={query.trim() !== "" || (panels[`outliner:${group}`] ?? true)}
					onOpenChange={(open) => setPanelOpen(`outliner:${group}`, open)}
				>
					<List>
						{chunksOf(
							shown.filter((row) => row.group === group),
							CHUNK,
						).map((rows, i) => (
							<OutlinerRowChunk
								// By position: a chunk keeps its place as rows come and go.
								// biome-ignore lint/suspicious/noArrayIndexKey: chunks have no identity of their own
								key={i}
								rows={rows}
								selectedRows={selectedRows}
								renaming={renaming}
								onSelect={onSelect}
								onRenamingChange={setRenaming}
							/>
						))}
					</List>
				</CollapsibleSection>
			)),
		[groups, shown, panels, query, selectedRows, renaming, onSelect],
	);

	return (
		<div className={styles.outliner}>
			<PaneHeader
				icon="list"
				title="Outliner"
				actions={
					<IconButtonGroup>
						<IconButton
							icon="layers"
							label={onlySelected ? "Showing only the selection" : "Only the selection"}
							pressed={onlySelected}
							onClick={() => setOnlySelected(!onlySelected)}
						/>

						{usesData && (
							<IconButton
								icon="chart"
								label={
									onlyData ? "Showing only things that show data" : "Only things that show data"
								}
								pressed={onlyData}
								onClick={() => setOnlyData(!onlyData)}
							/>
						)}
					</IconButtonGroup>
				}
				// Phones have the sheet, which hides on its own.
				fold={
					narrow
						? undefined
						: {
								side: "right",
								label: "Hide the outliner and properties",
								onFold: () => setSidePaneOpen("right", false),
							}
				}
			/>

			<div className={styles.top}>
				<SearchField label="Search the world" value={query} onChange={setQuery} />
			</div>

			<div ref={listRef} className={styles.list}>
				{rows.length === 0 && (
					<Hint>Nothing in this world yet. Add something from Add to scene.</Hint>
				)}

				{rows.length > 0 && groups.length === 0 && (
					<Hint>
						{onlySelected && selectedKeys === "" ? "Nothing is selected." : "Nothing matches."}
					</Hint>
				)}

				{sections}

				{rows.length > 0 && (
					<>
						<Hint>
							Double-click a name or press <Kbd>F2</Kbd> to rename. Right-click for more.
						</Hint>

						<Hint>
							<Kbd>Ctrl</Kbd>-click adds to the selection or takes out, <Kbd>Shift</Kbd>-click
							selects the rows in between.
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
