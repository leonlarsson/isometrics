import { overlayShownIn, useCameraFeel } from "#/editor/cameraFeel";
import { useEditor } from "#/editor/store";

import styles from "./CompositionGrid.module.css";

/**
 * A rule-of-thirds grid over the 3D view in Edit mode, with a mark at the
 * view's middle, for lining up viewpoints (Your camera → Composition grid, a
 * setting of this browser). It covers only the part of the view not under the
 * narrow layout's sheet.
 */
export const CompositionGrid = () => {
	const place = useCameraFeel().compositionGrid;
	const mode = useEditor((s) => s.mode);
	const inset = useEditor((s) => s.viewInset);
	if (!overlayShownIn(place, mode)) {
		return null;
	}
	return (
		<div className={styles.grid} style={{ bottom: inset }} aria-hidden>
			<div className={styles.centre} />
		</div>
	);
};
