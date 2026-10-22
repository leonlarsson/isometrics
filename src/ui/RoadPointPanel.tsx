import { useEditor } from "#/editor/store";
import { pointWidth, ROAD_STYLE_LABELS, roadEnds, type TRoadEnd } from "#/scene/roads";
import type { TRoad } from "#/scene/schema";

import { Button, ButtonGroup, IconButton } from "./Button";
import { GroupLabel, Hint, Section, SliderField, VectorField } from "./fields";

/** Other road ends within this distance are offered as join targets. */
const JOIN_NEARBY = 8;
const MAX_JOIN_OPTIONS = 3;

const roadLabel = (road: TRoad) => road.name || ROAD_STYLE_LABELS[road.style];

/** Controls for the selected control point: position, height, and point actions. */
export const RoadPointPanel = ({ road, index }: { road: TRoad; index: number }) => {
	const roads = useEditor((s) => s.scene.roads);
	const point = road.points[index];
	if (!point) {
		return null;
	}

	const store = () => useEditor.getState();
	const coalesce = (field: string) => ({ coalesce: `${road.id}:point:${index}:${field}` });
	const end: TRoadEnd | null = road.closed
		? null
		: index === 0
			? "start"
			: index === road.points.length - 1
				? "end"
				: null;
	const canSplit = road.closed || end === null;

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
				label="Height"
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
				isDefault={pointWidth(point) === undefined}
				onChange={(value) => store().setRoadPointWidth(road.id, index, value, coalesce("width"))}
				onReset={() => store().setRoadPointWidth(road.id, index, null)}
			/>

			<Hint>Tip: hold Shift while dragging a point to raise or lower it.</Hint>

			<ButtonGroup>
				{canSplit && (
					<Button size="sm" icon="cut" onClick={() => store().splitRoad(road.id, index)}>
						{road.closed ? "Open loop here" : "Split road here"}
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
