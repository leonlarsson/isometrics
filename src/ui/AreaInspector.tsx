import type { Draft } from "immer";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { AREA_TYPE_LABELS, areaColor, polygonArea } from "#/scene/areas";
import type { TArea, TAreaType } from "#/scene/schema";

import { IconButton, IconButtonGroup } from "./Button";
import {
	ColorField,
	Hint,
	Kbd,
	Section,
	SelectField,
	SliderField,
	TextField,
	VectorField,
} from "./fields";
import type { IInspectorTab } from "./inspectorTabs";
import { RipplesNote } from "./WaterSettings";

const TYPE_OPTIONS = (Object.keys(AREA_TYPE_LABELS) as TAreaType[]).map((value) => ({
	value,
	label: AREA_TYPE_LABELS[value],
}));

/** Position of the selected corner, with delete. */
const CornerPanel = ({ area, index }: { area: TArea; index: number }) => {
	const point = area.points[index];
	if (!point) {
		return null;
	}
	const store = () => useEditor.getState();
	return (
		<Section
			icon="pin"
			title={`Corner ${index + 1} of ${area.points.length}`}
			actions={
				<IconButton
					icon="trash"
					label="Delete corner (Del)"
					disabled={area.points.length <= 3}
					onClick={() => store().removeAreaPoint(area.id, index)}
				/>
			}
		>
			<VectorField
				label="Position"
				axes={["X", "Z"]}
				values={[point[0], point[1]]}
				onChange={(axis, value) => {
					const next: [number, number] = [point[0], point[1]];
					next[axis] = value;
					store().moveAreaPoint(area.id, index, next, {
						coalesce: `${area.id}:corner:${index}`,
					});
				}}
			/>
		</Section>
	);
};

/** Several selected corners (ADR-0065): deleting them together, and how to move them. */
const CornersPanel = ({ area, indices }: { area: TArea; indices: readonly number[] }) => {
	return (
		<Section
			icon="pin"
			title={`${indices.length} corners selected`}
			actions={
				<IconButton
					icon="trash"
					label="Delete them (Del)"
					disabled={area.points.length - indices.length < 3}
					onClick={() => useEditor.getState().removeSelectedPoints()}
				/>
			}
		>
			<Hint>
				Drag one of them to move them together, or press <Kbd>G</Kbd>. A <Kbd>Shift</Kbd>- or
				<Kbd>Ctrl</Kbd>-click adds a corner or takes it out, and <Kbd>B</Kbd> boxes more.
			</Hint>
		</Section>
	);
};

/** Every edit coalesces per area+field so typing or sliding is one undo step. */
const useAreaEdit = (area: TArea) => {
	const updateArea = useEditor((s) => s.updateArea);
	return (field: string, recipe: (a: Draft<TArea>) => void) =>
		updateArea(area.id, recipe, { coalesce: `${area.id}:${field}` });
};

/** The Area tab: its name and type. */
const AreaTab = ({ area }: { area: TArea }) => {
	const removeArea = useEditor((s) => s.removeArea);
	const edit = useAreaEdit(area);
	const size = Math.abs(polygonArea(area.points));

	return (
		<Section
			icon="area"
			title={`${AREA_TYPE_LABELS[area.type]} area`}
			actions={
				<IconButtonGroup>
					<IconButton
						icon={area.locked ? "lock" : "unlock"}
						label={area.locked ? "Unlock" : "Lock its shape"}
						pressed={area.locked}
						onClick={() =>
							edit("locked", (a) => {
								a.locked = !a.locked;
							})
						}
					/>

					<IconButton icon="trash" label="Delete area (Del)" onClick={() => removeArea(area.id)} />
				</IconButtonGroup>
			}
		>
			<TextField
				label="Name"
				value={area.name}
				placeholder={AREA_TYPE_LABELS[area.type]}
				onChange={(v) =>
					edit("name", (a) => {
						a.name = v;
					})
				}
			/>

			<SelectField<TAreaType>
				label="Type"
				value={area.type}
				options={TYPE_OPTIONS}
				onChange={(v) =>
					edit("type", (a) => {
						a.type = v;
					})
				}
			/>

			<Hint>
				{Math.round(size)} square units · {area.points.length} corners
			</Hint>
		</Section>
	);
};

/** The Shape tab: the selected corner, and how high the area is raised. */
const AreaShapeTab = ({ area }: { area: TArea }) => {
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const selectedPoints = useEditor((s) => s.selectedPointIndices);
	const edit = useAreaEdit(area);

	return (
		<>
			{selectedPoints.length > 1 ? (
				<CornersPanel area={area} indices={selectedPoints} />
			) : (
				selectedPoint !== null && <CornerPanel area={area} index={selectedPoint} />
			)}

			<Section
				id="area.shape"
				icon="spline"
				title="Whole area"
				keywords="shape corners raised height cliff"
			>
				<SliderField
					label="Raised by"
					value={area.height}
					min={0}
					max={10}
					step={0.25}
					onChange={(v) =>
						edit("height", (a) => {
							a.height = v;
						})
					}
				/>

				<Hint>
					With no corner selected, the arrows at its middle (or G, R, S and the arrow keys) move,
					turn and resize all of it. Drag corners to reshape, Shift- or Ctrl-click to select
					several, drag a small dot between two corners to add one, double-click a corner to remove
					it. Above 0, the area becomes raised ground with cliff sides.
				</Hint>
			</Section>
		</>
	);
};

/** The Look tab: the area's colour, and for water how rippled and mirroring it is. */
const AreaLookTab = ({ area }: { area: TArea }) => {
	const palette = usePalette();
	const edit = useAreaEdit(area);
	const worldWater = useEditor((s) => s.scene.water);

	return (
		<Section
			id="area.look"
			icon="palette"
			title="Look"
			keywords="colour color ripples water waves calm reflections mirror"
		>
			<ColorField
				label="Colour"
				value={areaColor(area, palette)}
				onChange={(v) =>
					edit("color", (a) => {
						a.color = v;
					})
				}
				inherit={{
					from: "default",
					inherited: area.color === null,
					onReset: () =>
						edit("color", (a) => {
							a.color = null;
						}),
				}}
			/>

			{area.type === "water_01" && (
				<>
					<SliderField
						label="Ripples on the water"
						value={Math.round((area.rippleStrength ?? worldWater.rippleStrength) * 100)}
						min={0}
						max={100}
						step={5}
						suffix="%"
						onChange={(v) =>
							edit("rippleStrength", (a) => {
								a.rippleStrength = v / 100;
							})
						}
						inherit={{
							from: "scene",
							inherited: area.rippleStrength === null,
							onReset: () =>
								edit("rippleStrength", (a) => {
									a.rippleStrength = null;
								}),
							value: `${Math.round(worldWater.rippleStrength * 100)}%`,
						}}
						hint="0% is mirror-calm, 100% choppy."
					/>

					<SliderField
						label="Reflections on the water"
						value={Math.round((area.reflectionStrength ?? worldWater.reflectionStrength) * 100)}
						min={0}
						max={100}
						step={5}
						suffix="%"
						onChange={(v) =>
							edit("reflectionStrength", (a) => {
								a.reflectionStrength = v / 100;
							})
						}
						inherit={{
							from: "scene",
							inherited: area.reflectionStrength === null,
							onReset: () =>
								edit("reflectionStrength", (a) => {
									a.reflectionStrength = null;
								}),
							value: `${Math.round(worldWater.reflectionStrength * 100)}%`,
						}}
						hint="How strongly it mirrors the world: 0% shows only its ripples catching the lights."
					/>

					<RipplesNote />
				</>
			)}
		</Section>
	);
};

/** The properties tabs for a selected area (ADR-0054). */
export const areaTabs = (area: TArea): IInspectorTab[] => [
	{ value: "object", label: "Area", icon: "area", content: <AreaTab key={area.id} area={area} /> },
	{
		value: "shape",
		label: "Shape",
		icon: "spline",
		content: <AreaShapeTab key={area.id} area={area} />,
	},
	{
		value: "look",
		label: "Look",
		icon: "palette",
		content: <AreaLookTab key={area.id} area={area} />,
	},
];
