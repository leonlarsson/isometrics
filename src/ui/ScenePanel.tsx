import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { roadColor } from "#/render/RoadMesh";
import { AREA_TYPE_LABELS, areaColor } from "#/scene/areas";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TDrivingSide, TThemePreference } from "#/scene/schema";

import { BackupsPanel } from "./BackupsPanel";
import { Button, ButtonGroup } from "./Button";
import { ColorField, Hint, Section, SelectField, SliderField, TextField } from "./fields";
import { List, ListItem } from "./List";

/** Dashed chip for hidden routes, which have no colour of their own. */
const HIDDEN_ROUTE_SWATCH =
	"repeating-linear-gradient(90deg, var(--accent) 0 4px, transparent 4px 7px)";

export const ScenePanel = () => {
	const scene = useEditor((s) => s.scene);
	const commit = useEditor((s) => s.commit);
	const resetView = useEditor((s) => s.resetView);
	const palette = usePalette();
	const selectedRoadId = useEditor((s) => s.selectedRoadId);
	const selectRoad = useEditor((s) => s.selectRoad);
	const selectedAreaId = useEditor((s) => s.selectedAreaId);
	const selectArea = useEditor((s) => s.selectArea);

	return (
		<>
			<Section title="World">
				<TextField
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

				<TextField
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

				<SelectField<TThemePreference>
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

				<ButtonGroup>
					<Button size="sm" icon="focus" onClick={resetView}>
						Re-centre camera
					</Button>
				</ButtonGroup>
			</Section>

			<Section title="Roads & traffic">
				<SelectField<TDrivingSide>
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
					<Hint>No roads yet. Draw one from Add to scene → Roads.</Hint>
				) : (
					<List>
						{scene.roads.map((road) => (
							<ListItem
								key={road.id}
								label={road.name || ROAD_STYLE_LABELS[road.style]}
								meta={ROAD_STYLE_LABELS[road.style]}
								swatch={road.style === "hidden" ? HIDDEN_ROUTE_SWATCH : roadColor(road, palette)}
								current={road.id === selectedRoadId}
								onClick={() => selectRoad(road.id)}
							/>
						))}
					</List>
				)}
			</Section>

			<Section title="Areas">
				{scene.areas.length === 0 ? (
					<Hint>
						No areas yet. Draw water, grass, sand, plazas or raised land from Add to scene → Areas.
					</Hint>
				) : (
					<List>
						{scene.areas.map((area) => (
							<ListItem
								key={area.id}
								label={area.name || AREA_TYPE_LABELS[area.type]}
								meta={AREA_TYPE_LABELS[area.type]}
								swatch={areaColor(area, palette)}
								current={area.id === selectedAreaId}
								onClick={() => selectArea(area.id)}
							/>
						))}
					</List>
				)}
			</Section>

			<BackupsPanel />
		</>
	);
};
