import { useRef } from "react";

import { downloadScene, readSceneFile } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import type { TThemePreference } from "#/scene/schema";

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

const ToolButton = ({
	icon,
	label,
	onClick,
	disabled,
	pressed,
}: {
	icon: TIconName;
	label: string;
	onClick: () => void;
	disabled?: boolean;
	pressed?: boolean;
}) => {
	return (
		<button
			type="button"
			className={styles.toolButton}
			title={label}
			aria-label={label}
			aria-pressed={pressed}
			disabled={disabled}
			onClick={onClick}
		>
			<Icon name={icon} />
		</button>
	);
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
	const loadScene = useEditor((s) => s.loadScene);
	const title = useEditor((s) => s.scene.meta.title);
	const fileInput = useRef<HTMLInputElement>(null);

	const themeInfo = THEME_CYCLE[theme];

	return (
		<header className={styles.toolbar}>
			<div className={styles.brand}>
				<span className={styles.logo} aria-hidden="true" />

				<span className={styles.title}>{title}</span>
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

						{m === "edit" ? "Edit" : "View"}
					</button>
				))}
			</fieldset>

			<div className={styles.actions}>
				{mode === "edit" && (
					<>
						<ToolButton icon="undo" label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />

						<ToolButton
							icon="redo"
							label="Redo (Ctrl+Shift+Z)"
							onClick={redo}
							disabled={!canRedo}
						/>

						<ToolButton
							icon="grid"
							label={snapping ? "Snap to grid: on" : "Snap to grid: off"}
							pressed={snapping}
							onClick={toggleSnapping}
						/>

						<span className={styles.divider} />
					</>
				)}

				<ToolButton
					icon={playing ? "pause" : "play"}
					label={playing ? "Pause motion" : "Play motion"}
					onClick={togglePlaying}
				/>

				<ToolButton icon="focus" label="Re-centre camera" onClick={resetView} />

				<ToolButton
					icon={themeInfo.icon}
					label={themeInfo.label}
					onClick={() =>
						commit((s) => {
							s.theme = themeInfo.next;
						})
					}
				/>

				<span className={styles.divider} />

				<ToolButton
					icon="download"
					label="Export as file"
					onClick={() => downloadScene(useEditor.getState().scene)}
				/>

				<ToolButton icon="upload" label="Import file" onClick={() => fileInput.current?.click()} />

				<input
					ref={fileInput}
					type="file"
					accept="application/json,.json"
					hidden
					onChange={async (e) => {
						const file = e.target.files?.[0];
						e.target.value = "";
						if (!file) {
							return;
						}
						try {
							loadScene(await readSceneFile(file));
							resetView();
						} catch (error) {
							window.alert(
								`That file isn’t a valid dashboard.\n\n${error instanceof Error ? error.message : String(error)}`,
							);
						}
					}}
				/>
			</div>
		</header>
	);
};
