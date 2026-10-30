import { useState } from "react";

import { useEditor } from "#/editor/store";
import { currentView } from "#/render/viewpoints";

import { Button, IconButton, IconButtonGroup } from "./Button";
import { FieldOfViewField } from "./FieldOfViewField";
import { Hint, resetToDefault, Section, SelectField, TextField } from "./fields";
import { List, ListItem } from "./List";
import { moodName } from "./MoodsSection";

/** A viewpoint's name, or its place in the list when it has none. */
export const viewpointName = (viewpoint: { name: string }, index: number) =>
	viewpoint.name || `Viewpoint ${index + 1}`;

/**
 * The Viewpoints tab's saved viewpoints: save the current view, glide back to one,
 * rename, re-save, describe or delete it. See docs/adr/0039-saved-viewpoints.md.
 */
export const ViewpointsSection = () => {
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const activeId = useEditor((s) => s.activeViewpointId);
	const worldFieldOfView = useEditor((s) => s.scene.camera.fieldOfView);
	const moods = useEditor((s) => s.scene.moods);
	const openingId = useEditor((s) => s.scene.camera.openingViewpointId);
	const openingIndex = viewpoints.findIndex((v) => v.id === openingId);
	const [renaming, setRenaming] = useState<string | null>(null);
	const store = () => useEditor.getState();

	const saveNew = () => {
		const pose = currentView.read?.();
		if (pose) {
			store().addViewpoint(pose);
		}
	};
	const activeIndex = viewpoints.findIndex((v) => v.id === activeId);
	const active = viewpoints[activeIndex];

	return (
		<Section
			id="views.list"
			icon="camera"
			title="Viewpoints"
			keywords="camera views slides opening view start star mood"
		>
			{viewpoints.length === 0 ? (
				<Hint>
					Save views of the world to come back to them, to step through them in View mode like
					slides, or to pick one as the world’s opening view in the Camera tab.
				</Hint>
			) : (
				<List>
					{viewpoints.map((viewpoint, index) => {
						const name = viewpointName(viewpoint, index);
						return (
							<ListItem
								key={viewpoint.id}
								label={name}
								meta={viewpoint.projection === "perspective" ? "Perspective" : undefined}
								current={viewpoint.id === activeId}
								onClick={() => store().goToViewpoint(viewpoint.id)}
								reorder={{
									index,
									count: viewpoints.length,
									onMove: (to) => store().moveViewpoint(viewpoint.id, to),
								}}
								rename={{
									value: viewpoint.name,
									placeholder: `Viewpoint ${index + 1}`,
									editing: renaming === viewpoint.id,
									onEditingChange: (editing) => setRenaming(editing ? viewpoint.id : null),
									onCommit: (text) =>
										store().updateViewpoint(viewpoint.id, (v) => {
											v.name = text;
										}),
								}}
								actions={
									<IconButtonGroup>
										<IconButton
											icon="star"
											label={
												viewpoint.id === openingId
													? `“${name}” is the opening view (click for the whole world instead)`
													: `Make “${name}” the opening view`
											}
											pressed={viewpoint.id === openingId}
											onClick={() =>
												store().setOpeningViewpoint(
													viewpoint.id === openingId ? null : viewpoint.id,
												)
											}
										/>

										<IconButton
											icon="camera"
											label={`Save the current view as “${name}”`}
											onClick={() => {
												const pose = currentView.read?.();
												if (pose) {
													store().updateViewpoint(viewpoint.id, (v) => {
														Object.assign(v, pose);
													});
												}
											}}
										/>

										<IconButton
											icon="trash"
											label={`Delete “${name}”`}
											onClick={() => store().removeViewpoint(viewpoint.id)}
										/>
									</IconButtonGroup>
								}
							/>
						);
					})}
				</List>
			)}

			{active && (
				<TextField
					label={`What “${viewpointName(active, activeIndex)}” shows`}
					value={active.description}
					placeholder="Shown with it in View mode"
					multiline
					onChange={(text) =>
						store().updateViewpoint(
							active.id,
							(v) => {
								v.description = text;
							},
							{ coalesce: `viewpoint:${active.id}:description` },
						)
					}
					inherit={resetToDefault(
						active.description,
						"",
						() =>
							store().updateViewpoint(active.id, (v) => {
								v.description = "";
							}),
						"none",
					)}
				/>
			)}

			{active && (
				<SelectField<string>
					label={`Mood with “${viewpointName(active, activeIndex)}”`}
					value={active.moodId ?? ""}
					options={[
						{ value: "", label: "Leave the look as it is" },
						...moods.map((mood, index) => ({ value: mood.id, label: moodName(mood, index) })),
					]}
					onChange={(id) =>
						store().updateViewpoint(active.id, (v) => {
							v.moodId = id || null;
						})
					}
					inherit={{
						from: "default",
						inherited: active.moodId === null,
						onReset: () =>
							store().updateViewpoint(active.id, (v) => {
								v.moodId = null;
							}),
						value: "leave the look as it is",
					}}
					hint={
						moods.length === 0
							? "Save moods in the Moods tab, then pick one here: going to this view puts it on."
							: "Going to this view also puts on the mood's time of day, light, sky, water and tilt-shift."
					}
				/>
			)}

			{active && moods.length === 0 && (
				<Button size="sm" icon="palette" onClick={() => store().setTab("moods")}>
					Open the Moods tab
				</Button>
			)}

			{active?.projection === "perspective" && (
				<FieldOfViewField
					value={active.fieldOfView ?? worldFieldOfView}
					onChange={(v) =>
						store().updateViewpoint(
							active.id,
							(viewpoint) => {
								viewpoint.fieldOfView = v;
							},
							{ coalesce: `viewpoint:${active.id}:fieldOfView` },
						)
					}
					inherit={{
						from: "scene",
						inherited: active.fieldOfView === null,
						onReset: () =>
							store().updateViewpoint(active.id, (viewpoint) => {
								viewpoint.fieldOfView = null;
							}),
						degrees: worldFieldOfView,
					}}
					hint={`“${viewpointName(active, activeIndex)}” only; the world’s is in the Camera tab.`}
				/>
			)}

			{viewpoints.length > 0 && (
				<>
					<Hint>
						{openingIndex >= 0
							? `★ “${viewpointName(viewpoints[openingIndex], openingIndex)}” is the opening view: the world opens there for others, and re-centring goes there.`
							: "Star a viewpoint to make it the opening view: the world opens there for others, and re-centring goes there."}{" "}
						Also in the Camera tab.
					</Hint>

					<Button size="sm" icon="video" onClick={() => store().setTab("camera")}>
						Open the Camera tab
					</Button>
				</>
			)}

			<Button size="sm" icon="plus" onClick={saveNew}>
				Save the current view
			</Button>
		</Section>
	);
};
