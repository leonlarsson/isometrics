import type { Draft } from "immer";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import {
	AREA_KIND_LABELS,
	AREA_KINDS,
	cornerLift,
	cornerTop,
	MAX_CORNER_LIFT,
	polygonArea,
	takesCornerHeights,
} from "#/scene/areas";
import { changeColorSetting } from "#/scene/objectSettings";
import type { TArea, TAreaKind } from "#/scene/schema";

import { Button, ButtonGroup, IconButton, IconButtonGroup } from "./Button";
import { FollowDataNote } from "./FollowDataNote";
import {
	Hint,
	Kbd,
	resetToDefault,
	Section,
	SelectField,
	SliderField,
	TextField,
	VectorField,
} from "./fields";
import type { IInspectorTab } from "./inspectorTabs";
import { ColorSettingFields } from "./PartSettings";
import { RipplesNote } from "./WaterSettings";

const TYPE_OPTIONS = (Object.keys(AREA_KIND_LABELS) as TAreaKind[]).map((value) => ({
	value,
	label: AREA_KIND_LABELS[value],
}));

/** Position and height of the selected corner, with delete. */
const CornerPanel = ({ area, index }: { area: TArea; index: number }) => {
	const point = area.points[index];
	if (!point) {
		return null;
	}
	const store = () => useEditor.getState();
	const liftable = takesCornerHeights(area);
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
				hasNoDefault
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

			<SliderField
				label="Altitude"
				value={cornerTop(area, point)}
				min={0}
				max={Math.min(15, area.height + MAX_CORNER_LIFT)}
				step={0.25}
				onChange={(top) =>
					store().setAreaCornerHeight(area.id, index, top, {
						coalesce: `${area.id}:corner:${index}:height`,
					})
				}
				disabled={!liftable}
				// Water's corners always stand at the area's height (ADR-0096).
				inherit={{
					from: "area",
					inherited: !liftable || cornerLift(point) === 0,
					onReset: () => store().setAreaCornerHeight(area.id, index, area.height),
					value: String(area.height),
				}}
				hint={
					liftable
						? "Corners at different heights make slopes and ramps; a corner at 0 meets the ground."
						: "Water stays level, so its corners have no heights of their own: raise all of it with Raised by, under Whole area."
				}
			/>

			{liftable && (
				<Hint>
					Lift it with the green arrow, or press <Kbd>G</Kbd> then <Kbd>Y</Kbd>.
				</Hint>
			)}
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
				Drag one of them to move them together, or press <Kbd>G</Kbd>. Lift them together with the
				green arrow, or <Kbd>G</Kbd> then <Kbd>Y</Kbd>. A <Kbd>Shift</Kbd>- or <Kbd>Ctrl</Kbd>-click
				adds a corner or takes it out, and <Kbd>B</Kbd> boxes more.
			</Hint>
		</Section>
	);
};

/** The selected peak (ADR-0101): where it is, how high, and delete. */
const PeakPanel = ({ area, index }: { area: TArea; index: number }) => {
	const peak = area.peaks[index];
	if (!peak) {
		return null;
	}
	const store = () => useEditor.getState();
	const coalesce = (field: string) => ({ coalesce: `${area.id}:peak:${index}:${field}` });
	return (
		<Section
			icon="pin"
			title={`Peak ${index + 1} of ${area.peaks.length}`}
			actions={
				<IconButton
					icon="trash"
					label="Delete peak (Del)"
					onClick={() => store().removeAreaPeak(area.id, index)}
				/>
			}
		>
			<VectorField
				hasNoDefault
				label="Position"
				axes={["X", "Z"]}
				values={[peak[0], peak[1]]}
				onChange={(axis, value) => {
					const next: [number, number] = [peak[0], peak[1]];
					next[axis] = value;
					store().moveAreaPeak(area.id, index, next, coalesce("position"));
				}}
			/>

			<SliderField
				inherit={{
					from: "area",
					inherited: peak[2] === 0,
					onReset: () => store().setAreaPeakHeight(area.id, index, area.height),
					value: `${area.height}`,
				}}
				label="Altitude"
				value={cornerTop(area, peak)}
				min={0}
				max={Math.min(15, area.height + MAX_CORNER_LIFT)}
				step={0.25}
				onChange={(top) => store().setAreaPeakHeight(area.id, index, top, coalesce("height"))}
				hint="The top rises to it from the corners round it: a hill, or a hollow below the area's height."
			/>

			<Hint>
				Drag it to move it, lift it with the green arrow. <Kbd>Del</Kbd> removes it.
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
			title={`${AREA_KIND_LABELS[area.kind]} area`}
			actions={
				<IconButtonGroup>
					<IconButton
						icon={area.isLocked ? "lock" : "unlock"}
						label={area.isLocked ? "Unlock" : "Lock its shape"}
						pressed={area.isLocked}
						onClick={() =>
							edit("locked", (a) => {
								a.isLocked = !a.isLocked;
							})
						}
					/>

					<IconButton icon="trash" label="Delete area (Del)" onClick={() => removeArea(area.id)} />
				</IconButtonGroup>
			}
		>
			<TextField
				inherit={resetToDefault(
					area.name,
					"",
					() =>
						edit("name", (a) => {
							a.name = "";
						}),
					AREA_KIND_LABELS[area.kind],
				)}
				label="Name"
				value={area.name}
				placeholder={AREA_KIND_LABELS[area.kind]}
				onChange={(v) =>
					edit("name", (a) => {
						a.name = v;
					})
				}
			/>

			<SelectField<TAreaKind>
				hasNoDefault
				label="Kind"
				value={area.kind}
				options={TYPE_OPTIONS}
				onChange={(v) =>
					edit("type", (a) => {
						a.kind = v;
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
	const selectedPeak = useEditor((s) => s.selectedPeakIndex);
	const edit = useAreaEdit(area);
	const liftable = takesCornerHeights(area);

	return (
		<>
			{selectedPeak !== null && <PeakPanel area={area} index={selectedPeak} />}

			{selectedPoints.length > 1 ? (
				<CornersPanel area={area} indices={selectedPoints} />
			) : (
				selectedPoint !== null && <CornerPanel area={area} index={selectedPoint} />
			)}

			<Section
				id="area.shape"
				icon="spline"
				title="Whole area"
				keywords="shape corners raised height cliff slope ramp hill lift peak hollow"
			>
				<SliderField
					inherit={resetToDefault(area.height, AREA_KINDS[area.kind].startHeight, () =>
						edit("height", (a) => {
							a.height = AREA_KINDS[a.kind].startHeight;
						}),
					)}
					label="Height"
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
					lift, turn and resize all of it. Drag corners to reshape, Shift- or Ctrl-click to select
					several, drag a small dot between two corners to add one, double-click a corner to remove
					it. Above 0, the area becomes raised ground with cliff sides; select a corner to give it a
					height of its own, for slopes and ramps.
				</Hint>

				<ButtonGroup>
					<Button
						size="sm"
						icon="plus"
						disabled={!liftable}
						onClick={() => useEditor.getState().addAreaPeak(area.id)}
					>
						Add a peak
					</Button>
				</ButtonGroup>

				<Hint>
					{liftable
						? "A peak is a point inside it with a height of its own: the top rises to it from the corners, for round hills (or dips, for hollows). Also: right-click the area, Add a peak here, or double-click it once it's selected."
						: "Water stays level, so it has no peaks: raise all of it with Raised by."}
				</Hint>
			</Section>
		</>
	);
};

/** The Look tab: the area's colour (by hand or from data), and for water how rippled and mirroring it is. */
const AreaLookTab = ({ area }: { area: TArea }) => {
	const palette = usePalette();
	const data = useWorldData().values;
	const edit = useAreaEdit(area);
	const worldWater = useEditor((s) => s.scene.water);
	const [surface] = AREA_KINDS[area.kind].colors;

	return (
		<>
			<FollowDataNote title="Its colour can follow data">
				An area's colour can come from a value in the Data tab: a value holding a colour (red,
				#ff0000), or a number on a colour scale, like a district that turns red as demand rises.
			</FollowDataNote>

			<Section
				id="area.look"
				icon="palette"
				title="Look"
				keywords="colour color ripples water waves calm reflections mirror data heatmap"
			>
				<ColorSettingFields
					spec={surface}
					setting={area.colors[surface.id]}
					data={data}
					palette={palette}
					onChange={(change, field) =>
						edit(`color:${field ?? performance.now()}`, (a) => {
							changeColorSetting(a.colors, surface.id, change);
						})
					}
				/>

				{area.kind === "water_01" && (
					<>
						<SliderField
							label="Ripples on the water"
							value={Math.round((area.water.rippleStrength ?? worldWater.rippleStrength) * 100)}
							min={0}
							max={100}
							step={5}
							suffix="%"
							onChange={(v) =>
								edit("rippleStrength", (a) => {
									a.water.rippleStrength = v / 100;
								})
							}
							inherit={{
								from: "scene",
								inherited: area.water.rippleStrength === null,
								onReset: () =>
									edit("rippleStrength", (a) => {
										a.water.rippleStrength = null;
									}),
								value: `${Math.round(worldWater.rippleStrength * 100)}%`,
							}}
							hint="0% is mirror-calm, 100% choppy."
						/>

						<SliderField
							label="Reflections on the water"
							value={Math.round(
								(area.water.reflectionStrength ?? worldWater.reflectionStrength) * 100,
							)}
							min={0}
							max={100}
							step={5}
							suffix="%"
							onChange={(v) =>
								edit("reflectionStrength", (a) => {
									a.water.reflectionStrength = v / 100;
								})
							}
							inherit={{
								from: "scene",
								inherited: area.water.reflectionStrength === null,
								onReset: () =>
									edit("reflectionStrength", (a) => {
										a.water.reflectionStrength = null;
									}),
								value: `${Math.round(worldWater.reflectionStrength * 100)}%`,
							}}
							hint="How strongly it mirrors the world: 0% shows only its ripples catching the lights."
						/>

						<RipplesNote />
					</>
				)}
			</Section>
		</>
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
