import { findFreeSpot } from "#/editor/placement";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { partsByCategory, resolveColors } from "#/parts/registry";
import { CATEGORY_LABELS } from "#/parts/types";

import styles from "./PartsPalette.module.css";

export const PartsPalette = () => {
	const addEntity = useEditor((s) => s.addEntity);
	const palette = usePalette();

	return (
		<nav className={styles.palette} aria-label="Parts">
			<h2 className={styles.heading}>Add to scene</h2>

			{partsByCategory().map(([category, parts]) => (
				<section key={category} className={styles.group}>
					<h3 className={styles.category}>{CATEGORY_LABELS[category]}</h3>

					<div className={styles.grid}>
						{parts.map((part) => {
							const { color, accent } = resolveColors(part, { color: null, accent: null }, palette);
							return (
								<button
									key={part.kind}
									type="button"
									className={styles.part}
									title={part.description}
									onClick={() => {
										const scene = useEditor.getState().scene;
										addEntity({
											kind: part.kind,
											name: "",
											position: findFreeSpot(scene, part),
										});
									}}
								>
									<span
										className={styles.swatch}
										style={{ background: `linear-gradient(135deg, ${color} 55%, ${accent} 55%)` }}
										aria-hidden="true"
									/>

									<span className={styles.name}>{part.name}</span>
								</button>
							);
						})}
					</div>
				</section>
			))}
		</nav>
	);
};
