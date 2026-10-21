import { selectSelectedEntity, useEditor } from "#/editor/store";
import { getPart } from "#/parts/registry";
import { formatEntry } from "#/scene/format";

import { Icon } from "./Icon";

import styles from "./DetailSheet.module.css";

/** Bottom sheet with stat tiles for the entity clicked in view mode. */
export const DetailSheet = () => {
	const mode = useEditor((s) => s.mode);
	const entity = useEditor(selectSelectedEntity);
	const data = useEditor((s) => s.scene.data);
	const select = useEditor((s) => s.select);

	if (mode !== "view" || !entity) {
		return null;
	}

	const keys = entity.details.dataKeys.length
		? entity.details.dataKeys
		: (entity.label?.dataKeys ?? []);
	const title = entity.name || entity.label?.title || getPart(entity.kind)?.name || "Object";

	return (
		<aside className={styles.sheet} aria-label={`${title} details`}>
			<header className={styles.header}>
				<div>
					<h2 className={styles.title}>{title}</h2>

					{entity.details.description && (
						<p className={styles.description}>{entity.details.description}</p>
					)}
				</div>

				<button
					type="button"
					className={styles.close}
					aria-label="Close details"
					onClick={() => select(null)}
				>
					<Icon name="close" />
				</button>
			</header>

			{keys.length > 0 && (
				<div className={styles.tiles}>
					{keys.map((key) => {
						const entry = data.find((d) => d.key === key);
						return (
							<div key={key} className={styles.tile}>
								<span className={styles.value}>{formatEntry(entry)}</span>

								<span className={styles.label}>{entry?.label || key}</span>
							</div>
						);
					})}
				</div>
			)}
		</aside>
	);
};
