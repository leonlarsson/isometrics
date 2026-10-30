import type { Draft } from "immer";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { changeColorSetting, type TColorSettingChange } from "#/scene/objectSettings";
import {
	isHiddenRoute,
	pointWidth,
	polylineLength,
	ROAD_KIND_LABELS,
	ROAD_KINDS,
	roadCenterlineOf,
	TURN_STYLE_LABELS,
	TURN_STYLE_OPTIONS,
	widthForStyle,
} from "#/scene/roads";
import type { TDrivingLane, TRoad, TRoadHeldUpBy, TRoadKind, TTurnStyle } from "#/scene/schema";

import { IconButton, IconButtonGroup } from "./Button";
import { FollowDataNote } from "./FollowDataNote";
import { Hint, Section, SelectField, SliderField, SwitchField, TextField } from "./fields";
import type { IInspectorTab } from "./inspectorTabs";
import { ColorSettingFields } from "./PartSettings";
import { RoadPointPanel, RoadPointsPanel } from "./RoadPointPanel";

const STYLE_OPTIONS = (Object.keys(ROAD_KIND_LABELS) as TRoadKind[]).map((value) => ({
	value,
	label: ROAD_KIND_LABELS[value],
}));

/** Every edit coalesces per road+field so typing or sliding is one undo step. */
const useRoadEdit = (road: TRoad) => {
	const updateRoad = useEditor((s) => s.updateRoad);
	return (field: string, recipe: (r: Draft<TRoad>) => void) =>
		updateRoad(road.id, recipe, { coalesce: `${road.id}:${field}` });
};

/**
 * One of the road's colours (ADR-0104), by hand or from data, under its kind's
 * name for it unless `label` says otherwise.
 */
const RoadColorFields = ({
	road,
	colorId,
	label,
}: {
	road: TRoad;
	colorId: string;
	label: string;
}) => {
	const palette = usePalette();
	const data = useEditor((s) => s.scene.data);
	const edit = useRoadEdit(road);
	const spec = ROAD_KINDS[road.kind].colors.find((color) => color.id === colorId);
	if (!spec) {
		return null;
	}
	return (
		<ColorSettingFields
			spec={spec}
			setting={road.colors[colorId]}
			data={data}
			palette={palette}
			label={label}
			onChange={(change: TColorSettingChange, field) =>
				edit(`color:${colorId}:${field ?? performance.now()}`, (r) => {
					changeColorSetting(r.colors, colorId, change);
				})
			}
		/>
	);
};

/** The Road tab: its name and style, and how vehicles drive on it. */
const RoadTab = ({ road }: { road: TRoad }) => {
	const removeRoad = useEditor((s) => s.removeRoad);
	const followers = useEditor(
		(s) => s.scene.entities.filter((e) => e.follow?.roadId === road.id).length,
	);
	const sceneTurns = useEditor((s) => s.scene.traffic.turnStyle);
	const sceneLeans = useEditor((s) => s.scene.traffic.leansInTurns);
	const driving = useEditor((s) => s.scene.traffic.drivingSide);
	const edit = useRoadEdit(road);
	const length = polylineLength(roadCenterlineOf(road), road.loops);

	return (
		<>
			<Section
				icon="road"
				title={ROAD_KIND_LABELS[road.kind]}
				actions={
					<IconButtonGroup>
						<IconButton
							icon={road.isLocked ? "lock" : "unlock"}
							label={road.isLocked ? "Unlock" : "Lock its shape"}
							pressed={road.isLocked}
							onClick={() =>
								edit("locked", (r) => {
									r.isLocked = !r.isLocked;
								})
							}
						/>

						<IconButton
							icon="trash"
							label="Delete road (Del)"
							onClick={() => removeRoad(road.id)}
						/>
					</IconButtonGroup>
				}
			>
				<TextField
					label="Name"
					value={road.name}
					placeholder={ROAD_KIND_LABELS[road.kind]}
					onChange={(v) =>
						edit("name", (r) => {
							r.name = v;
						})
					}
				/>

				<SelectField<TRoadKind>
					label="Kind"
					value={road.kind}
					options={STYLE_OPTIONS}
					onChange={(v) =>
						edit("style", (r) => {
							r.width = widthForStyle(r.width, r.kind, v);
							r.kind = v;
						})
					}
				/>
			</Section>

			<Section id="road.traffic" icon="car" title="Traffic" keywords="vehicles lanes turns">
				{!isHiddenRoute(road.kind) && (
					<SelectField<TDrivingLane>
						label="Vehicles drive"
						value={road.traffic.drivingLane}
						options={[
							{ value: "side", label: `In lanes (keep ${driving})` },
							{ value: "centre", label: "Down the centre (one-way, race track)" },
						]}
						onChange={(v) =>
							edit("lane", (r) => {
								r.traffic.drivingLane = v;
							})
						}
					/>
				)}

				<SelectField<TTurnStyle>
					label="Vehicles turn"
					value={road.traffic.turnStyle ?? sceneTurns}
					options={TURN_STYLE_OPTIONS}
					onChange={(v) =>
						edit("turns", (r) => {
							r.traffic.turnStyle = v;
						})
					}
					inherit={{
						from: "scene",
						inherited: road.traffic.turnStyle === null,
						onReset: () =>
							edit("turns", (r) => {
								r.traffic.turnStyle = null;
							}),
						value: TURN_STYLE_LABELS[sceneTurns].toLowerCase(),
					}}
				/>

				<SwitchField
					label="Lean in turns"
					checked={road.traffic.leansInTurns ?? sceneLeans}
					onChange={(v) =>
						edit("leans", (r) => {
							r.traffic.leansInTurns = v;
						})
					}
					inherit={{
						from: "scene",
						inherited: road.traffic.leansInTurns === null,
						onReset: () =>
							edit("leans", (r) => {
								r.traffic.leansInTurns = null;
							}),
						value: sceneLeans ? "on" : "off",
					}}
				/>

				<Hint>
					{Math.round(length)} units long · {road.points.length} points
					{followers > 0 && ` · ${followers} vehicle${followers === 1 ? "" : "s"} driving here`}
				</Hint>
			</Section>
		</>
	);
};

/** The Shape tab: the selected point, the road's width and curves, and its bridges. */
const RoadShapeTab = ({ road }: { road: TRoad }) => {
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const selectedPoints = useEditor((s) => s.selectedPointIndices);
	const edit = useRoadEdit(road);
	const elevated = road.points.some((p) => p[2] > 0);
	const ownWidths = road.points.filter((p) => pointWidth(p) !== undefined).length;

	return (
		<>
			{selectedPoints.length > 1 ? (
				<RoadPointsPanel road={road} indices={selectedPoints} />
			) : (
				selectedPoint !== null && <RoadPointPanel road={road} index={selectedPoint} />
			)}

			<Section
				id="road.shape"
				icon="spline"
				title="Whole road"
				keywords="shape width curves loop points"
			>
				<SliderField
					label="Width"
					value={road.width}
					min={0.4}
					max={8}
					step={0.1}
					onChange={(v) =>
						edit("width", (r) => {
							r.width = v;
						})
					}
				/>

				{ownWidths > 0 && (
					<Hint>
						{ownWidths === 1
							? "1 point has its own width and keeps it. Select it to change it."
							: `${ownWidths} points have their own widths and keep them. Select one to change it.`}
					</Hint>
				)}

				<SliderField
					label="Curves"
					value={road.cornerRadius}
					min={0}
					max={15}
					step={0.5}
					onChange={(v) =>
						edit("cornerRadius", (r) => {
							r.cornerRadius = v;
						})
					}
				/>

				<SwitchField
					label="Loop (join the ends)"
					checked={road.loops}
					onChange={(v) =>
						edit("loops", (r) => {
							r.loops = v;
						})
					}
				/>

				<Hint>
					These are the whole road's. With no point selected, the arrows at its middle (or G, R, S
					and the arrow keys) move, lift, turn and resize all of it. Click a point to select it,
					Shift- or Ctrl-click to select several; drag them to reshape and lift them with the green
					arrow. Drag a small dot between two points to add one; double-click a point to remove it.
				</Hint>
			</Section>

			{!isHiddenRoute(road.kind) && (
				<Section
					id="road.supports"
					icon="bridge"
					title="Elevated sections"
					keywords="bridge flyover pillars embankment"
				>
					{elevated ? (
						<>
							<SelectField<TRoadHeldUpBy>
								label="Held up by"
								value={road.heldUpBy}
								options={[
									{ value: "pillars", label: "Pillars (roads can pass under)" },
									{ value: "embankment", label: "Embankment (sloped bank)" },
									{ value: "none", label: "Nothing (floating deck)" },
								]}
								onChange={(v) =>
									edit("supports", (r) => {
										r.heldUpBy = v;
									})
								}
							/>

							{road.heldUpBy === "pillars" && (
								<SliderField
									label="Pillar spacing"
									value={road.pillarSpacing}
									min={1}
									max={20}
									step={0.5}
									onChange={(v) =>
										edit("pillarSpacing", (r) => {
											r.pillarSpacing = v;
										})
									}
								/>
							)}

							{road.heldUpBy === "embankment" && (
								<>
									<SliderField
										label="Embankment slope"
										value={road.embankmentAngle}
										min={10}
										max={90}
										step={5}
										suffix="°"
										hint="90° gives straight walls, as if the road sits on a raised block."
										onChange={(v) =>
											edit("embankmentAngle", (r) => {
												r.embankmentAngle = v;
											})
										}
									/>

									<SliderField
										label="Embankment width"
										value={Math.round(road.embankmentWidth * 100)}
										min={5}
										max={100}
										step={5}
										suffix="%"
										hint="Of the road's width. Narrow with a steep slope for a solid wall under the road."
										onChange={(v) =>
											edit("embankmentWidth", (r) => {
												r.embankmentWidth = v / 100;
											})
										}
									/>

									<RoadColorFields road={road} colorId="embankment" label="Embankment colour" />
								</>
							)}

							<SwitchField
								label="Railings"
								checked={road.showsRailings}
								onChange={(v) =>
									edit("railings", (r) => {
										r.showsRailings = v;
									})
								}
							/>
						</>
					) : (
						<Hint>
							Raise points (select them and drag the green arrow up, or set their Altitude) to build
							a bridge or flyover.
						</Hint>
					)}
				</Section>
			)}
		</>
	);
};

/** The Look tab: the road's surface colour (by hand or from data) and markings. */
const RoadLookTab = ({ road }: { road: TRoad }) => {
	const edit = useRoadEdit(road);

	return (
		<>
			<FollowDataNote title="Colours can follow data">
				A road's colours can come from a value in the Data tab: a value holding a colour (red,
				#ff0000), or a number on a colour scale, like a road that turns red as traffic builds.
			</FollowDataNote>

			<Section
				id="road.look"
				icon="palette"
				title="Look"
				keywords="colour color surface markings data heatmap"
			>
				<RoadColorFields road={road} colorId="surface" label="Surface colour" />

				{ROAD_KINDS[road.kind].centreLine && (
					<SwitchField
						label="Centre line"
						checked={road.showsCentreLine}
						onChange={(v) =>
							edit("markings", (r) => {
								r.showsCentreLine = v;
							})
						}
					/>
				)}
			</Section>
		</>
	);
};

/** The properties tabs for a selected road (ADR-0054). A hidden route has no look. */
export const roadTabs = (road: TRoad): IInspectorTab[] => [
	{ value: "object", label: "Road", icon: "road", content: <RoadTab key={road.id} road={road} /> },
	{
		value: "shape",
		label: "Shape",
		icon: "spline",
		content: <RoadShapeTab key={road.id} road={road} />,
	},
	...(isHiddenRoute(road.kind)
		? []
		: [
				{
					value: "look",
					label: "Look",
					icon: "palette",
					content: <RoadLookTab key={road.id} road={road} />,
				} as const,
			]),
];
