import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import {
	selectSelectedArea,
	selectSelectedEntity,
	selectSelectedRoad,
	type TInspectorTab,
	useEditor,
} from "#/editor/store";
import { getPart, partName } from "#/parts/registry";
import { AREA_TYPE_LABELS } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";

import { areaTabs } from "./AreaInspector";
import { IconButton } from "./Button";
import { DataPanel } from "./DataPanel";
import { entityTabs } from "./EntityInspector";
import { SearchField, SettingsSearchContext } from "./fields";
import { Icon, type TIconName } from "./Icon";
import { CATEGORY_ICONS, type IInspectorTab } from "./inspectorTabs";
import { Outliner } from "./Outliner";
import { PartsPalette } from "./PartsPalette";
import { RailTabPanel, RailTabs } from "./RailTabs";
import { roadTabs } from "./RoadInspector";
import { SkyTab } from "./SkyTab";
import { ViewpointsSection } from "./ViewpointsSection";
import { TrafficTab, WorldTab } from "./WorldTabs";

import styles from "./Inspector.module.css";

/** The tabs about the whole world, always on the rail. */
const WORLD_TABS: IInspectorTab[] = [
	{ value: "world", label: "World", icon: "globe", content: <WorldTab /> },
	{ value: "sky", label: "Sun & sky", icon: "sun", content: <SkyTab /> },
	{ value: "views", label: "Viewpoints", icon: "camera", content: <ViewpointsSection /> },
	{ value: "traffic", label: "Traffic", icon: "traffic", content: <TrafficTab /> },
	{ value: "data", label: "Data", icon: "chart", content: <DataPanel /> },
];

/** Narrow layout only: the left column's panel and the outliner become tabs of the sheet. */
const NARROW_TABS: IInspectorTab[] = [
	{ value: "add", label: "Add to scene", icon: "plusSquare", content: <PartsPalette /> },
	{ value: "outliner", label: "Outliner", icon: "list", content: <Outliner /> },
];

interface ISelectionContext {
	/** What the header calls it, and its icon. */
	name: string;
	icon: TIconName;
	tabs: IInspectorTab[];
}

/** The selection's tabs (they depend on what it is), and how the header names it. */
const useSelection = (): ISelectionContext | null => {
	const entity = useEditor(selectSelectedEntity);
	const road = useEditor(selectSelectedRoad);
	const area = useEditor(selectSelectedArea);

	if (entity) {
		const part = getPart(entity.kind);
		return {
			name: entity.name || (part ? partName(part) : entity.kind),
			icon: part ? CATEGORY_ICONS[part.category] : "cube",
			tabs: entityTabs(entity),
		};
	}
	if (road) {
		return {
			name: road.name || ROAD_STYLE_LABELS[road.style],
			icon: "road",
			tabs: roadTabs(road),
		};
	}
	if (area) {
		return {
			name: area.name || AREA_TYPE_LABELS[area.type],
			icon: "area",
			tabs: areaTabs(area),
		};
	}
	return null;
};

interface ISearchGroup {
	/** Whose settings: the selection's or the world's, named like the header does. */
	name: string;
	icon: TIconName;
	tabs: IInspectorTab[];
}

/** The tab to show: the one picked if it's there, else the selection's first, else World. */
const shownTab = (tab: TInspectorTab, available: IInspectorTab[], selectionTabs: IInspectorTab[]) =>
	available.find((candidate) => candidate.value === tab) ?? selectionTabs[0] ?? WORLD_TABS[0];

/**
 * The folded right pane's shortcuts (ADR-0055): the rail's icons, the open
 * tab highlighted. Clicking one opens the pane at that tab.
 */
export const RailShortcuts = ({ onOpen }: { onOpen: () => void }) => {
	const tab = useEditor((s) => s.tab);
	const setTab = useEditor((s) => s.setTab);
	const selectionTabs = useSelection()?.tabs ?? [];
	const shown = shownTab(tab, [...selectionTabs, ...WORLD_TABS], selectionTabs);
	const groups = [WORLD_TABS, selectionTabs].filter((group) => group.length > 0);

	return (
		<nav className={styles.shortcuts} aria-label="Properties">
			{groups.map((group, index) => (
				<Fragment key={group[0].value}>
					{index > 0 && <span className={styles.shortcutDivider} aria-hidden="true" />}

					{group.map((candidate) => (
						<IconButton
							key={candidate.value}
							icon={candidate.icon}
							label={candidate.label}
							tooltipSide="left"
							pressed={candidate === shown}
							onClick={() => {
								setTab(candidate.value);
								onOpen();
							}}
						/>
					))}
				</Fragment>
			))}
		</nav>
	);
};

/**
 * Every tab's settings at once, filtered by the search (ADR-0054): panels and
 * fields that don't match hide themselves, and so does a tab with nothing left.
 * Each tab is headed like the header ("Meridian Tower › Look"), so the
 * selection's settings can't be mistaken for the world's.
 */
const SearchResults = ({ query, groups }: { query: string; groups: ISearchGroup[] }) => {
	return (
		<SettingsSearchContext.Provider value={query}>
			<div className={styles.results}>
				{groups.flatMap((group) =>
					group.tabs.map((tab) => (
						<section key={tab.value} className={styles.resultGroup}>
							<h3 className={styles.resultHeading}>
								<span className={styles.contextIcon}>
									<Icon name={group.icon} size={14} />
								</span>

								<strong>{group.name}</strong>

								<Icon name="chevronRight" size={11} />

								<span>{tab.label}</span>
							</h3>

							{tab.content}
						</section>
					)),
				)}

				<p className={styles.noResults}>No settings match “{query.trim()}”.</p>
			</div>
		</SettingsSearchContext.Provider>
	);
};

interface IInspectorProps {
	/** Narrow layout: adds Add and List tabs with the left column's panels (it's hidden). */
	narrow?: boolean;
	/** False shows just the tab bar (the collapsed bottom sheet). */
	open?: boolean;
	/** Called when the user picks a tab, so a collapsed sheet can open. */
	onTabSelect?: () => void;
	/** Shown at the end of the tab bar (the sheet's hide/show button). */
	tabBarEnd?: ReactNode;
}

/**
 * The properties editor, like Blender's (ADR-0054): icon tabs on a rail (the
 * world's on top, then the selection's), a header naming what's shown with a
 * settings search, and the tab's panels.
 */
export const Inspector = ({
	narrow = false,
	open = true,
	onTabSelect,
	tabBarEnd,
}: IInspectorProps) => {
	const tab = useEditor((s) => s.tab);
	const setTab = useEditor((s) => s.setTab);
	const title = useEditor((s) => s.scene.meta.title);
	const selection = useSelection();
	const [searchOpen, setSearchOpen] = useState(false);
	const [query, setQuery] = useState("");
	const searchInput = useRef<HTMLInputElement>(null);

	const selectionTabs = selection?.tabs ?? [];
	const available = [...(narrow ? NARROW_TABS : []), ...selectionTabs, ...WORLD_TABS];
	// A tab the selection doesn't have shows its first one (or the world's, with nothing selected).
	const shown = shownTab(tab, available, selectionTabs);
	const searching = searchOpen && query.trim() !== "";
	const isWorldTab = WORLD_TABS.includes(shown);
	const hasHeader = !NARROW_TABS.includes(shown);

	const closeSearch = () => {
		setQuery("");
		setSearchOpen(false);
	};

	useEffect(() => {
		if (searchOpen) {
			searchInput.current?.focus();
		}
	}, [searchOpen]);

	return (
		<div className={styles.inspector}>
			<RailTabs
				label="Properties"
				orientation={narrow ? "horizontal" : "vertical"}
				value={shown.value}
				onChange={(next: TInspectorTab) => {
					setTab(next);
					closeSearch();
					onTabSelect?.();
				}}
				groups={narrow ? [NARROW_TABS, selectionTabs, WORLD_TABS] : [WORLD_TABS, selectionTabs]}
				barEnd={tabBarEnd}
			>
				{open && hasHeader && (
					<header className={styles.header}>
						{searchOpen ? (
							<div
								className={styles.search}
								onBlur={(event) => {
									if (!query && !event.currentTarget.contains(event.relatedTarget)) {
										setSearchOpen(false);
									}
								}}
							>
								<SearchField
									label="Search the settings"
									placeholder="Find a setting…"
									value={query}
									onChange={setQuery}
									inputRef={searchInput}
								/>

								<IconButton icon="close" label="Close search" onClick={closeSearch} />
							</div>
						) : (
							<>
								<p className={styles.breadcrumb}>
									<span className={styles.contextIcon}>
										<Icon name={isWorldTab || !selection ? "globe" : selection.icon} size={15} />
									</span>

									<strong>{isWorldTab || !selection ? title || "World" : selection.name}</strong>

									<Icon name="chevronRight" size={12} />

									<span>{shown.label}</span>
								</p>

								<IconButton
									icon="search"
									label="Search the settings"
									onClick={() => setSearchOpen(true)}
								/>
							</>
						)}
					</header>
				)}

				{open && (
					<div key={searching ? "search" : shown.value} className={styles.scroll}>
						{searching ? (
							<SearchResults
								query={query}
								groups={[
									...(selection ? [selection] : []),
									{ name: title || "World", icon: "globe", tabs: WORLD_TABS },
								]}
							/>
						) : (
							<RailTabPanel value={shown.value}>{shown.content}</RailTabPanel>
						)}
					</div>
				)}
			</RailTabs>
		</div>
	);
};
