import { findFreeSpot } from "#/editor/placement";
import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { partsByCategory, resolveColors } from "#/parts/registry";
import { CATEGORY_LABELS } from "#/parts/types";
import { AREA_TYPE_LABELS } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TAreaType, TRoadStyle } from "#/scene/schema";

import { GroupLabel } from "./fields";
import { Tooltip } from "./Tooltip";

import styles from "./PartsPalette.module.css";

const ROAD_TOOLS: { style: TRoadStyle; description: string }[] = [
	{ style: "asphalt", description: "Paved road with a centre line" },
	{ style: "dirt", description: "Unpaved path" },
	{ style: "hidden", description: "Invisible route that vehicles follow, e.g. a forklift path" },
];

const AREA_TOOLS: { type: TAreaType; description: string }[] = [
	{ type: "water", description: "Sea, lake, harbour or pond" },
	{ type: "grass", description: "Lawn, park or field" },
	{ type: "sand", description: "Beach or sand" },
	{ type: "plaza", description: "Paved square, quay or car park" },
	{ type: "land", description: "Raised ground with cliff sides, e.g. a rock or plateau" },
];

export const PartsPalette = () => {
	const addEntity = useEditor((s) => s.addEntity);
	const drawingStyle = useEditor((s) => (s.drawing?.target === "road" ? s.drawing.style : null));
	const drawingArea = useEditor((s) => (s.drawing?.target === "area" ? s.drawing.areaType : null));
	const startDrawing = useEditor((s) => s.startDrawing);
	const startAreaDrawing = useEditor((s) => s.startAreaDrawing);
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
				<GroupLabel as="h3">Roads</GroupLabel>

				<div className={styles.grid}>
					{ROAD_TOOLS.map(({ style, description }) => (
						<Tooltip
							key={style}
							label={`${description}. Click points on the ground; Enter to finish.`}
							side="right"
						>
							<button
								type="button"
								className={styles.part}
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
						</Tooltip>
					))}
				</div>
			</section>

			<section className={styles.group}>
				<GroupLabel as="h3">Areas</GroupLabel>

				<div className={styles.grid}>
					{AREA_TOOLS.map(({ type, description }) => (
						<Tooltip
							key={type}
							label={`${description}. Click its corners on the ground; Enter to finish.`}
							side="right"
						>
							<button
								type="button"
								className={styles.part}
								aria-pressed={drawingArea === type}
								onClick={() => startAreaDrawing(type)}
							>
								<span
									className={styles.swatch}
									style={{ background: palette.areas[type] }}
									aria-hidden="true"
								/>

								<span className={styles.name}>{AREA_TYPE_LABELS[type]}</span>
							</button>
						</Tooltip>
					))}
				</div>
			</section>

			{partsByCategory().map(([category, parts]) => (
				<section key={category} className={styles.group}>
					<GroupLabel as="h3">{CATEGORY_LABELS[category]}</GroupLabel>

					<div className={styles.grid}>
						{parts.map((part) => {
							const { color, accent } = resolveColors(part, { color: null, accent: null }, palette);
							return (
								<Tooltip key={part.kind} label={part.description} side="right">
									<button
										type="button"
										className={styles.part}
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
								</Tooltip>
							);
						})}
					</div>
				</section>
			))}
		</nav>
	);
};
