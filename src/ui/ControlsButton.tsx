import { openControls } from "#/editor/controls";
import { overlayShownIn, usePreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";

import { IconButton } from "./Button";

import styles from "./ControlsButton.module.css";

/**
 * Keys and mouse from the view (ADR-0157): a button in its corner, under the
 * compass when that shows, for whoever can't type ? or doesn't know to. Edit
 * mode only, so View mode stays clean.
 */
export const ControlsButton = () => {
	const mode = useEditor((s) => s.mode);
	const gizmo = usePreferences().navigationGizmo;
	if (mode !== "edit") {
		return null;
	}
	return (
		<div
			className={styles.corner}
			data-under-gizmo={overlayShownIn(gizmo, mode) || undefined}
			data-label-obstacle=""
		>
			<IconButton
				icon="keyboard"
				label="Keys and mouse (?)"
				tooltipSide="left"
				onClick={() => openControls(true)}
			/>
		</div>
	);
};
