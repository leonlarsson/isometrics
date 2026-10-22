import { useHotkeys } from "@tanstack/react-hotkeys";

import { useEditor } from "#/editor/store";

import { IconButton } from "./Button";
import { viewpointName } from "./ViewpointsSection";

import styles from "./DrawingBar.module.css";

/**
 * View mode: step through the world's viewpoints like slides, with ◀ ▶ or
 * the arrow keys. Each shows its name and description. See docs/adr/0039.
 */
export const ViewpointBar = () => {
	const mode = useEditor((s) => s.mode);
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const activeId = useEditor((s) => s.activeViewpointId);
	const shown = mode === "view" && viewpoints.length > 0;
	const index = viewpoints.findIndex((v) => v.id === activeId);

	const step = (by: number) => {
		const count = viewpoints.length;
		const next = index < 0 ? (by > 0 ? 0 : count - 1) : (index + by + count) % count;
		useEditor.getState().goToViewpoint(viewpoints[next].id);
	};

	useHotkeys([
		{
			hotkey: "ArrowRight",
			callback: () => step(1),
			options: { enabled: shown, meta: { name: "Next viewpoint" } },
		},
		{
			hotkey: "ArrowLeft",
			callback: () => step(-1),
			options: { enabled: shown, meta: { name: "Previous viewpoint" } },
		},
	]);

	if (!shown) {
		return null;
	}
	const current = viewpoints[index];

	return (
		<div className={styles.bar} role="status">
			<IconButton icon="chevronLeft" label="Previous viewpoint (←)" onClick={() => step(-1)} />

			<div className={styles.text}>
				{current ? (
					<>
						<strong>{`${index + 1} / ${viewpoints.length} · ${viewpointName(current, index)}`}</strong>

						{current.description && <span>{current.description}</span>}
					</>
				) : (
					<>
						<strong>
							{viewpoints.length === 1 ? "1 viewpoint" : `${viewpoints.length} viewpoints`}
						</strong>

						<span className={styles.keys}>Press → or the arrow to start</span>
					</>
				)}
			</div>

			<IconButton icon="chevronRight" label="Next viewpoint (→)" onClick={() => step(1)} />
		</div>
	);
};
