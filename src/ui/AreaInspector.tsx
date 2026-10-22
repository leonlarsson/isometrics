import type { Draft } from "immer";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { AREA_TYPE_LABELS, areaColor, polygonArea } from "#/scene/areas";
import type { TArea, TAreaType } from "#/scene/schema";

import { IconButton } from "./Button";
import {
	ColorField,
	Hint,
	Section,
	SelectField,
	SliderField,
	TextField,
	VectorField,
} from "./fields";

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

export const AreaInspector = ({ area }: { area: TArea }) => {
	const updateArea = useEditor((s) => s.updateArea);
	const removeArea = useEditor((s) => s.removeArea);
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const palette = usePalette();

	/** Every edit coalesces per area+field so typing or sliding is one undo step. */
	const edit = (field: string, recipe: (a: Draft<TArea>) => void) =>
		updateArea(area.id, recipe, { coalesce: `${area.id}:${field}` });

	const size = Math.abs(polygonArea(area.points));

	return (
		<>
			{selectedPoint !== null && <CornerPanel area={area} index={selectedPoint} />}

			<Section
				title={`${AREA_TYPE_LABELS[area.type]} area`}
				actions={
					<IconButton icon="trash" label="Delete area (Del)" onClick={() => removeArea(area.id)} />
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
					{Math.round(size)} square units · {area.points.length} corners. Drag corners to reshape,
					drag a small dot between two corners to add one, double-click a corner to remove it. Above
					0, the area becomes raised ground with cliff sides.
				</Hint>
			</Section>

			<Section title="Look">
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
			</Section>
		</>
	);
};
