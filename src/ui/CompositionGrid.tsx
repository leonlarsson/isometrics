import { useCameraFeel } from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";

import styles from "./CompositionGrid.module.css";

/**
 * A rule-of-thirds grid over the 3D view in Edit mode, with a mark at the
 * view's middle, for lining up viewpoints (Your camera → Composition grid, a
 * setting of this browser). It covers only the part of the view not under the
 * narrow layout's sheet.
 */
export const CompositionGrid = () => {
	const shown = useCameraFeel().compositionGrid;
	const editing = useEditor((s) => s.mode === "edit");
	const inset = useEditor((s) => s.viewInset);
	if (!shown || !editing) {
		return null;
	}
	return (
		<div className={styles.grid} style={{ bottom: inset }} aria-hidden>
			<div className={styles.centre} />
		</div>
	);
};
