import { useHotkey } from "@tanstack/react-hotkeys";
import { type PointerEvent, useRef, useState } from "react";

import { findFreeSpot } from "#/editor/placement";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { pastDragThreshold } from "#/lib/pointer";
import { partsByCategory, resolveColors } from "#/parts/registry";
import { CATEGORY_LABELS } from "#/parts/types";
import { AREA_TYPE_LABELS } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TAreaType, TRoadStyle } from "#/scene/schema";

import { GroupLabel, Hint, SearchField } from "./fields";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

import styles from "./PartsPalette.module.css";

const ROAD_TOOLS: { style: TRoadStyle; description: string; keywords: string }[] = [
	{ style: "asphalt", description: "Paved road with a centre line", keywords: "street" },
	{ style: "dirt", description: "Unpaved path", keywords: "trail footpath track" },
	{
		style: "hidden",
		description: "Invisible route that vehicles follow, e.g. a forklift path",
		keywords: "path track ferry route",
	},
];

const AREA_TOOLS: { type: TAreaType; description: string; keywords: string }[] = [
	{ type: "water", description: "Sea, lake, harbour or pond", keywords: "river ocean bay" },
	{ type: "grass", description: "Lawn, park or field", keywords: "garden meadow green" },
	{ type: "sand", description: "Beach or sand", keywords: "desert dune" },
	{ type: "plaza", description: "Paved square, quay or car park", keywords: "parking pavement" },
	{
		type: "land",
		description: "Raised ground with cliff sides, e.g. a rock or plateau",
		keywords: "hill mountain cliff terrain",
	},
];

interface IPaletteItem {
	key: string;
	group: string;
	name: string;
	/** What the tooltip says. */
	tooltip: string;
	/** Extra text the search matches: description and everyday words. */
	searchText: string;
	/** CSS background for the tile's chip. */
	swatch: string;
	/** Highlighted while this tool is active (drawing this road or area). */
	pressed?: boolean;
	/** Part kind, for items that can also be dragged onto the scene. */
	kind?: string;
	onSelect: () => void;
}

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
 * The "Add to scene" panel: roads and areas to draw, parts to place, with a
 * search. Clicking a part adds it at a free spot; dragging it onto the scene
 * places it there (render/PlacementPreview shows it under the cursor).
 */
export const PartsPalette = () => {
	const addEntity = useEditor((s) => s.addEntity);
	const drawingStyle = useEditor((s) => (s.drawing?.target === "road" ? s.drawing.style : null));
	const drawingArea = useEditor((s) => (s.drawing?.target === "area" ? s.drawing.areaType : null));
	const startDrawing = useEditor((s) => s.startDrawing);
	const startAreaDrawing = useEditor((s) => s.startAreaDrawing);
	const palette = usePalette();
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	// Set once a press turned into a drag, so the click that may follow doesn't add a second copy.
	const dragged = useRef(false);

	useHotkey("/", () => searchRef.current?.focus(), { meta: { name: "Search parts" } });

	const roadSwatch: Record<TRoadStyle, string> = {
		asphalt: `linear-gradient(180deg, ${palette.road} 42%, ${palette.roadMark} 42% 58%, ${palette.road} 58%)`,
		dirt: palette.dirt,
		hidden: `repeating-linear-gradient(90deg, ${palette.selection} 0 5px, transparent 5px 9px)`,
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
			swatch: palette.areas[type],
			pressed: drawingArea === type,
			onSelect: () => startAreaDrawing(type),
		})),
		...partsByCategory().flatMap(([category, parts]) =>
			parts.map((part) => {
				const { color, accent } = resolveColors(part, { color: null, accent: null }, palette);
				return {
					key: `part:${part.kind}`,
					group: CATEGORY_LABELS[category],
					name: part.name,
					tooltip: `${part.description}. Click to add, or drag onto the scene.`,
					searchText: `${part.description} ${(part.keywords ?? []).join(" ")}`,
					swatch: `linear-gradient(135deg, ${color} 55%, ${accent} 55%)`,
					kind: part.kind,
					onSelect: () => {
						const scene = useEditor.getState().scene;
						addEntity({ kind: part.kind, name: "", position: findFreeSpot(scene, part) });
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

	const shown = query.trim() ? items.filter((item) => matches(item, query)) : items;
	const groups = [...new Set(shown.map((item) => item.group))];

	return (
		<nav className={styles.palette} aria-label="Parts">
			<h2 className={styles.heading}>Add to scene</h2>

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

			{groups.length === 0 && <Hint>Nothing matches “{query.trim()}”.</Hint>}

			{groups.map((group) => (
				<section key={group} className={styles.group}>
					<GroupLabel as="h3">{group}</GroupLabel>

					<div className={styles.grid}>
						{shown
							.filter((item) => item.group === group)
							.map((item) => (
								<Tooltip key={item.key} label={item.tooltip} side="right">
									<button
										type="button"
										className={styles.part}
										data-draggable={item.kind ? "" : undefined}
										aria-pressed={item.pressed}
										onPointerDown={(event) => {
											if (item.kind) {
												watchDrag(item.kind, event);
											}
										}}
										onClick={() => {
											if (!dragged.current) {
												item.onSelect();
											}
										}}
									>
										<span
											className={styles.swatch}
											style={{ background: item.swatch }}
											aria-hidden="true"
										/>

										<span className={styles.name}>{item.name}</span>

										{item.kind && (
											<span className={styles.grip} aria-hidden="true">
												<Icon name="grip" size={14} />
											</span>
										)}
									</button>
								</Tooltip>
							))}
					</div>
				</section>
			))}
		</nav>
	);
};
