import { useState } from "react";

import { useEditor } from "#/editor/store";
import { currentView } from "#/render/viewpoints";

import { Button, IconButton, IconButtonGroup } from "./Button";
import { Hint, Section, TextField } from "./fields";
import { List, ListItem } from "./List";

/** A viewpoint's name, or its place in the list when it has none. */
export const viewpointName = (viewpoint: { name: string }, index: number) =>
	viewpoint.name || `Viewpoint ${index + 1}`;

/**
 * The Scene tab's saved viewpoints: save the current view, glide back to one,
 * rename, re-save, describe or delete it. See docs/adr/0039-saved-viewpoints.md.
 */
export const ViewpointsSection = () => {
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const activeId = useEditor((s) => s.activeViewpointId);
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
		<Section title="Viewpoints">
			{viewpoints.length === 0 ? (
				<Hint>
					Save views of the world to come back to them, or to step through them in View mode like
					slides.
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

			<Button size="sm" icon="plus" onClick={saveNew}>
				Save the current view
			</Button>
		</Section>
	);
};
