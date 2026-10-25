import { useEditor } from "#/editor/store";

import { Button } from "./Button";
import { Kbd } from "./fields";

import styles from "./DrawingBar.module.css";
import boxStyles from "./SelectionBox.module.css";

/**
 * While B / Shift+B (or the toolbar's Select box) waits for a drag (ADR-0064):
 * what the drag will do, and the box itself as it's drawn.
 */
export const BoxSelectBar = () => {
	const mode = useEditor((s) => s.boxSelect);
	const drag = useEditor((s) => s.boxDrag);
	// While a point or corner is selected, the box selects its road's points or area's corners.
	const what = useEditor((s) =>
		s.selectedPointIndex === null ? null : s.selectedRoadId ? "points" : "corners",
	);
	if (!mode) {
		return null;
	}
	const adding = mode === "add";

	return (
		<>
			<div className={styles.bar} data-label-obstacle="" role="status">
				<div className={styles.text}>
					<strong>{`${adding ? "Select" : "Deselect"} ${what ? `${what} ` : ""}with a box`}</strong>

					<span>
						{`Drag over the ${what ?? "things"} to ${adding ? "add to" : "take out of"} the selection.`}
					</span>

					{adding && (
						<span className={styles.keys}>
							Hold <Kbd>Ctrl</Kbd> when letting go to take out instead
						</span>
					)}

					<span className={styles.keys}>
						<Kbd>Esc</Kbd> or right-click to cancel
					</span>
				</div>

				<div className={styles.actions}>
					<Button onClick={() => useEditor.getState().setBoxSelect(null)}>Cancel</Button>
				</div>
			</div>

			{drag && (
				<div
					className={boxStyles.box}
					data-removing={drag.removing || undefined}
					style={{ ...drag.rect }}
				/>
			)}
		</>
	);
};
