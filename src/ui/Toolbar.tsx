import { useEditor } from "#/editor/store";
import { APP_NAME } from "#/lib/app";
import type { TThemePreference } from "#/scene/schema";

import { IconButton } from "./Button";
import { FileMenu } from "./FileMenu";
import { Icon, type TIconName } from "./Icon";

import styles from "./Toolbar.module.css";

const THEME_CYCLE: Record<
	TThemePreference,
	{ next: TThemePreference; icon: TIconName; label: string }
> = {
	system: { next: "light", icon: "system", label: "Theme: match device" },
	light: { next: "dark", icon: "sun", label: "Theme: light" },
	dark: { next: "system", icon: "moon", label: "Theme: dark" },
};

export const Toolbar = () => {
	const mode = useEditor((s) => s.mode);
	const setMode = useEditor((s) => s.setMode);
	const canUndo = useEditor((s) => s.past.length > 0);
	const canRedo = useEditor((s) => s.future.length > 0);
	const undo = useEditor((s) => s.undo);
	const redo = useEditor((s) => s.redo);
	const snapping = useEditor((s) => s.snapping);
	const toggleSnapping = useEditor((s) => s.toggleSnapping);
	const playing = useEditor((s) => s.playing);
	const togglePlaying = useEditor((s) => s.togglePlaying);
	const resetView = useEditor((s) => s.resetView);
	const theme = useEditor((s) => s.scene.theme);
	const commit = useEditor((s) => s.commit);

	const themeInfo = THEME_CYCLE[theme];

	return (
		<header className={styles.toolbar}>
			<div className={styles.brand}>
				<span className={styles.logo} aria-hidden="true" />

				<span className={styles.title}>{APP_NAME}</span>

				<FileMenu />
			</div>

			<fieldset className={styles.modes} aria-label="Mode">
				{(["edit", "view"] as const).map((m) => (
					<button
						key={m}
						type="button"
						aria-pressed={mode === m}
						className={styles.mode}
						onClick={() => setMode(m)}
					>
						<Icon name={m === "edit" ? "edit" : "eye"} size={16} />

						{/* Visually hidden on narrow screens, but still the button's name. */}
						<span className={styles.modeLabel}>{m === "edit" ? "Edit" : "View"}</span>
					</button>
				))}
			</fieldset>

			<div className={styles.actions}>
				{mode === "edit" && (
					<>
						<IconButton
							size="md"
							tooltipSide="bottom"
							icon="undo"
							label="Undo (Ctrl+Z)"
							onClick={undo}
							disabled={!canUndo}
						/>

						<IconButton
							size="md"
							tooltipSide="bottom"
							icon="redo"
							label="Redo (Ctrl+Shift+Z)"
							onClick={redo}
							disabled={!canRedo}
						/>

						<IconButton
							size="md"
							tooltipSide="bottom"
							icon="grid"
							label={snapping ? "Snap to grid: on" : "Snap to grid: off"}
							pressed={snapping}
							onClick={toggleSnapping}
						/>

						<span className={styles.divider} />
					</>
				)}

				<IconButton
					size="md"
					tooltipSide="bottom"
					icon={playing ? "pause" : "play"}
					label={playing ? "Pause motion (Space)" : "Play motion (Space)"}
					onClick={togglePlaying}
				/>

				<IconButton
					size="md"
					tooltipSide="bottom"
					icon="focus"
					label="Re-centre camera"
					onClick={resetView}
				/>

				<IconButton
					size="md"
					tooltipSide="bottom"
					icon={themeInfo.icon}
					label={themeInfo.label}
					onClick={() =>
						commit((s) => {
							s.theme = themeInfo.next;
						})
					}
				/>
			</div>
		</header>
	);
};
