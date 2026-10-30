import { useHotkeys } from "@tanstack/react-hotkeys";

import { useEditor } from "#/editor/store";

import { IconButton } from "./Button";
import { viewpointName } from "./ViewpointsSection";

import styles from "./DrawingBar.module.css";

/**
 * View mode: step through the world's viewpoints like slides, with ◀ ▶ or
 * the arrow keys. Each shows its name and description, in a bar as wide as
 * the widest of them, so it doesn't change size while stepping. See
 * docs/adr/0039.
 */
export const ViewpointBar = () => {
	const mode = useEditor((s) => s.mode);
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const activeId = useEditor((s) => s.activeViewpointId);
	// The follow bar takes the same spot while the camera follows a vehicle.
	const following = useEditor((s) => s.cameraFollow !== null);
	// ← and → step through the viewpoints even when the world hides the bar (World tab → On screen).
	const stepping = mode === "view" && viewpoints.length > 0 && !following;
	const barShown = useEditor((s) => s.scene.onScreen.showsViewpointBar);
	const index = viewpoints.findIndex((v) => v.id === activeId);

	const step = (by: number) => {
		const count = viewpoints.length;
		const next = index < 0 ? (by > 0 ? 0 : count - 1) : (index + by + count) % count;
		useEditor.getState().goToViewpoint(viewpoints[next].id);
	};

	// In Edit mode the same keys nudge the selection (editor/useShortcuts); the two are never
	// enabled at once, so sharing them is intended.
	useHotkeys(
		[
			{
				hotkey: "ArrowRight",
				callback: () => step(1),
				options: { enabled: stepping, meta: { name: "Next viewpoint" } },
			},
			{
				hotkey: "ArrowLeft",
				callback: () => step(-1),
				options: { enabled: stepping, meta: { name: "Previous viewpoint" } },
			},
		],
		{ conflictBehavior: "allow" },
	);

	if (!stepping || !barShown) {
		return null;
	}
	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<IconButton icon="chevronLeft" label="Previous viewpoint (←)" onClick={() => step(-1)} />

			{/* Every viewpoint's text laid out in one place, only the current one shown, so the bar stays
			    as wide as the widest while stepping through them. */}
			<div className={styles.slides}>
				<div className={styles.text} aria-hidden={index >= 0}>
					<strong>
						{viewpoints.length === 1 ? "1 viewpoint" : `${viewpoints.length} viewpoints`}
					</strong>

					<span className={`${styles.keys} ${styles.keyboardOnly}`}>
						Press → or the arrow to start
					</span>

					<span className={`${styles.keys} ${styles.touchOnly}`}>Tap the arrow to start</span>
				</div>

				{viewpoints.map((viewpoint, i) => (
					<div key={viewpoint.id} className={styles.text} aria-hidden={i !== index}>
						<strong>{`${i + 1} / ${viewpoints.length} · ${viewpointName(viewpoint, i)}`}</strong>

						{viewpoint.description && <span>{viewpoint.description}</span>}
					</div>
				))}
			</div>

			<IconButton icon="chevronRight" label="Next viewpoint (→)" onClick={() => step(1)} />
		</div>
	);
};
