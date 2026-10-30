import { useEditor } from "#/editor/store";
import { pointWidth, ROAD_KIND_LABELS, roadEnds, type TRoadEnd } from "#/scene/roads";
import type { TRoad } from "#/scene/schema";

import { Button, ButtonGroup, IconButton } from "./Button";
import { GroupLabel, Hint, Kbd, Section, SliderField, VectorField } from "./fields";

/** Other road ends within this distance are offered as join targets. */
const JOIN_NEARBY = 8;
const MAX_JOIN_OPTIONS = 3;

const roadLabel = (road: TRoad) => road.name || ROAD_KIND_LABELS[road.kind];

/** Controls for the selected control point: position, height, and point actions. */
export const RoadPointPanel = ({ road, index }: { road: TRoad; index: number }) => {
	const roads = useEditor((s) => s.scene.roads);
	const point = road.points[index];
	if (!point) {
		return null;
	}

	const store = () => useEditor.getState();
	const coalesce = (field: string) => ({ coalesce: `${road.id}:point:${index}:${field}` });
	const end: TRoadEnd | null = road.loops
		? null
		: index === 0
			? "start"
			: index === road.points.length - 1
				? "end"
				: null;
	const canSplit = road.loops || end === null;

	const joinOptions = end
		? roads
				.flatMap((other) =>
					roadEnds(other)
						.filter((candidate) =>
							other.id === road.id ? candidate.end !== end && road.points.length > 2 : true,
						)
						.map((candidate) => ({
							road: other,
							end: candidate.end,
							distance: Math.hypot(candidate.point[0] - point[0], candidate.point[1] - point[1]),
						})),
				)
				.filter((option) => option.distance <= JOIN_NEARBY)
				.sort((a, b) => a.distance - b.distance)
				.slice(0, MAX_JOIN_OPTIONS)
		: [];

	return (
		<Section
			icon="pin"
			title={`Point ${index + 1} of ${road.points.length}`}
			actions={
				<IconButton
					icon="trash"
					label="Delete point (Del)"
					disabled={road.points.length <= 2}
					onClick={() => store().removeRoadPoint(road.id, index)}
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
					store().moveRoadPoint(road.id, index, next, coalesce("position"));
				}}
			/>

			<SliderField
				label="Altitude"
				value={point[2]}
				min={0}
				max={15}
				step={0.25}
				onChange={(value) => store().setRoadPointHeight(road.id, index, value, coalesce("height"))}
			/>

			<SliderField
				label="Width here"
				value={pointWidth(point) ?? road.width}
				min={0.4}
				max={8}
				step={0.1}
				onChange={(value) => store().setRoadPointWidth(road.id, index, value, coalesce("width"))}
				inherit={{
					from: "road",
					inherited: pointWidth(point) === undefined,
					onReset: () => store().setRoadPointWidth(road.id, index, null),
					value: String(road.width),
				}}
			/>

			<Hint>
				Lift it with the green arrow, or press <Kbd>G</Kbd> then <Kbd>Y</Kbd>. To select several,
				<Kbd>Shift</Kbd>- or <Kbd>Ctrl</Kbd>-click other points, or box them with <Kbd>B</Kbd>.
			</Hint>

			<ButtonGroup>
				{canSplit && (
					<Button size="sm" icon="cut" onClick={() => store().splitRoad(road.id, index)}>
						{road.loops ? "Open loop here" : "Split road here"}
					</Button>
				)}

				{end && (
					<Button size="sm" icon="edit" onClick={() => store().continueDrawing(road.id, end)}>
						Continue drawing
					</Button>
				)}
			</ButtonGroup>

			{end && joinOptions.length > 0 && (
				<ButtonGroup vertical>
					<GroupLabel>Join with</GroupLabel>

					{joinOptions.map((option) => (
						<Button
							key={`${option.road.id}:${option.end}`}
							size="sm"
							icon="join"
							block
							meta={`${option.distance.toFixed(1)} away`}
							onClick={() => store().joinRoads(road.id, end, option.road.id, option.end)}
						>
							{option.road.id === road.id
								? "Its own other end (make a loop)"
								: `${roadLabel(option.road)} (${option.end})`}
						</Button>
					))}
				</ButtonGroup>
			)}
		</Section>
	);
};

/** Whether values differ (compared as JSON). */
const differ = (values: readonly unknown[]) =>
	new Set(values.map((value) => JSON.stringify(value ?? null))).size > 1;

/**
 * Several selected points of a road (ADR-0065): their height and width, Mixed
 * where they differ, and deleting them together.
 */
export const RoadPointsPanel = ({ road, indices }: { road: TRoad; indices: readonly number[] }) => {
	const points = indices.flatMap((index) => {
		const point = road.points[index];
		return point ? [point] : [];
	});
	const last = points.at(-1);
	if (!last) {
		return null;
	}
	const store = () => useEditor.getState();
	const coalesce = (field: string) => ({
		coalesce: `${road.id}:points:${indices.join(",")}:${field}`,
	});
	const widths = points.map((point) => pointWidth(point) ?? road.width);

	return (
		<Section
			icon="pin"
			title={`${points.length} points selected`}
			actions={
				<IconButton
					icon="trash"
					label="Delete them (Del)"
					disabled={road.points.length - points.length < 2}
					onClick={() => store().removeSelectedPoints()}
				/>
			}
		>
			<SliderField
				label="Altitude"
				value={last[2]}
				mixed={differ(points.map((point) => point[2]))}
				min={0}
				max={15}
				step={0.25}
				onChange={(value) => {
					for (const index of indices) {
						store().setRoadPointHeight(road.id, index, value, coalesce("height"));
					}
				}}
			/>

			<SliderField
				label="Width here"
				value={widths.at(-1) ?? road.width}
				mixed={differ(widths)}
				min={0.4}
				max={8}
				step={0.1}
				onChange={(value) => {
					for (const index of indices) {
						store().setRoadPointWidth(road.id, index, value, coalesce("width"));
					}
				}}
				inherit={{
					from: "road",
					inherited: points.every((point) => pointWidth(point) === undefined),
					onReset: () => {
						const options = coalesce(`reset:${performance.now()}`);
						for (const index of indices) {
							store().setRoadPointWidth(road.id, index, null, options);
						}
					},
					value: String(road.width),
				}}
			/>

			<Hint>
				Drag one of them, or the arrows at their middle, to move them all. The green arrow lifts
				them, and so does <Kbd>G</Kbd> then <Kbd>Y</Kbd>. <Kbd>Shift</Kbd>- or <Kbd>Ctrl</Kbd>-click
				adds a point or takes it out, and <Kbd>B</Kbd> boxes more.
			</Hint>
		</Section>
	);
};
