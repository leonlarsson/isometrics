import { useState } from "react";

import { useEditor } from "#/editor/store";
import { currentView } from "#/render/viewpoints";

import { Button, IconButton, IconButtonGroup } from "./Button";
import { Hint, Section, SliderField, TextField } from "./fields";
import { List, ListItem } from "./List";

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
			keywords="camera views slides opening view start star"
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
								meta={viewpoint.perspective ? "Perspective" : undefined}
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
				/>
			)}

			{active?.perspective && (
				<SliderField
					label="Field of view"
					value={active.fieldOfView ?? worldFieldOfView}
					min={10}
					max={100}
					step={1}
					suffix="°"
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
						value: `${worldFieldOfView}°`,
					}}
					hint={`“${viewpointName(active, activeIndex)}” only; the world’s field of view is in the Camera tab.`}
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
