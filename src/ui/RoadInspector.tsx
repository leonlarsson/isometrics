import type { Draft } from "immer";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { roadColor } from "#/render/RoadMesh";
import {
	isHiddenRoute,
	pointWidth,
	polylineLength,
	ROAD_STYLE_LABELS,
	ROAD_STYLES,
	roadCenterlineOf,
	TURN_STYLE_LABELS,
	TURN_STYLE_OPTIONS,
	widthForStyle,
} from "#/scene/roads";
import type { TDrivingLane, TRoad, TRoadStyle, TRoadSupports, TTurnStyle } from "#/scene/schema";

import { IconButton, IconButtonGroup } from "./Button";
import {
	ColorField,
	Hint,
	Section,
	SelectField,
	SliderField,
	SwitchField,
	TextField,
} from "./fields";
import type { IInspectorTab } from "./inspectorTabs";
import { RoadPointPanel, RoadPointsPanel } from "./RoadPointPanel";

const STYLE_OPTIONS = (Object.keys(ROAD_STYLE_LABELS) as TRoadStyle[]).map((value) => ({
	value,
	label: ROAD_STYLE_LABELS[value],
}));

/** Every edit coalesces per road+field so typing or sliding is one undo step. */
const useRoadEdit = (road: TRoad) => {
	const updateRoad = useEditor((s) => s.updateRoad);
	return (field: string, recipe: (r: Draft<TRoad>) => void) =>
		updateRoad(road.id, recipe, { coalesce: `${road.id}:${field}` });
};

/** The Road tab: its name and style, and how vehicles drive on it. */
const RoadTab = ({ road }: { road: TRoad }) => {
	const removeRoad = useEditor((s) => s.removeRoad);
	const followers = useEditor(
		(s) => s.scene.entities.filter((e) => e.follow?.roadId === road.id).length,
	);
	const sceneTurns = useEditor((s) => s.scene.turnStyle);
	const driving = useEditor((s) => s.scene.drivingSide);
	const edit = useRoadEdit(road);
	const length = polylineLength(roadCenterlineOf(road), road.loops);

	return (
		<>
			<Section
				icon="road"
				title={ROAD_STYLE_LABELS[road.style]}
				actions={
					<IconButtonGroup>
						<IconButton
							icon={road.locked ? "lock" : "unlock"}
							label={road.locked ? "Unlock" : "Lock its shape"}
							pressed={road.locked}
							onClick={() =>
								edit("locked", (r) => {
									r.locked = !r.locked;
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
					placeholder={ROAD_STYLE_LABELS[road.style]}
					onChange={(v) =>
						edit("name", (r) => {
							r.name = v;
						})
					}
				/>

				<SelectField<TRoadStyle>
					label="Style"
					value={road.style}
					options={STYLE_OPTIONS}
					onChange={(v) =>
						edit("style", (r) => {
							r.width = widthForStyle(r.width, r.style, v);
							r.style = v;
						})
					}
				/>
			</Section>

			<Section id="road.traffic" icon="car" title="Traffic" keywords="vehicles lanes turns">
				{!isHiddenRoute(road.style) && (
					<SelectField<TDrivingLane>
						label="Vehicles drive"
						value={road.drivingLane}
						options={[
							{ value: "side", label: `In lanes (keep ${driving})` },
							{ value: "centre", label: "Down the centre (one-way, race track)" },
						]}
						onChange={(v) =>
							edit("lane", (r) => {
								r.drivingLane = v;
							})
						}
					/>
				)}

				<SelectField<TTurnStyle>
					label="Vehicles turn"
					value={road.turnStyle ?? sceneTurns}
					options={TURN_STYLE_OPTIONS}
					onChange={(v) =>
						edit("turns", (r) => {
							r.turnStyle = v;
						})
					}
					inherit={{
						from: "scene",
						inherited: road.turnStyle === null,
						onReset: () =>
							edit("turns", (r) => {
								r.turnStyle = null;
							}),
						value: TURN_STYLE_LABELS[sceneTurns].toLowerCase(),
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
	const palette = usePalette();
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

			{!isHiddenRoute(road.style) && (
				<Section
					id="road.supports"
					icon="bridge"
					title="Elevated sections"
					keywords="bridge flyover pillars embankment"
				>
					{elevated ? (
						<>
							<SelectField<TRoadSupports>
								label="Held up by"
								value={road.supports}
								options={[
									{ value: "pillars", label: "Pillars (roads can pass under)" },
									{ value: "embankment", label: "Embankment (sloped bank)" },
									{ value: "none", label: "Nothing (floating deck)" },
								]}
								onChange={(v) =>
									edit("supports", (r) => {
										r.supports = v;
									})
								}
							/>

							{road.supports === "pillars" && (
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

							{road.supports === "embankment" && (
								<>
									<SliderField
										label="Bank slope"
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
										label="Bank width"
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

									<ColorField
										label="Bank colour"
										value={road.embankmentColor ?? palette.embankment}
										onChange={(v) =>
											edit("embankmentColor", (r) => {
												r.embankmentColor = v;
											})
										}
										inherit={{
											from: "default",
											inherited: road.embankmentColor === null,
											onReset: () =>
												edit("embankmentColor", (r) => {
													r.embankmentColor = null;
												}),
										}}
									/>
								</>
							)}

							<SwitchField
								label="Railings"
								checked={road.showRailings}
								onChange={(v) =>
									edit("railings", (r) => {
										r.showRailings = v;
									})
								}
							/>
						</>
					) : (
						<Hint>
							Raise points (select them and drag the green arrow up, or set their Height) to build a
							bridge or flyover.
						</Hint>
					)}
				</Section>
			)}
		</>
	);
};

/** The Look tab: the road's surface colour and markings. */
const RoadLookTab = ({ road }: { road: TRoad }) => {
	const palette = usePalette();
	const edit = useRoadEdit(road);

	return (
		<Section id="road.look" icon="palette" title="Look" keywords="colour color surface markings">
			<ColorField
				label="Surface"
				value={roadColor(road, palette)}
				onChange={(v) =>
					edit("color", (r) => {
						r.color = v;
					})
				}
				inherit={{
					from: "default",
					inherited: road.color === null,
					onReset: () =>
						edit("color", (r) => {
							r.color = null;
						}),
				}}
			/>

			{ROAD_STYLES[road.style].centreLine && (
				<SwitchField
					label="Centre line"
					checked={road.showMarkings}
					onChange={(v) =>
						edit("markings", (r) => {
							r.showMarkings = v;
						})
					}
				/>
			)}
		</Section>
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
	...(isHiddenRoute(road.style)
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
