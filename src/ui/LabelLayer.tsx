import { memo } from "react";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { getPart, resolveLabelColor } from "#/parts/registry";
import {
	cardTouchHandover,
	labelSizes,
	registerLabelElement,
	registerLabelLeader,
} from "#/render/labelRegistry";
import { formatEntry } from "#/scene/format";
import type { TEntity } from "#/scene/schema";

import styles from "./LabelLayer.module.css";

/** Touches on a card pan, pinch and twist the world like touches on the ground. */
const handTouchToCamera = (event: PointerEvent) => {
	if (event.pointerType === "touch") {
		cardTouchHandover.current?.(event);
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
	const palette = usePalette();
	const part = getPart(entity.kind);
	return part ? resolveLabelColor(part, entity, palette) : palette.selection;
};

const LabelCard = memo(({ entity, selected }: { entity: TEntity; selected: boolean }) => {
	const data = useEditor((s) => s.scene.data);
	const select = useEditor((s) => s.select);
	const color = useLabelColor(entity);
	if (!entity.label) {
		return null;
	}

	const entries = entity.label.dataKeys.map((key) => ({
		key,
		entry: data.find((d) => d.key === key),
	}));
	const title = entity.label.title || entity.name || getPart(entity.kind)?.name || "";
	// The chip shows the main value, or the title when there's no data.
	const main = entries.length > 0 ? formatEntry(entries[0].entry) : title;
	const handlers = {
		onClick: () => select(entity.id),
		onPointerDown: (event: { nativeEvent: PointerEvent }) => handTouchToCamera(event.nativeEvent),
		onPointerCancel: (event: { nativeEvent: PointerEvent }) => handTouchToCamera(event.nativeEvent),
	};

	return (
		<div
			className={styles.anchor}
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
				ref={measured(entity.id, "card")}
				{...handlers}
			>
				<span className={styles.title}>
					<span className={styles.dot} style={{ background: color }} />

					{title}
				</span>

				{entries.length === 1 ? (
					<span className={styles.big}>{formatEntry(entries[0].entry)}</span>
				) : (
					entries.map(({ key, entry }) => (
						<span key={key} className={styles.row}>
							<span className={styles.rowLabel}>{entry?.label || key}</span>

							<span className={styles.rowValue}>{formatEntry(entry)}</span>
						</span>
					))
				)}
			</button>

			{/* Shown instead of the card where there's no room for it (LabelProjector sets data-compact). */}
			<button
				type="button"
				className={styles.chip}
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
	const labelled = entities.filter((entity) => entity.label?.enabled && !entity.hidden);

	return (
		// While drawing a road, cards let clicks through to the ground.
		<div className={styles.layer} data-drawing={drawing || undefined} data-label-layer="">
			<svg className={styles.leaders} aria-hidden="true">
				{labelled.map((entity) => (
					<LabelLeader key={entity.id} entity={entity} />
				))}
			</svg>

			{labelled.map((entity) => (
				<LabelCard key={entity.id} entity={entity} selected={entity.id === selectedId} />
			))}
		</div>
	);
};
