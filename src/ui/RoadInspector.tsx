import type { Draft } from "immer";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { roadColor } from "#/render/RoadMesh";
import {
	pointWidth,
	polylineLength,
	ROAD_STYLE_LABELS,
	roadCenterlineOf,
	TURNS_LABELS,
	TURNS_OPTIONS,
	widthForStyle,
} from "#/scene/roads";
import type { TRoad, TRoadLane, TRoadStyle, TRoadSupports, TTurns } from "#/scene/schema";

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
import { RoadPointPanel } from "./RoadPointPanel";

const STYLE_OPTIONS = (Object.keys(ROAD_STYLE_LABELS) as TRoadStyle[]).map((value) => ({
	value,
	label: ROAD_STYLE_LABELS[value],
}));

export const RoadInspector = ({ road }: { road: TRoad }) => {
	const updateRoad = useEditor((s) => s.updateRoad);
	const removeRoad = useEditor((s) => s.removeRoad);
	const followers = useEditor(
		(s) => s.scene.entities.filter((e) => e.follow?.roadId === road.id).length,
	);
	const palette = usePalette();
	const selectedPoint = useEditor((s) => s.selectedPointIndex);
	const sceneTurns = useEditor((s) => s.scene.turns);
	const driving = useEditor((s) => s.scene.driving);

	/** Every edit coalesces per road+field so typing or sliding is one undo step. */
	const edit = (field: string, recipe: (r: Draft<TRoad>) => void) =>
		updateRoad(road.id, recipe, { coalesce: `${road.id}:${field}` });

	const length = polylineLength(roadCenterlineOf(road), road.closed);
	const elevated = road.points.some((p) => p[2] > 0);

	const ownWidths = road.points.filter((p) => pointWidth(p) !== undefined).length;

	return (
		<>
			{selectedPoint !== null && <RoadPointPanel road={road} index={selectedPoint} />}

			<Section
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

				{road.style !== "hidden" && (
					<SelectField<TRoadLane>
						label="Vehicles drive"
						value={road.lane}
						options={[
							{ value: "side", label: `In lanes (keep ${driving})` },
							{ value: "centre", label: "Down the centre (one-way, race track)" },
						]}
						onChange={(v) =>
							edit("lane", (r) => {
								r.lane = v;
							})
						}
					/>
				)}

				<SelectField<TTurns>
					label="Vehicles turn"
					value={road.turns ?? sceneTurns}
					options={TURNS_OPTIONS}
					onChange={(v) =>
						edit("turns", (r) => {
							r.turns = v;
						})
					}
					inherit={{
						from: "scene",
						inherited: road.turns === null,
						onReset: () =>
							edit("turns", (r) => {
								r.turns = null;
							}),
						value: TURNS_LABELS[sceneTurns].toLowerCase(),
					}}
				/>

				<Hint>
					{Math.round(length)} units long · {road.points.length} points
					{followers > 0 && ` · ${followers} vehicle${followers === 1 ? "" : "s"} driving here`}
				</Hint>
			</Section>

			<Section title="Shape">
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
					checked={road.closed}
					onChange={(v) =>
						edit("closed", (r) => {
							r.closed = v;
						})
					}
				/>

				<Hint>
					Click a point to select it. Drag points to reshape (or nudge a selected one with the arrow
					keys), Shift+drag to raise them. Drag a small dot between two points to add one;
					double-click a point to remove it.
				</Hint>
			</Section>

			{road.style !== "hidden" && (
				<Section title="Elevated sections">
					{elevated ? (
						<>
							<SelectField<TRoadSupports>
								label="Held up by"
								value={road.supports}
								options={[
									{ value: "pillars", label: "Pillars (roads can pass under)" },
									{ value: "embankment", label: "Embankment (sloped bank)" },
								]}
								onChange={(v) =>
									edit("supports", (r) => {
										r.supports = v;
									})
								}
							/>

							<SwitchField
								label="Railings"
								checked={road.railings}
								onChange={(v) =>
									edit("railings", (r) => {
										r.railings = v;
									})
								}
							/>
						</>
					) : (
						<Hint>
							Raise a point (select it and set its Height, or Shift+drag it) to build a bridge or
							flyover.
						</Hint>
					)}
				</Section>
			)}

			{road.style !== "hidden" && (
				<Section title="Look">
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

					{road.style === "asphalt" && (
						<SwitchField
							label="Centre line"
							checked={road.markings}
							onChange={(v) =>
								edit("markings", (r) => {
									r.markings = v;
								})
							}
						/>
					)}
				</Section>
			)}
		</>
	);
};
