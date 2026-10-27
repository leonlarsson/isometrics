import { useHotkey } from "@tanstack/react-hotkeys";
import { type PointerEvent, type ReactElement, useEffect, useRef, useState } from "react";

import {
	rememberUsed,
	setPaletteCategory,
	setPaletteLayout,
	setSectionCollapsed,
	toggleFavourite,
	usePaletteMemory,
} from "#/editor/paletteMemory";
import { findFreeSpot } from "#/editor/placement";
import { setSidePaneOpen } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { useResolvedTheme, useThemePalette } from "#/editor/useTheme";
import { pastDragThreshold } from "#/lib/pointer";
import { resolvePartColors, swatchColors } from "#/parts/colorModel";
import { partName, partsByCategory } from "#/parts/registry";
import { CATEGORY_LABELS, type TPartCategory } from "#/parts/types";
import { usePartThumbnails } from "#/render/thumbnails";
import { currentView } from "#/render/viewpoints";
import { AREA_TYPE_LABELS, areaColor } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TAreaType, TRoadStyle } from "#/scene/schema";
import { groupByFamily } from "#/scene/variants";

import { IconButton, IconButtonGroup } from "./Button";
import { ChipGroup, type IChip } from "./ChipGroup";
import { CollapsibleSection } from "./CollapsibleSection";
import { Hint, SearchField } from "./fields";
import { releaseFocusAfterPointerClick } from "./focus";
import { Icon, type TIconName } from "./Icon";
import { CATEGORY_ICONS } from "./inspectorTabs";
import { ContextMenu, Menu } from "./Menu";
import { PaneHeader } from "./PaneHeader";
import { type IPreviewAnchor, PartPreview } from "./PartPreview";
import { Tooltip } from "./Tooltip";
import { useNarrowLayout } from "./useNarrowLayout";

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

/** What the chips choose between: roads, areas, then the parts' categories. */
type TPaletteCategory = "roads" | "areas" | TPartCategory;

/** Without icons, so they take few rows in the narrow panel; the section's heading has one. */
const CHIPS: IChip<TPaletteCategory>[] = [
	{ value: "roads", label: "Roads" },
	{ value: "areas", label: "Areas" },
	...partsByCategory().map(([category]) => ({ value: category, label: CATEGORY_LABELS[category] })),
];

/** Shown until another chip is chosen. */
const FIRST_CATEGORY: TPaletteCategory = "buildings";

interface IPaletteItem {
	key: string;
	/** Its chip. */
	category: TPaletteCategory;
	group: string;
	name: string;
	/** Its family's name, for a tile that holds all the family's variants ("Race car", not "Race car 2"). */
	familyName: string;
	/** What it is, under its name in the list. */
	description: string;
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

/** A family's tile: it adds its first variant, and opens to show them all. */
interface IFamilyOfTile {
	/** Its family's id among the palette's keys ("part:race_car"). */
	id: string;
	variants: number;
	open: boolean;
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
	const palette = useThemePalette();
	const thumbnails = usePartThumbnails(useResolvedTheme());
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	// Set once a press turned into a drag, so the click that may follow doesn't add a second copy.
	const dragged = useRef(false);
	const [preview, setPreview] = useState<{ kind: string; anchor: IPreviewAnchor } | null>(null);
	const previewTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const placing = useEditor((s) => s.placingKind !== null);
	const narrow = useNarrowLayout();
	const memory = usePaletteMemory();
	const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null);
	/** The family whose variants are shown, by its id ("part:race_car"). */
	const [openFamily, setOpenFamily] = useState<string | null>(null);

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
			category: "roads" as const,
			group: "Roads",
			name: ROAD_STYLE_LABELS[style],
			familyName: ROAD_STYLE_LABELS[style],
			description,
			tooltip: `${description}. Click points on the ground; Enter to finish.`,
			searchText: `${description} ${keywords} road`,
			swatch: roadSwatch[style],
			pressed: drawingStyle === style,
			onSelect: () => startDrawing(style),
		})),
		...AREA_TOOLS.map(({ type, description, keywords }) => ({
			key: `area:${type}`,
			category: "areas" as const,
			group: "Areas",
			name: AREA_TYPE_LABELS[type],
			familyName: AREA_TYPE_LABELS[type],
			description,
			tooltip: `${description}. Click its corners on the ground; Enter to finish.`,
			searchText: `${description} ${keywords} area`,
			swatch: areaColor({ type, color: null }, palette),
			pressed: drawingArea === type,
			onSelect: () => startAreaDrawing(type),
		})),
		...partsByCategory().flatMap(([category, parts]) =>
			parts.map((part) => {
				const { first, second } = swatchColors(resolvePartColors(part, palette), part);
				return {
					key: `part:${part.kind}`,
					category,
					group: CATEGORY_LABELS[category],
					name: partName(part),
					familyName: part.name,
					description: part.description,
					tooltip: `${part.description}. Click to add, or drag onto the scene.`,
					searchText: `${part.description} ${(part.keywords ?? []).join(" ")}`,
					swatch: `linear-gradient(135deg, ${first} 55%, ${second} 55%)`,
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
	const category = CHIPS.find((chip) => chip.value === memory.category)?.value ?? FIRST_CATEGORY;
	const categoryItems = items.filter((item) => item.category === category);
	// Favourites and recently used first, then the chosen category; while searching, the matches
	// in every category are what count.
	const sections = [
		...(searching
			? [...new Set(shown.map((item) => item.group))].map((group) => ({
					id: group,
					label: group,
					items: shown.filter((item) => item.group === group),
				}))
			: [
					{ id: "favourites", label: "Favourites", items: pick(memory.favourites) },
					{ id: "recent", label: "Recently used", items: pick(memory.recent) },
					{
						id: categoryItems[0]?.group ?? category,
						label: categoryItems[0]?.group ?? category,
						items: categoryItems,
						byFamily: true,
					},
				]),
	].filter((section) => section.items.length > 0);
	const menuItem = menu ? byKey.get(menu.key) : undefined;

	const tile = (item: IPaletteItem, section: string, family?: IFamilyOfTile) => {
		const favourite = memory.favourites.includes(item.key);
		const name = family ? item.familyName : item.name;
		return (
			<div
				key={`${section}:${item.key}`}
				className={styles.tile}
				data-family={family ? "" : undefined}
			>
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

						<span className={styles.text}>
							<span className={styles.name}>{name}</span>

							{/* Out of the name: the variants button says it, and parts' descriptions are their aria-description. */}
							{family && (
								<span className={styles.meta} aria-hidden="true">
									{`${family.variants} variants`}
								</span>
							)}

							<span className={styles.description} aria-hidden="true">
								{item.description}
							</span>
						</span>

						{item.kind && (
							<span className={styles.grip} aria-hidden="true">
								<Icon name="grip" size={14} />
							</span>
						)}
					</button>
				</TileTooltip>

				{family && (
					<span className={styles.variantsButton}>
						<IconButton
							icon="layers"
							label={
								family.open
									? `Hide the variants of ${item.familyName}`
									: `Show the ${family.variants} variants of ${item.familyName}`
							}
							pressed={family.open}
							onClick={() => setOpenFamily(family.open ? null : family.id)}
						/>
					</span>
				)}

				<span className={styles.star} data-on={favourite || undefined}>
					<IconButton
						icon="star"
						label={favourite ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
						pressed={favourite}
						onClick={() => toggleFavourite(item.key)}
					/>
				</span>
			</div>
		);
	};

	/** A tile per family, opening to show its variants underneath (ADR-0088). */
	const familyTiles = (list: IPaletteItem[], section: string) =>
		groupByFamily(list, (item) => item.key).flatMap(({ family, variants }) => {
			const [first] = variants;
			if (variants.length === 1) {
				return [tile(first, section)];
			}
			const open = openFamily === family;
			return [
				tile(first, section, { id: family, variants: variants.length, open }),
				...(open
					? [
							<div key={`${section}:${family}:variants`} className={styles.variants}>
								<span className={styles.variantsTitle}>{`${first.familyName}: every variant`}</span>

								<div className={styles.grid}>
									{variants.map((item) => tile(item, `${section}:${family}`))}
								</div>
							</div>,
						]
					: []),
			];
		});

	return (
		<nav className={styles.palette} aria-label="Parts">
			<PaneHeader
				icon="plusSquare"
				title="Add to scene"
				actions={
					<IconButtonGroup>
						<IconButton
							icon="grid"
							label="Show as a grid"
							pressed={memory.layout === "grid"}
							onClick={() => setPaletteLayout("grid")}
						/>

						<IconButton
							icon="list"
							label="Show as a list"
							pressed={memory.layout === "list"}
							onClick={() => setPaletteLayout("list")}
						/>
					</IconButtonGroup>
				}
				// Phones have the sheet, which hides on its own.
				fold={
					narrow
						? undefined
						: {
								side: "left",
								label: "Hide Add to scene",
								onFold: () => setSidePaneOpen("left", false),
							}
				}
			/>

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

				{/* One category at a time; a search looks through them all. */}
				{!searching && (
					<div className={styles.chips}>
						<ChipGroup
							label="Category"
							size="sm"
							value={category}
							onChange={setPaletteCategory}
							chips={CHIPS}
						/>
					</div>
				)}

				{/* Every part with its colours, lights and settings, in a tab of its own (ADR-0087). */}
				<a className={styles.catalogue} href="/parts" target="_blank" rel="noreferrer">
					<Icon name="cube" size={14} />
					Browse all parts
					<Icon name="newTab" size={13} />
				</a>
			</div>

			<div className={styles.list} data-layout={memory.layout} onScroll={() => hidePreview(true)}>
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
						<div className={styles.grid}>
							{"byFamily" in section
								? familyTiles(section.items, section.id)
								: section.items.map((item) => tile(item, section.id))}
						</div>
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
