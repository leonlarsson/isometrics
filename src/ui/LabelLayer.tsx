import { memo } from "react";

import { drawnModeOf, useEditor } from "#/editor/store";
import { useStory } from "#/editor/story";
import { useThemePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { pastDragThreshold } from "#/lib/pointer";
import { resolveLabelColor } from "#/parts/colorModel";
import { valuesOfEntity } from "#/parts/propData";
import { getPart, partNameOf } from "#/parts/registry";
import { openContextMenuUnlessDragged } from "#/render/contextMenu";
import {
	cardEventHandover,
	labelSizes,
	registerLabelElement,
	registerLabelLeader,
} from "#/render/labelRegistry";
import { columnOfKey } from "#/scene/rowData";
import type { TEntity } from "#/scene/schema";

import { DataReading, FlagBadge, shownEntry } from "./DataReading";
import { formatWhen } from "./Sparkline";

import styles from "./LabelLayer.module.css";

/** Where the last press on a card started, so the click that ends a drag doesn't select. */
let press: { clientX: number; clientY: number } | null = null;

/**
 * A press on a card is handed to the camera, so dragging pans or orbits the
 * world, and pinching zooms it, as on the ground; a click still selects.
 */
const handPressToCamera = (event: PointerEvent) => {
	if (event.type === "pointerdown") {
		press = { clientX: event.clientX, clientY: event.clientY };
	}
	cardEventHandover.current?.(event);
};

/** Whether the press that ended at `event` moved far enough to be a drag of the world. */
const endedADrag = (event: { clientX: number; clientY: number }) =>
	press !== null && pastDragThreshold(press, event);

/**
 * The wheel over a card zooms the world, as over the ground. A native listener,
 * because React's wheel handlers are passive and can't stop the page scrolling.
 */
const onLayerWheel = (event: WheelEvent) => {
	if (event.target instanceof Element && event.target.closest("[data-label-part]")) {
		event.preventDefault();
		cardEventHandover.current?.(event);
	}
};

type TLabelPart = "card" | "chip";

/**
 * One observer for every card and chip: records its size on screen for the
 * layout (LabelProjector), so the layout never has to measure mid-frame. A part
 * that's hidden (size 0) keeps the size it had when it was last shown.
 */
const sizeObserver =
	typeof ResizeObserver === "undefined"
		? null
		: new ResizeObserver((entries) => {
				for (const { target } of entries) {
					const element = target as HTMLElement;
					const id = element.dataset.labelId;
					const part = element.dataset.labelPart as TLabelPart | undefined;
					const { width, height } = element.getBoundingClientRect();
					if (!id || !part || width === 0) {
						continue;
					}
					labelSizes.set(id, { ...labelSizes.get(id), [part]: { width, height } });
				}
			});

/** Ref for a card or chip: measured while it's mounted. */
const measured = (id: string, part: TLabelPart) => (element: HTMLElement | null) => {
	if (!element) {
		return;
	}
	element.dataset.labelId = id;
	element.dataset.labelPart = part;
	sizeObserver?.observe(element);
	return () => sizeObserver?.unobserve(element);
};

const useLabelColor = (entity: TEntity) => {
	const palette = useThemePalette();
	const data = valuesOfEntity(entity, useWorldData());
	const part = getPart(entity.kind);
	return part ? resolveLabelColor(part, entity, palette, data) : palette.selection;
};

const LabelCard = memo(({ entity, selected }: { entity: TEntity; selected: boolean }) => {
	const data = valuesOfEntity(entity, useWorldData());
	const select = useEditor((s) => s.select);
	const color = useLabelColor(entity);
	const entries = entity.label.dataKeys.map((key) => ({
		key,
		entry: data.find((d) => d.key === key),
	}));
	const title = entity.label.title || entity.name || partNameOf(entity.kind) || "";
	// A story shows the data as it was on a date (ADR-0114): the card says when.
	const storyAt = useStory((s) => s.at);
	const inView = useEditor((s) => s.mode === "view");
	// Only cards whose values have a past change with the story; the others say nothing of it.
	const followsStory = entries.some(({ entry }) => !entry || entry.history.length > 0);
	const when = storyAt !== null && inView && followsStory ? formatWhen(storyAt) : null;
	// Nothing to show for any of its values: the card says so, greyed (ADR-0110).
	const hasNoData = entries.length > 0 && entries.every(({ entry }) => !entry);
	// The chip shows the main value ("no data" without one), or the title when it shows no values.
	const main = entries.length > 0 ? shownEntry(entries[0].entry) : title;
	const handlers = {
		onClick: (event: { clientX: number; clientY: number }) => {
			if (!endedADrag(event)) {
				select(entity.id);
			}
		},
		onPointerDown: (event: { nativeEvent: PointerEvent }) => handPressToCamera(event.nativeEvent),
		onPointerCancel: (event: { nativeEvent: PointerEvent }) => handPressToCamera(event.nativeEvent),
		// Right-click: the object's menu; right-drag orbits like on the ground (no browser menu either way).
		onContextMenu: (event: { nativeEvent: MouseEvent }) =>
			openContextMenuUnlessDragged(
				{ kind: "entity", id: entity.id },
				event.nativeEvent,
				endedADrag(event.nativeEvent),
			),
	};

	return (
		<div
			className={styles.anchor}
			data-shows-as-chip={entity.label.showsAsChip || undefined}
			ref={(element) => {
				registerLabelElement(entity.id, element);
				return () => {
					registerLabelElement(entity.id, null);
					labelSizes.delete(entity.id);
				};
			}}
		>
			<button
				type="button"
				className={styles.card}
				data-selected={selected || undefined}
				data-no-data={hasNoData || undefined}
				ref={measured(entity.id, "card")}
				{...handlers}
			>
				<span className={styles.title}>
					<span className={styles.dot} style={{ background: color }} />

					{title}

					{entity.label.tag && <span className={styles.tag}>{entity.label.tag}</span>}
				</span>

				{when && <span className={styles.when}>{when}</span>}

				{entries.length === 1 ? (
					<DataReading
						entry={entries[0].entry}
						label={columnOfKey(entries[0].key) ?? entries[0].key}
						size={selected ? "huge" : "big"}
						// What the value means, under it ("Deliveries so far"), so a total doesn't read as
						// the month's; left out where the card's title already says it.
						showsMeaning={
							selected ||
							(entries[0].entry?.name || columnOfKey(entries[0].key) || entries[0].key) !== title
						}
						// A row's card stays compact among many until it's opened; a world value's shows its past.
						showsPast={selected || columnOfKey(entries[0].key) === null}
					/>
				) : (
					entries.map(({ key, entry }) => (
						<span key={key} className={styles.row}>
							<span className={styles.rowLabel}>{entry?.name || columnOfKey(key) || key}</span>

							<span className={styles.rowValue} data-no-data={entry ? undefined : ""}>
								{shownEntry(entry)}
							</span>

							{entry && <FlagBadge entry={entry} />}
						</span>
					))
				)}
			</button>

			{/* Shown instead of the card where there's no room for it (LabelProjector sets data-compact). */}
			<button
				type="button"
				className={styles.chip}
				data-no-data={hasNoData || undefined}
				aria-label={main === title ? title : `${title}: ${main}`}
				ref={measured(entity.id, "chip")}
				{...handlers}
			>
				<span className={styles.dot} style={{ background: color }} />

				{main}
			</button>
		</div>
	);
});

/** The dashed line from an object's pin to its card; LabelProjector sets its ends. */
const LabelLeader = memo(({ entity }: { entity: TEntity }) => {
	const color = useLabelColor(entity);
	return (
		<line
			className={styles.leader}
			stroke={color}
			ref={(element) => {
				registerLabelLeader(entity.id, element);
				return () => registerLabelLeader(entity.id, null);
			}}
		/>
	);
});

/** DOM overlay holding every label card and leader line; positions are written by LabelProjector. */
export const LabelLayer = () => {
	const entities = useEditor((s) => s.scene.entities);
	const selectedId = useEditor((s) => s.selectedId);
	const drawing = useEditor((s) => s.drawing !== null);
	// The world can hide every card from View mode (World tab → Shown in View mode); Edit mode still
	// shows them, faded, so they can be worked on.
	const cardsInView = useEditor((s) => s.scene.onScreen.showsLabelCards);
	const editing = useEditor((s) => drawnModeOf(s) === "edit");
	// A picture with its cards (ADR-0084) shows them even where the world hides them in View mode.
	const cardsInPicture = useEditor((s) => s.stillRender?.showsCards ?? false);
	const rendering = useEditor((s) => s.stillRender !== null);
	const labelled =
		cardsInView || editing || cardsInPicture
			? entities.filter((entity) => entity.label.isShown && !entity.isHidden)
			: [];

	return (
		// While drawing a road, cards let clicks through to the ground.
		<div
			className={styles.layer}
			data-drawing={drawing || undefined}
			data-hidden-in-view={(!cardsInView && editing) || undefined}
			data-label-layer=""
			ref={(element) => {
				element?.addEventListener("wheel", onLayerWheel, { passive: false });
				return () => element?.removeEventListener("wheel", onLayerWheel);
			}}
		>
			<svg className={styles.leaders} aria-hidden="true">
				{labelled.map((entity) => (
					<LabelLeader key={entity.id} entity={entity} />
				))}
			</svg>

			{labelled.map((entity) => (
				<LabelCard
					key={entity.id}
					entity={entity}
					selected={!rendering && entity.id === selectedId}
				/>
			))}
		</div>
	);
};
