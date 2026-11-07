import { useEditor } from "#/editor/store";
import { junctionIndexOf } from "#/scene/junctions";
import { PILLAR_MIN, pointWidth, roadEnds, roadNameOf, type TRoadEnd } from "#/scene/roads";
import type { TRoad } from "#/scene/schema";

import { Button, ButtonGroup, IconButton } from "./Button";
import {
	GroupLabel,
	Hint,
	Kbd,
	resetToDefault,
	Section,
	SliderField,
	SwitchField,
	VectorField,
	valuesDiffer,
} from "./fields";

/** A road's point at one of its ends, as [x, z, altitude]. */
const endPoint = (road: TRoad, end: TRoadEnd): [number, number, number] => {
	const point = end === "start" ? road.points[0] : road.points[road.points.length - 1];
	return [point[0], point[1], point[2]];
};

/** Other road ends within this distance are offered as join targets. */
const JOIN_NEARBY = 8;
const MAX_JOIN_OPTIONS = 3;

/**
 * Where vehicles arriving at a junction by this road's end may go on to (ADR-0148): a switch per
 * other end, all on while the end's `leadsTo` is null (any way the rules allow). A way onto a
 * one-way road against its way is greyed out. Turning one off writes the list; Reset clears it.
 */
const JunctionTurns = ({ road, end }: { road: TRoad; end: TRoadEnd }) => {
	const roads = useEditor((s) => s.scene.roads);
	const junctions = useEditor((s) => s.scene.junctions);
	const junction = junctions[junctionIndexOf(junctions, road.id, end)];
	const arriving = junction?.ends.find((e) => e.roadId === road.id && e.end === end);
	if (!junction || !arriving) {
		return null;
	}
	const isArriving = !(road.isOneWay && end === "start");
	const ways = junction.ends.flatMap((e) => {
		const other = roads.find((r) => r.id === e.roadId);
		if (!other || (e.roadId === road.id && e.end === end)) {
			return [];
		}
		return [
			{ roadId: e.roadId, end: e.end, road: other, against: other.isOneWay && e.end === "end" },
		];
	});
	const allows = (to: { roadId: string; end: TRoadEnd }) =>
		arriving.leadsTo === null ||
		arriving.leadsTo.some((way) => way.roadId === to.roadId && way.end === to.end);
	const write = (leadsTo: { roadId: string; end: TRoadEnd }[] | null) =>
		useEditor.getState().commit((scene) => {
			const target = scene.junctions
				.find((j) => j.id === junction.id)
				?.ends.find((e) => e.roadId === road.id && e.end === end);
			if (target) {
				target.leadsTo = leadsTo;
			}
		});
	const reset = {
		from: "default",
		inherited: arriving.leadsTo === null,
		onReset: () => write(null),
		value: "any way",
	};
	if (!isArriving) {
		return (
			<Hint>
				Vehicles only leave the junction by this road: it's one-way, from its first point.
			</Hint>
		);
	}
	return (
		<>
			<GroupLabel>Vehicles arriving here go on to</GroupLabel>

			{ways.map((way) => (
				<SwitchField
					key={`${way.roadId}:${way.end}`}
					label={`${roadNameOf(way.road)} (${way.end === "start" ? "from its start" : "from its end"})${way.against ? " (one-way, the other way)" : ""}`}
					checked={!way.against && allows(way)}
					disabled={way.against}
					inherit={reset}
					onChange={(on) => {
						const now = ways.filter((each) => !each.against && allows(each));
						const next = on
							? [...now, way]
							: now.filter((each) => !(each.roadId === way.roadId && each.end === way.end));
						write(next.map((each) => ({ roadId: each.roadId, end: each.end })));
					}}
				/>
			))}
		</>
	);
};

/**
 * Whether a raised junction stands on pillars of its own (ADR-0148): on for junctions made in the
 * editor. Greyed out, saying why, on the ground or where none of its roads stands on pillars.
 */
const JunctionPillars = ({ road, end }: { road: TRoad; end: TRoadEnd }) => {
	const roads = useEditor((s) => s.scene.roads);
	const junctions = useEditor((s) => s.scene.junctions);
	const junction = junctions[junctionIndexOf(junctions, road.id, end)];
	if (!junction) {
		return null;
	}
	const isRaised = endPoint(road, end)[2] >= PILLAR_MIN;
	const onPillars = junction.ends.some(
		(each) => roads.find((r) => r.id === each.roadId)?.heldUpBy === "pillars",
	);
	const write = (on: boolean) =>
		useEditor.getState().commit((scene) => {
			const target = scene.junctions.find((j) => j.id === junction.id);
			if (target) {
				target.standsOnPillars = on;
			}
		});
	const reason = !isRaised
		? " (on the ground)"
		: !onPillars
			? " (none of its roads stands on pillars)"
			: "";
	return (
		<SwitchField
			label={`Stands on pillars of its own${reason}`}
			checked={junction.standsOnPillars}
			disabled={!isRaised || !onPillars}
			inherit={resetToDefault(junction.standsOnPillars, true, () => write(true))}
			onChange={write}
		/>
	);
};

/** Controls for the selected control point: position, height, and point actions. */
export const RoadPointPanel = ({ road, index }: { road: TRoad; index: number }) => {
	const roads = useEditor((s) => s.scene.roads);
	const junctions = useEditor((s) => s.scene.junctions);
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
	// The junction this end is at, if any (ADR-0136), and the other road ends there.
	const junction = end ? junctions[junctionIndexOf(junctions, road.id, end)] : undefined;
	const others = (junction?.ends ?? []).filter((e) => !(e.roadId === road.id && e.end === end));
	const otherRoads = others.flatMap((e) => {
		const other = roads.find((r) => r.id === e.roadId);
		return other ? [{ road: other, end: e.end }] : [];
	});
	const names = [...new Set(otherRoads.map((other) => `“${roadNameOf(other.road)}”`))];

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
				hasNoDefault
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
				inherit={resetToDefault(
					point[2],
					0,
					() => store().setRoadPointHeight(road.id, index, 0),
					"on the ground",
				)}
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

				{end && !junction && (
					<Button size="sm" icon="edit" onClick={() => store().continueDrawing(road.id, end)}>
						Continue drawing
					</Button>
				)}
			</ButtonGroup>

			{end && junction && (
				<ButtonGroup vertical>
					<GroupLabel>At a junction</GroupLabel>

					<Hint>
						{`Connected to ${names.join(" and ")}: vehicles drive on from one road to another. Moving this point moves the junction, and the other roads' ends follow.`}
					</Hint>

					<JunctionPillars road={road} end={end} />

					<JunctionTurns road={road} end={end} />

					<Button size="sm" icon="road" block onClick={() => store().drawRoadFrom(road.id, end)}>
						Draw a road from here
					</Button>

					{otherRoads.length === 1 && otherRoads[0].road.id !== road.id && (
						<Button
							size="sm"
							icon="join"
							block
							onClick={() =>
								store().joinRoads(road.id, end, otherRoads[0].road.id, otherRoads[0].end)
							}
						>
							Join into one road
						</Button>
					)}

					<Button
						size="sm"
						icon="cut"
						block
						onClick={() => store().disconnectRoadEnd(road.id, end)}
					>
						Disconnect
					</Button>
				</ButtonGroup>
			)}

			{end && !junction && joinOptions.length > 0 && (
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
								: `${roadNameOf(option.road)} (${option.end})`}
						</Button>
					))}
				</ButtonGroup>
			)}

			{end && !junction && joinOptions.some((option) => option.road.id !== road.id) && (
				<ButtonGroup vertical>
					<GroupLabel>Connect at a junction with</GroupLabel>

					{joinOptions
						.filter((option) => option.road.id !== road.id)
						.map((option) => (
							<Button
								key={`${option.road.id}:${option.end}`}
								size="sm"
								icon="road"
								block
								meta={`${option.distance.toFixed(1)} away`}
								onClick={() =>
									store().connectRoads(road.id, end, {
										kind: "end",
										roadId: option.road.id,
										end: option.end,
										point: endPoint(option.road, option.end),
									})
								}
							>
								{`${roadNameOf(option.road)} (${option.end})`}
							</Button>
						))}
				</ButtonGroup>
			)}
		</Section>
	);
};

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
				inherit={resetToDefault(
					points.every((point) => point[2] === 0),
					true,
					() => {
						for (const index of indices) {
							store().setRoadPointHeight(road.id, index, 0, coalesce("height"));
						}
					},
					"on the ground",
				)}
				label="Altitude"
				value={last[2]}
				mixed={valuesDiffer(points.map((point) => point[2]))}
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
				mixed={valuesDiffer(widths)}
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
