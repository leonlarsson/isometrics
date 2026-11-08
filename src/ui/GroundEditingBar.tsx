import { useEffect } from "react";

import {
	editGround,
	updateGround,
	useGroundEditing,
	usePickedGround,
} from "#/editor/groundEditing";
import { drawnModeOf, useEditor } from "#/editor/store";
import { groundName } from "#/scene/grounds";

import { Button } from "./Button";
import { FloatingBar } from "./FloatingBar";

/**
 * Over the view while a ground is being moved and shaped (ADR-0155): what its
 * handles do, and Done. It stops by itself on leaving Edit mode, opening
 * another world or selecting something else, whose own handles take over.
 */
export const GroundEditingBar = () => {
	const isOn = useGroundEditing((s) => s.isOn);
	const ground = usePickedGround();
	const index = useEditor((s) => s.scene.grounds.findIndex((each) => each.id === ground.id));
	const mode = useEditor(drawnModeOf);
	const hasSelection = useEditor((s) => s.selectedItems.length > 0);
	const whatIsOpen = useEditor((s) => s.whatIsOpen);
	useEffect(() => {
		if (isOn && (mode !== "edit" || hasSelection)) {
			editGround(false);
		}
	}, [isOn, mode, hasSelection]);
	useEffect(() => () => editGround(false), [whatIsOpen]);
	if (!isOn || mode !== "edit") {
		return null;
	}
	const name = groundName(ground, Math.max(0, index));

	return (
		<FloatingBar
			icon="area"
			title={`Moving and shaping ${name}`}
			actions={
				<>
					{ground.isLocked && (
						<Button
							size="sm"
							icon="unlock"
							onClick={() =>
								updateGround((g) => {
									g.isLocked = false;
								})
							}
						>
							Unlock it
						</Button>
					)}

					<Button size="sm" variant="primary" onClick={() => editGround(false)}>
						Done
					</Button>
				</>
			}
		>
			{ground.isLocked
				? `${name} is locked: unlock it to move or reshape it.`
				: ground.points
					? "The arrows in its middle move it with everything on it. Drag a corner to move it, or a dot between two to add one; double-click a corner (or select it and press Delete) to take it out. The balls on the sides resize it."
					: "The arrows in its middle move it with everything on it. Drag a ball on a side to resize it, or a corner to reshape it. Shapes and rounded corners are in the World tab's Ground panel."}
		</FloatingBar>
	);
};
