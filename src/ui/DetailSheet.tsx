import { selectSelectedEntity, useEditor } from "#/editor/store";
import { getPart } from "#/parts/registry";
import { formatEntry } from "#/scene/format";

import { ButtonGroup, IconButton } from "./Button";
import { CameraFollowButtons } from "./CameraFollowBar";

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

				<IconButton icon="close" label="Close details" size="md" onClick={() => select(null)} />
			</header>

			{entity.follow && (
				<ButtonGroup>
					<CameraFollowButtons entityId={entity.id} />
				</ButtonGroup>
			)}

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
