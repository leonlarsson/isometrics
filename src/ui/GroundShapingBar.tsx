import { useEffect } from "react";

import { shapeGround, useGroundShaping } from "#/editor/groundShaping";
import { drawnModeOf, useEditor } from "#/editor/store";

import { Button } from "./Button";
import { FloatingBar } from "./FloatingBar";

/**
 * Over the view while the ground is being shaped (ADR-0155): what its handles
 * do, and Done. Shaping stops by itself on leaving Edit mode, opening another
 * world or selecting something else, whose own handles take over.
 */
export const GroundShapingBar = () => {
	const isOn = useGroundShaping((s) => s.isOn);
	const isShape = useEditor((s) => s.scene.ground.points !== null);
	const mode = useEditor(drawnModeOf);
	const hasSelection = useEditor((s) => s.selectedItems.length > 0);
	const whatIsOpen = useEditor((s) => s.whatIsOpen);
	useEffect(() => {
		if (isOn && (mode !== "edit" || hasSelection)) {
			shapeGround(false);
		}
	}, [isOn, mode, hasSelection]);
	useEffect(() => () => shapeGround(false), [whatIsOpen]);
	if (!isOn || mode !== "edit") {
		return null;
	}

	return (
		<FloatingBar
			icon="area"
			title="Shaping the ground"
			actions={
				<Button size="sm" variant="primary" onClick={() => shapeGround(false)}>
					Done
				</Button>
			}
		>
			{isShape
				? "Drag a corner to move it, or a dot between two to add one; double-click a corner to take it out. Click a corner for the move gizmo."
				: "Drag a side to resize it, or a corner to reshape it. Shapes and rounded corners are in the World tab's Ground panel."}
		</FloatingBar>
	);
};
