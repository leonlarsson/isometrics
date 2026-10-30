import type { Draft } from "immer";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import {
	builtShareOf,
	fenceColorSettings,
	fenceHeightOf,
	fenceSpacingOf,
	layoutOfFence,
} from "#/fences/fenceModel";
import { FENCE_STYLE_LABELS, FENCE_STYLE_LIST, FENCE_STYLES } from "#/fences/registry";
import { applySettingChange, isUnsetSetting } from "#/scene/objectSettings";
import { roadEnds, type TRoadEnd } from "#/scene/roads";
import { EntityColorSchema, type TFence, type TFenceStyle } from "#/scene/schema";

import { Button, ButtonGroup, IconButton, IconButtonGroup } from "./Button";
import { DataDrivenField } from "./DataDrivenField";
import { FollowDataNote } from "./FollowDataNote";
import {
	Hint,
	Kbd,
	Section,
	SelectField,
	SliderField,
	SwitchField,
	TextField,
	VectorField,
} from "./fields";
import type { IInspectorTab } from "./inspectorTabs";
import { PartColorsSection } from "./PartSettings";

/**
 * The properties of a selected fence (ADR-0103), like a road's: its name and
 * style, its shape and points, and its colours. Every edit coalesces per fence
 * and field, so typing or sliding is one undo step.
 */

const STYLE_OPTIONS = FENCE_STYLE_LIST.map((style) => ({
	value: style.id,
	label: FENCE_STYLE_LABELS[style.id],
}));

const useFenceEdit = (fence: TFence) => {
	const updateFence = useEditor((s) => s.updateFence);
	return (field: string, recipe: (f: Draft<TFence>) => void) =>
		updateFence(fence.id, recipe, { coalesce: `${fence.id}:${field}` });
};

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** The Fence tab: its name and style. */
const FenceTab = ({ fence }: { fence: TFence }) => {
	const removeFence = useEditor((s) => s.removeFence);
	const areas = useEditor((s) => s.scene.areas);
	const data = useEditor((s) => s.scene.data);
	const edit = useFenceEdit(fence);
	const layout = layoutOfFence(fence, areas, data);
	const style = FENCE_STYLES[fence.style];

	return (
		<Section
			icon="fence"
			title={FENCE_STYLE_LABELS[fence.style]}
			actions={
				<IconButtonGroup>
					<IconButton
						icon={fence.locked ? "lock" : "unlock"}
						label={fence.locked ? "Unlock" : "Lock its shape"}
						pressed={fence.locked}
						onClick={() =>
							edit("locked", (f) => {
								f.locked = !f.locked;
							})
						}
					/>

					<IconButton
						icon="trash"
						label="Delete fence (Del)"
						onClick={() => removeFence(fence.id)}
					/>
				</IconButtonGroup>
			}
		>
			<TextField
				label="Name"
				value={fence.name}
				placeholder={FENCE_STYLE_LABELS[fence.style]}
				onChange={(v) =>
					edit("name", (f) => {
						f.name = v;
					})
				}
			/>

			<SelectField<TFenceStyle>
				label="Style"
				value={fence.style}
				options={STYLE_OPTIONS}
				onChange={(v) =>
					edit("style", (f) => {
						f.style = v;
					})
				}
				hint={style.description}
			/>

			<Hint>
				{`${Math.round(layout.length * 10) / 10} units long · ${layout.posts.length} posts · ${fence.points.length} points`}
			</Hint>
		</Section>
	);
};

/** The selected point: where it is, how far it's lifted, and what can be done there. */
const FencePointPanel = ({ fence, index }: { fence: TFence; index: number }) => {
	const point = fence.points[index];
	if (!point) {
		return null;
	}
	const store = () => useEditor.getState();
	const coalesce = (field: string) => ({ coalesce: `${fence.id}:point:${index}:${field}` });
	const end: TRoadEnd | null =
		roadEnds(fence).find((candidate) => candidate.index === index)?.end ?? null;
	const canSplit = fence.loops || end === null;

	return (
		<Section
			icon="pin"
			title={`Point ${index + 1} of ${fence.points.length}`}
			actions={
				<IconButton
					icon="trash"
					label="Delete point (Del)"
					disabled={fence.points.length <= 2}
					onClick={() => store().removeFencePoint(fence.id, index)}
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
					store().moveFencePoint(fence.id, index, next, coalesce("position"));
				}}
			/>

			<SliderField
				label="Lift"
				value={point[2]}
				min={0}
				max={10}
				step={0.25}
				hint="How far above the ground it stands here, e.g. on top of a wall or along a bridge."
				onChange={(value) => store().setFencePointLift(fence.id, index, value, coalesce("lift"))}
			/>

			<Hint>
				Lift it with the green arrow, or press <Kbd>G</Kbd> then <Kbd>Y</Kbd>. To select several,
				<Kbd>Shift</Kbd>- or <Kbd>Ctrl</Kbd>-click other points, or box them with <Kbd>B</Kbd>.
			</Hint>

			<ButtonGroup>
				{canSplit && (
					<Button size="sm" icon="cut" onClick={() => store().splitFence(fence.id, index)}>
						{fence.loops ? "Open loop here" : "Split fence here"}
					</Button>
				)}

				{end && (
					<Button size="sm" icon="edit" onClick={() => store().continueFenceDrawing(fence.id, end)}>
						Continue drawing
					</Button>
				)}
			</ButtonGroup>
		</Section>
	);
};

/** Several selected points: how far they're lifted, Mixed where they differ, and deleting them. */
const FencePointsPanel = ({ fence, indices }: { fence: TFence; indices: readonly number[] }) => {
	const points = indices.flatMap((index) => {
		const point = fence.points[index];
		return point ? [point] : [];
	});
	const last = points.at(-1);
	if (!last) {
		return null;
	}
	const store = () => useEditor.getState();
	const lifts = new Set(points.map((point) => point[2]));

	return (
		<Section
			icon="pin"
			title={`${points.length} points selected`}
			actions={
				<IconButton
					icon="trash"
					label="Delete them (Del)"
					disabled={fence.points.length - points.length < 2}
					onClick={() => store().removeSelectedPoints()}
				/>
			}
		>
			<SliderField
				label="Lift"
				value={last[2]}
				mixed={lifts.size > 1}
				min={0}
				max={10}
				step={0.25}
				onChange={(value) => {
					for (const index of indices) {
						store().setFencePointLift(fence.id, index, value, {
							coalesce: `${fence.id}:points:${indices.join(",")}:lift`,
						});
					}
				}}
			/>

			<Hint>
				Drag one of them, or the arrows at their middle, to move them all. To add a point or take
				one out, <Kbd>Shift</Kbd>- or <Kbd>Ctrl</Kbd>-click it, and <Kbd>B</Kbd> boxes more.
			</Hint>
		</Section>
	);
};

/** The Shape tab: the selected points, then the whole fence's height, posts, curves and how much is built. */
const FenceShapeTab = ({ fence }: { fence: TFence }) => {
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const selectedPoints = useEditor((s) => s.selectedPointIndices);
	const data = useEditor((s) => s.scene.data);
	const edit = useFenceEdit(fence);
	const style = FENCE_STYLES[fence.style];
	const showsPosts = style.showsPosts !== false;
	const built = builtShareOf(fence, data);

	return (
		<>
			<FollowDataNote title="How much is built can follow data">
				A fence can be built as far as a value in the Data tab says, like a site fence that grows
				with a project's progress.
			</FollowDataNote>

			{selectedPoints.length > 1 ? (
				<FencePointsPanel fence={fence} indices={selectedPoints} />
			) : (
				selectedPoint !== null && <FencePointPanel fence={fence} index={selectedPoint} />
			)}

			<Section
				id="fence.shape"
				icon="spline"
				title="Whole fence"
				keywords="shape height posts spacing sections curves loop points"
			>
				<SliderField
					label="Height"
					value={fenceHeightOf(fence)}
					min={0.1}
					max={3}
					step={0.02}
					onChange={(v) =>
						edit("height", (f) => {
							f.height = v;
						})
					}
					inherit={{
						from: "default",
						inherited: fence.height === null,
						onReset: () =>
							edit("height", (f) => {
								f.height = null;
							}),
						value: String(style.height),
					}}
				/>

				<SliderField
					label={showsPosts ? "Post spacing" : "Section length"}
					value={fenceSpacingOf(fence)}
					min={0.3}
					max={6}
					step={0.1}
					hint={
						showsPosts
							? "The longest gap between two posts. Every corner has a post, and the posts between are spaced evenly."
							: "The longest straight length. Shorter lengths follow curves and slopes more closely."
					}
					onChange={(v) =>
						edit("postSpacing", (f) => {
							f.postSpacing = v;
						})
					}
					inherit={{
						from: "default",
						inherited: fence.postSpacing === null,
						onReset: () =>
							edit("postSpacing", (f) => {
								f.postSpacing = null;
							}),
						value: String(style.postSpacing),
					}}
				/>

				<SliderField
					label="Curves"
					value={fence.cornerRadius}
					min={0}
					max={15}
					step={0.5}
					onChange={(v) =>
						edit("cornerRadius", (f) => {
							f.cornerRadius = v;
						})
					}
					inherit={{
						from: "default",
						inherited: fence.cornerRadius === 0,
						onReset: () =>
							edit("cornerRadius", (f) => {
								f.cornerRadius = 0;
							}),
						value: "0",
					}}
				/>

				<SwitchField
					label="Loop (join the ends)"
					checked={fence.loops}
					onChange={(v) =>
						edit("loops", (f) => {
							f.loops = v;
						})
					}
				/>

				<Hint>
					These are the whole fence's. It stands on the ground under it, raised land too. With no
					point selected, the arrows at its middle (or G, R, S and the arrow keys) move, turn and
					resize all of it. Click a point to select it; drag a small dot between two points to add
					one; double-click a point to remove it.
				</Hint>
			</Section>

			<Section
				id="fence.built"
				icon="chart"
				title="How much is built"
				keywords="built progress construction data share"
			>
				<DataDrivenField
					kind="scale"
					binding={fence.data.builtShare}
					data={data}
					formatScale={percent}
					max={1}
					onBindingChange={(binding, field) =>
						edit(field ? `data.builtShare.${field}` : "data.builtShare", (f) => {
							if (binding) {
								f.data.builtShare = binding;
							} else {
								delete f.data.builtShare;
							}
						})
					}
				>
					<SliderField
						label="Built"
						value={Math.round(fence.builtShare * 100)}
						min={0}
						max={100}
						step={1}
						suffix="%"
						onChange={(v) =>
							edit("builtShare", (f) => {
								f.builtShare = v / 100;
							})
						}
					/>
				</DataDrivenField>

				<Hint>
					{built < 1
						? `${percent(built)} of it stands, from its first point.`
						: "All of it stands. Less builds it from its first point, the rest left for later."}
				</Hint>
			</Section>
		</>
	);
};

/** The Look tab: the style's colours, each by hand or from data (ADR-0060). */
const FenceLookTab = ({ fence }: { fence: TFence }) => {
	const palette = usePalette();
	const data = useEditor((s) => s.scene.data);
	const edit = useFenceEdit(fence);

	return (
		<>
			<FollowDataNote title="Colours can follow data">
				A colour can come from a value in the Data tab: a value holding a colour (red, #ff0000), or
				a number on a colour scale, like a site fence that turns from green to red.
			</FollowDataNote>

			<PartColorsSection
				part={FENCE_STYLES[fence.style]}
				object={fenceColorSettings(fence)}
				data={data}
				palette={palette}
				onChange={(colorId, change, field) =>
					edit(`color:${colorId}:${field ?? performance.now()}`, (f) => {
						const next = applySettingChange(
							f.colors[colorId] ?? EntityColorSchema.parse({}),
							change,
						);
						if (isUnsetSetting(next)) {
							delete f.colors[colorId];
						} else {
							f.colors[colorId] = next;
						}
					})
				}
			/>
		</>
	);
};

/** The properties tabs for a selected fence (ADR-0054). */
export const fenceTabs = (fence: TFence): IInspectorTab[] => [
	{
		value: "object",
		label: "Fence",
		icon: "fence",
		content: <FenceTab key={fence.id} fence={fence} />,
	},
	{
		value: "shape",
		label: "Shape",
		icon: "spline",
		content: <FenceShapeTab key={fence.id} fence={fence} />,
	},
	{
		value: "look",
		label: "Look",
		icon: "palette",
		content: <FenceLookTab key={fence.id} fence={fence} />,
	},
];
