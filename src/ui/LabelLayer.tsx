import { memo } from "react";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { getPart, resolveLabelColor } from "#/parts/registry";
import { registerLabelElement } from "#/render/labelRegistry";
import { formatEntry } from "#/scene/format";
import type { TEntity } from "#/scene/schema";

import styles from "./LabelLayer.module.css";

const LabelCard = memo(({ entity, selected }: { entity: TEntity; selected: boolean }) => {
	const data = useEditor((s) => s.scene.data);
	const select = useEditor((s) => s.select);
	const palette = usePalette();
	const part = getPart(entity.kind);
	if (!entity.label) {
		return null;
	}

	const color = part ? resolveLabelColor(part, entity, palette) : palette.selection;
	const entries = entity.label.dataKeys.map((key) => ({
		key,
		entry: data.find((d) => d.key === key),
	}));
	const title = entity.label.title || entity.name || part?.name;

	return (
		<div
			className={styles.anchor}
			ref={(element) => {
				registerLabelElement(entity.id, element);
				return () => registerLabelElement(entity.id, null);
			}}
		>
			<button
				type="button"
				className={styles.card}
				data-selected={selected || undefined}
				onClick={() => select(entity.id)}
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
		</div>
	);
});

/** DOM overlay holding every label card; positions are written by LabelProjector. */
export const LabelLayer = () => {
	const entities = useEditor((s) => s.scene.entities);
	const selectedId = useEditor((s) => s.selectedId);
	const drawing = useEditor((s) => s.drawing !== null);

	return (
		// While drawing a road, cards let clicks through to the ground.
		<div className={styles.layer} data-drawing={drawing || undefined}>
			{entities
				.filter((entity) => entity.label?.enabled)
				.map((entity) => (
					<LabelCard key={entity.id} entity={entity} selected={entity.id === selectedId} />
				))}
		</div>
	);
};
