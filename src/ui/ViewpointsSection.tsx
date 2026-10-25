import { useState } from "react";

import { useEditor } from "#/editor/store";
import { currentView } from "#/render/viewpoints";

import { Button, IconButton, IconButtonGroup } from "./Button";
import { Hint, Section, SelectField, TextField } from "./fields";
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
	const openingId = useEditor((s) => s.scene.camera.openingViewpointId);
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
			keywords="camera views slides opening start"
		>
			{viewpoints.length === 0 ? (
				<Hint>
					Save views of the world to come back to them, to step through them in View mode like
					slides, or to make the world open at one.
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

			{viewpoints.length > 0 && (
				<SelectField
					label="Opening view"
					value={viewpoints.some((v) => v.id === openingId) ? (openingId ?? "") : ""}
					options={[
						{ value: "", label: "The whole world" },
						...viewpoints.map((viewpoint, index) => ({
							value: viewpoint.id,
							label: viewpointName(viewpoint, index),
						})),
					]}
					onChange={(id) => store().setOpeningViewpoint(id || null)}
					hint="Where the world opens for anyone who hasn’t looked around it in their browser yet (a shared file, another browser), and where re-centring the camera goes."
				/>
			)}

			<Button size="sm" icon="plus" onClick={saveNew}>
				Save the current view
			</Button>
		</Section>
	);
};
