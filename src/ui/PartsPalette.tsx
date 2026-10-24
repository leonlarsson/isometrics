import { useHotkey } from "@tanstack/react-hotkeys";
import { type PointerEvent, type ReactElement, useEffect, useRef, useState } from "react";

import {
	rememberUsed,
	setSectionCollapsed,
	toggleFavourite,
	usePaletteMemory,
} from "#/editor/paletteMemory";
import { findFreeSpot } from "#/editor/placement";
import { useEditor } from "#/editor/store";
import { usePalette, useResolvedTheme } from "#/editor/useTheme";
import { pastDragThreshold } from "#/lib/pointer";
import { partName, partsByCategory, resolveColors } from "#/parts/registry";
import { CATEGORY_LABELS, type TPartCategory } from "#/parts/types";
import { usePartThumbnails } from "#/render/thumbnails";
import { currentView } from "#/render/viewpoints";
import { AREA_TYPE_LABELS, areaColor } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TAreaType, TRoadStyle } from "#/scene/schema";

import { IconButton } from "./Button";
import { CollapsibleSection } from "./CollapsibleSection";
import { Hint, SearchField } from "./fields";
import { releaseFocusAfterPointerClick } from "./focus";
import { Icon, type TIconName } from "./Icon";
import { CATEGORY_ICONS } from "./inspectorTabs";
import { ContextMenu, Menu } from "./Menu";
import { PaneHeader } from "./PaneHeader";
import { type IPreviewAnchor, PartPreview } from "./PartPreview";
import { Tooltip } from "./Tooltip";

import styles from "./PartsPalette.module.css";

// Keyed by id, so a new road style or area type (a variant) can't be left out of the palette.
const ROAD_TOOL_INFO: Record<TRoadStyle, { description: string; keywords: string }> = {
	road_01: { description: "Paved road with a centre line", keywords: "street" },
	dirt_path_01: { description: "Unpaved path", keywords: "trail footpath track" },
	hidden_route_01: {
		description: "Invisible route that vehicles follow, e.g. a forklift path",
		keywords: "path track ferry route",
	},
};

const AREA_TOOL_INFO: Record<TAreaType, { description: string; keywords: string }> = {
	water_01: { description: "Sea, lake, harbour or pond", keywords: "river ocean bay" },
	grass_01: { description: "Lawn, park or field", keywords: "garden meadow green" },
	sand_01: { description: "Beach or sand", keywords: "desert dune" },
	plaza_01: { description: "Paved square, quay or car park", keywords: "parking pavement" },
	raised_land_01: {
		description: "Raised ground with cliff sides, e.g. a rock or plateau",
		keywords: "hill mountain cliff terrain",
	},
};

/** Each section's icon on its heading. */
const SECTION_ICONS: Record<string, TIconName> = {
	favourites: "star",
	recent: "clock",
	Roads: "road",
	Areas: "area",
	...Object.fromEntries(
		(Object.keys(CATEGORY_LABELS) as TPartCategory[]).map((category) => [
			CATEGORY_LABELS[category],
			CATEGORY_ICONS[category],
		]),
	),
};

const ROAD_TOOLS = (Object.keys(ROAD_TOOL_INFO) as TRoadStyle[]).map((style) => ({
	style,
	...ROAD_TOOL_INFO[style],
}));

const AREA_TOOLS = (Object.keys(AREA_TOOL_INFO) as TAreaType[]).map((type) => ({
	type,
	...AREA_TOOL_INFO[type],
}));

interface IPaletteItem {
	key: string;
	group: string;
	name: string;
	/** What the tooltip says. */
	tooltip: string;
	/** Extra text the search matches: description and everyday words. */
	searchText: string;
	/** CSS background for the tile's chip, shown until (or instead of) a picture. */
	swatch: string;
	/** A rendered picture of the part (parts only, once it's ready). */
	thumbnail?: string;
	/** Highlighted while this tool is active (drawing this road or area). */
	pressed?: boolean;
	/** Part kind, for items that can also be dragged onto the scene. */
	kind?: string;
	onSelect: () => void;
}

/** Hover this long before the preview card opens; once open, other tiles show instantly. */
const PREVIEW_OPEN_MS = 350;
/** Grace period when leaving a tile, so moving across the gap to the next one doesn't flicker. */
const PREVIEW_CLOSE_MS = 120;

/** Every word of the query must appear in the item's name, group, description or keywords. */
const matches = (item: IPaletteItem, query: string) => {
	const text = `${item.name} ${item.group} ${item.searchText}`.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => text.includes(word));
};

/**
 * Road and area tools explain themselves in a tooltip. Parts have the preview
 * card instead (PartPreview), which says the same and shows the part.
 */
const TileTooltip = ({ item, children }: { item: IPaletteItem; children: ReactElement }) =>
	item.kind ? (
		children
	) : (
		<Tooltip label={item.tooltip} side="right">
			{children}
		</Tooltip>
	);

/**
 * The "Add to scene" panel: roads and areas to draw, parts to place, with a
 * search. Clicking a part adds it at a free spot in the middle of the view;
 * dragging it onto the scene places it there (render/PlacementPreview shows it
 * under the cursor). Hovering a part opens a card with a live, turning model.
 * Favourites (the star, or right-click) and recently used items sit on top,
 * and every section folds; all remembered per browser (editor/paletteMemory).
 * See docs/adr/0051-add-to-scene.md.
 */
export const PartsPalette = () => {
	const addEntity = useEditor((s) => s.addEntity);
	const drawingStyle = useEditor((s) => (s.drawing?.target === "road" ? s.drawing.style : null));
	const drawingArea = useEditor((s) => (s.drawing?.target === "area" ? s.drawing.areaType : null));
	const startDrawing = useEditor((s) => s.startDrawing);
	const startAreaDrawing = useEditor((s) => s.startAreaDrawing);
	const palette = usePalette();
	const thumbnails = usePartThumbnails(useResolvedTheme());
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	// Set once a press turned into a drag, so the click that may follow doesn't add a second copy.
	const dragged = useRef(false);
	const [preview, setPreview] = useState<{ kind: string; anchor: IPreviewAnchor } | null>(null);
	const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const placing = useEditor((s) => s.placingKind !== null);
	const memory = usePaletteMemory();
	const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);

	/** Show the card for a tile: after a pause, or straight away if one is open or `now`. */
	const showPreview = (kind: string, tile: HTMLElement, now = false) => {
		clearTimeout(previewTimer.current);
		const rect = tile.getBoundingClientRect();
		// Beside the panel (its right edge), not over the neighbouring tile.
		const panel = tile.closest("nav")?.getBoundingClientRect() ?? rect;
		const anchor = { left: panel.right + 8, centerY: rect.top + rect.height / 2 };
		if (now || preview) {
			setPreview({ kind, anchor });
		} else {
			previewTimer.current = setTimeout(() => setPreview({ kind, anchor }), PREVIEW_OPEN_MS);
		}
	};
	const hidePreview = (now = false) => {
		clearTimeout(previewTimer.current);
		if (now) {
			setPreview(null);
		} else {
			previewTimer.current = setTimeout(() => setPreview(null), PREVIEW_CLOSE_MS);
		}
	};
	useEffect(() => () => clearTimeout(previewTimer.current), []);

	useHotkey("/", () => searchRef.current?.focus(), { meta: { name: "Search parts" } });

	const roadSwatch: Record<TRoadStyle, string> = {
		road_01: `linear-gradient(180deg, ${palette.road} 42%, ${palette.roadMark} 42% 58%, ${palette.road} 58%)`,
		dirt_path_01: palette.dirt,
		hidden_route_01: `repeating-linear-gradient(90deg, ${palette.selection} 0 5px, transparent 5px 9px)`,
	};

	const items: IPaletteItem[] = [
		...ROAD_TOOLS.map(({ style, description, keywords }) => ({
			key: `road:${style}`,
			group: "Roads",
			name: ROAD_STYLE_LABELS[style],
			tooltip: `${description}. Click points on the ground; Enter to finish.`,
			searchText: `${description} ${keywords} road`,
			swatch: roadSwatch[style],
			pressed: drawingStyle === style,
			onSelect: () => startDrawing(style),
		})),
		...AREA_TOOLS.map(({ type, description, keywords }) => ({
			key: `area:${type}`,
			group: "Areas",
			name: AREA_TYPE_LABELS[type],
			tooltip: `${description}. Click its corners on the ground; Enter to finish.`,
			searchText: `${description} ${keywords} area`,
			swatch: areaColor({ type, color: null }, palette),
			pressed: drawingArea === type,
			onSelect: () => startAreaDrawing(type),
		})),
		...partsByCategory().flatMap(([category, parts]) =>
			parts.map((part) => {
				const { color, accent } = resolveColors(part, { color: null, accent: null }, palette);
				return {
					key: `part:${part.kind}`,
					group: CATEGORY_LABELS[category],
					name: partName(part),
					tooltip: `${part.description}. Click to add, or drag onto the scene.`,
					searchText: `${part.description} ${(part.keywords ?? []).join(" ")}`,
					swatch: `linear-gradient(135deg, ${color} 55%, ${accent} 55%)`,
					thumbnail: thumbnails[part.kind],
					kind: part.kind,
					onSelect: () => {
						const scene = useEditor.getState().scene;
						// Where you're looking, not the middle of the world (far off screen on a big ground).
						const near = currentView.read?.()?.target ?? [0, 0];
						addEntity({ kind: part.kind, name: "", position: findFreeSpot(scene, part, near) });
					},
				};
			}),
		),
	];

	/** Watch a press on a part tile; past the threshold it becomes a drag onto the scene. */
	const watchDrag = (kind: string, down: PointerEvent<HTMLButtonElement>) => {
		dragged.current = false;
		// Touch presses scroll the panel instead.
		if (down.button !== 0 || down.pointerType === "touch") {
			return;
		}
		const from = { clientX: down.clientX, clientY: down.clientY };
		const stop = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", stop);
		};
		const onMove = (event: globalThis.PointerEvent) => {
			if (!pastDragThreshold(from, event)) {
				return;
			}
			stop();
			dragged.current = true;
			useEditor.getState().startPlacing(kind);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", stop);
	};

	const byKey = new Map(items.map((item) => [item.key, item]));
	const use = (item: IPaletteItem) => {
		item.onSelect();
		rememberUsed(item.key);
	};
	const searching = query.trim() !== "";
	const shown = searching ? items.filter((item) => matches(item, query)) : items;
	const pick = (keys: string[]) =>
		keys.map((key) => byKey.get(key)).filter((item): item is IPaletteItem => item !== undefined);
	// Favourites and recently used first (not while searching: the matches are what count then).
	const sections = [
		...(searching
			? []
			: [
					{ id: "favourites", label: "Favourites", items: pick(memory.favourites) },
					{ id: "recent", label: "Recently used", items: pick(memory.recent) },
				]),
		...[...new Set(shown.map((item) => item.group))].map((group) => ({
			id: group,
			label: group,
			items: shown.filter((item) => item.group === group),
		})),
	].filter((section) => section.items.length > 0);
	const menuItem = menu ? byKey.get(menu.key) : undefined;

	const tile = (item: IPaletteItem, section: string) => {
		const favourite = memory.favourites.includes(item.key);
		return (
			<div key={`${section}:${item.key}`} className={styles.tile}>
				<TileTooltip item={item}>
					<button
						type="button"
						className={styles.part}
						data-draggable={item.kind ? "" : undefined}
						aria-pressed={item.pressed}
						aria-description={item.kind ? item.tooltip : undefined}
						onPointerEnter={(event) => {
							if (item.kind && event.pointerType === "mouse") {
								showPreview(item.kind, event.currentTarget);
							}
						}}
						onPointerLeave={() => hidePreview()}
						onFocus={(event) => {
							// Keyboard focus only; a click focuses too, and the pointer already shows it.
							if (item.kind && event.currentTarget.matches(":focus-visible")) {
								showPreview(item.kind, event.currentTarget, true);
							}
						}}
						onBlur={() => hidePreview(true)}
						onPointerDown={(event) => {
							if (item.kind) {
								hidePreview(true);
								watchDrag(item.kind, event);
							}
						}}
						onClick={(event) => {
							if (!dragged.current) {
								use(item);
							}
							releaseFocusAfterPointerClick(event);
						}}
						onContextMenu={(event) => {
							event.preventDefault();
							hidePreview(true);
							setMenu({ key: item.key, x: event.clientX, y: event.clientY });
						}}
					>
						<span className={styles.preview} aria-hidden="true">
							{item.thumbnail ? (
								<img className={styles.thumbnail} src={item.thumbnail} alt="" draggable={false} />
							) : (
								<span className={styles.swatch} style={{ background: item.swatch }} />
							)}
						</span>

						<span className={styles.name}>{item.name}</span>

						{item.kind && (
							<span className={styles.grip} aria-hidden="true">
								<Icon name="grip" size={14} />
							</span>
						)}
					</button>
				</TileTooltip>

				<span className={styles.star} data-on={favourite || undefined}>
					<IconButton
						icon="star"
						label={
							favourite ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`
						}
						pressed={favourite}
						onClick={() => toggleFavourite(item.key)}
					/>
				</span>
			</div>
		);
	};

	return (
		<nav className={styles.palette} aria-label="Parts">
			<PaneHeader icon="plusSquare" title="Add to scene" />

			<div className={styles.top}>
				<div className={styles.search}>
					<SearchField
						label="Search parts"
						value={query}
						onChange={setQuery}
						onSubmit={() => shown[0]?.onSelect()}
						inputRef={searchRef}
						shortcut="/"
					/>
				</div>
			</div>

			<div className={styles.list} onScroll={() => hidePreview(true)}>
				{sections.length === 0 && <Hint>Nothing matches “{query.trim()}”.</Hint>}

				{sections.map((section) => (
					<CollapsibleSection
						key={section.id}
						label={section.label}
						icon={SECTION_ICONS[section.id]}
						count={section.items.length}
						// While searching every match shows, folded or not.
						open={searching || !memory.collapsed.includes(section.id)}
						onOpenChange={(open) => setSectionCollapsed(section.id, !open)}
					>
						<div className={styles.grid}>{section.items.map((item) => tile(item, section.id))}</div>
					</CollapsibleSection>
				))}
			</div>

			<ContextMenu
				open={menu !== null && menuItem !== undefined}
				onOpenChange={(open) => {
					if (!open) {
						setMenu(null);
					}
				}}
				x={menu?.x ?? 0}
				y={menu?.y ?? 0}
				title={menuItem?.name}
				subtitle={menuItem?.group}
			>
				{menuItem && (
					<Menu.Item
						icon={menuItem.kind ? "plus" : "edit"}
						label={menuItem.kind ? "Add where you're looking" : "Draw it"}
						onClick={() => use(menuItem)}
					/>
				)}

				{menuItem && (
					<Menu.CheckboxItem
						icon="star"
						label="Favourite"
						checked={memory.favourites.includes(menuItem.key)}
						onCheckedChange={() => toggleFavourite(menuItem.key)}
					/>
				)}
			</ContextMenu>

			{preview && !placing && <PartPreview kind={preview.kind} anchor={preview.anchor} />}
		</nav>
	);
};
