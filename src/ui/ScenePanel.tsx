import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { roadColor } from "#/render/RoadMesh";
import { AREA_TYPE_LABELS, areaColor } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TDrivingSide, TThemePreference } from "#/scene/schema";
import { TEMPLATES } from "#/templates";

import { BackupsPanel } from "./BackupsPanel";
import { ColorField, Section, Select, SliderField, TextInput } from "./fields";
import { Icon } from "./Icon";

import styles from "./Fields.module.css";

export const ScenePanel = () => {
	const scene = useEditor((s) => s.scene);
	const commit = useEditor((s) => s.commit);
	const loadScene = useEditor((s) => s.loadScene);
	const resetView = useEditor((s) => s.resetView);
	const palette = usePalette();
	const selectedRoadId = useEditor((s) => s.selectedRoadId);
	const selectRoad = useEditor((s) => s.selectRoad);
	const selectedAreaId = useEditor((s) => s.selectedAreaId);
	const selectArea = useEditor((s) => s.selectArea);

	return (
		<>
			<Section title="World">
				<TextInput
					label="Title"
					value={scene.meta.title}
					onChange={(v) =>
						commit(
							(s) => {
								s.meta.title = v;
							},
							{ coalesce: "meta.title" },
						)
					}
				/>

				<TextInput
					label="Subtitle"
					value={scene.meta.subtitle}
					onChange={(v) =>
						commit(
							(s) => {
								s.meta.subtitle = v;
							},
							{ coalesce: "meta.subtitle" },
						)
					}
				/>

				<Select<TThemePreference>
					label="Theme"
					value={scene.theme}
					options={[
						{ value: "system", label: "Match device" },
						{ value: "light", label: "Light" },
						{ value: "dark", label: "Dark" },
					]}
					onChange={(v) =>
						commit((s) => {
							s.theme = v;
						})
					}
				/>
			</Section>

			<Section title="Ground">
				<SliderField
					label="Width"
					value={scene.ground.width}
					min={8}
					max={120}
					step={1}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.width = v;
							},
							{ coalesce: "ground.width" },
						)
					}
				/>

				<SliderField
					label="Depth"
					value={scene.ground.depth}
					min={8}
					max={120}
					step={1}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.depth = v;
							},
							{ coalesce: "ground.depth" },
						)
					}
				/>

				<ColorField
					label="Colour"
					value={scene.ground.color ?? palette.ground}
					isDefault={scene.ground.color === null}
					onChange={(v) =>
						commit(
							(s) => {
								s.ground.color = v;
							},
							{ coalesce: "ground.color" },
						)
					}
					onReset={() =>
						commit((s) => {
							s.ground.color = null;
						})
					}
				/>

				<button type="button" className={styles.smallButton} onClick={resetView}>
					<Icon name="focus" size={14} /> Re-centre camera
				</button>
			</Section>

			<Section title="Roads & traffic">
				<Select<TDrivingSide>
					label="Vehicles drive on the"
					value={scene.driving}
					options={[
						{ value: "right", label: "Right" },
						{ value: "left", label: "Left" },
					]}
					onChange={(v) =>
						commit((s) => {
							s.driving = v;
						})
					}
				/>

				{scene.roads.length === 0 ? (
					<p className={styles.hint}>No roads yet. Draw one from Add to scene → Roads.</p>
				) : (
					<ul className={styles.roadList}>
						{scene.roads.map((road) => (
							<li key={road.id}>
								<button
									type="button"
									className={styles.roadItem}
									aria-current={road.id === selectedRoadId || undefined}
									onClick={() => selectRoad(road.id)}
								>
									<span
										className={styles.roadSwatch}
										data-style={road.style}
										style={{
											background: road.style === "hidden" ? undefined : roadColor(road, palette),
										}}
									/>

									<span>{road.name || ROAD_STYLE_LABELS[road.style]}</span>

									<span className={styles.roadMeta}>{ROAD_STYLE_LABELS[road.style]}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</Section>

			<Section title="Areas">
				{scene.areas.length === 0 ? (
					<p className={styles.hint}>
						No areas yet. Draw water, grass, sand, plazas or raised land from Add to scene → Areas.
					</p>
				) : (
					<ul className={styles.roadList}>
						{scene.areas.map((area) => (
							<li key={area.id}>
								<button
									type="button"
									className={styles.roadItem}
									aria-current={area.id === selectedAreaId || undefined}
									onClick={() => selectArea(area.id)}
								>
									<span
										className={styles.roadSwatch}
										style={{ background: areaColor(area, palette) }}
									/>

									<span>{area.name || AREA_TYPE_LABELS[area.type]}</span>

									<span className={styles.roadMeta}>{AREA_TYPE_LABELS[area.type]}</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</Section>

			<BackupsPanel />

			<Section title="Start over">
				{TEMPLATES.map((template) => (
					<button
						key={template.id}
						type="button"
						className={styles.templateButton}
						onClick={() => {
							if (window.confirm(`Replace the current world with “${template.name}”?`)) {
								loadScene(template.create());
								resetView();
							}
						}}
					>
						<strong>{template.name}</strong>

						<span>{template.description}</span>
					</button>
				))}
			</Section>
		</>
	);
};
