import { findFreeSpot } from "#/editor/placement";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { partsByCategory, resolveColors } from "#/parts/registry";
import { CATEGORY_LABELS } from "#/parts/types";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TRoadStyle } from "#/scene/schema";

import styles from "./PartsPalette.module.css";

const ROAD_TOOLS: { style: TRoadStyle; description: string }[] = [
	{ style: "asphalt", description: "Paved road with a centre line" },
	{ style: "dirt", description: "Unpaved path" },
	{ style: "hidden", description: "Invisible route that vehicles follow, e.g. a forklift path" },
];

export const PartsPalette = () => {
	const addEntity = useEditor((s) => s.addEntity);
	const drawingStyle = useEditor((s) => s.drawing?.style ?? null);
	const startDrawing = useEditor((s) => s.startDrawing);
	const palette = usePalette();
	const roadSwatch: Record<TRoadStyle, string> = {
		asphalt: `linear-gradient(180deg, ${palette.road} 42%, ${palette.roadMark} 42% 58%, ${palette.road} 58%)`,
		dirt: palette.dirt,
		hidden: `repeating-linear-gradient(90deg, ${palette.selection} 0 5px, transparent 5px 9px)`,
	};

	return (
		<nav className={styles.palette} aria-label="Parts">
			<h2 className={styles.heading}>Add to scene</h2>

			<section className={styles.group}>
				<h3 className={styles.category}>Roads</h3>

				<div className={styles.grid}>
					{ROAD_TOOLS.map(({ style, description }) => (
						<button
							key={style}
							type="button"
							className={styles.part}
							title={`${description}. Click points on the ground; Enter to finish.`}
							aria-pressed={drawingStyle === style}
							onClick={() => startDrawing(style)}
						>
							<span
								className={styles.swatch}
								style={{ background: roadSwatch[style] }}
								aria-hidden="true"
							/>

							<span className={styles.name}>{ROAD_STYLE_LABELS[style]}</span>
						</button>
					))}
				</div>
			</section>

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
