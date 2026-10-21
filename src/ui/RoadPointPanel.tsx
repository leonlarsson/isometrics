import { useEditor } from "#/editor/store";
import { ROAD_STYLE_LABELS, roadEnds, type TRoadEnd } from "#/scene/roads";
import type { TRoad } from "#/scene/schema";

import { Section, SliderField, VectorField } from "./fields";
import { Icon } from "./Icon";

import styles from "./Fields.module.css";

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
				<button
					type="button"
					className={styles.iconButton}
					title="Delete point (Del)"
					disabled={road.points.length <= 2}
					onClick={() => store().removeRoadPoint(road.id, index)}
				>
					<Icon name="trash" size={16} />
				</button>
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

			<p className={styles.hint}>Tip: hold Shift while dragging a point to raise or lower it.</p>

			<div className={styles.buttonRow}>
				{canSplit && (
					<button
						type="button"
						className={styles.smallButton}
						onClick={() => store().splitRoad(road.id, index)}
					>
						<Icon name="cut" size={14} /> {road.closed ? "Open loop here" : "Split road here"}
					</button>
				)}

				{end && (
					<button
						type="button"
						className={styles.smallButton}
						onClick={() => store().continueDrawing(road.id, end)}
					>
						<Icon name="edit" size={14} /> Continue drawing
					</button>
				)}
			</div>

			{end && joinOptions.length > 0 && (
				<div className={styles.buttonColumn}>
					<span className={styles.label}>Join with</span>

					{joinOptions.map((option) => (
						<button
							key={`${option.road.id}:${option.end}`}
							type="button"
							className={styles.smallButton}
							onClick={() => store().joinRoads(road.id, end, option.road.id, option.end)}
						>
							<Icon name="join" size={14} />

							<span>
								{option.road.id === road.id
									? "Its own other end (make a loop)"
									: `${roadLabel(option.road)} (${option.end})`}
							</span>

							<span className={styles.buttonMeta}>{option.distance.toFixed(1)} away</span>
						</button>
					))}
				</div>
			)}
		</Section>
	);
};
