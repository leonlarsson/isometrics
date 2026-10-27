import { toggleSidePanes, useSidePanes } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { APP_NAME } from "#/lib/app";
import type { TThemePreference } from "#/scene/schema";

import { IconButton, IconButtonGroup } from "./Button";
import { CameraMenu } from "./CameraMenu";
import { FileMenu } from "./FileMenu";
import { Icon, type TIconName } from "./Icon";
import { Menu } from "./Menu";
import { SaveStatus } from "./SaveStatus";
import { ShadingMenuGroup, ShadingSwitcher } from "./ShadingSwitcher";
import { ViewpointsMenu } from "./ViewpointsMenu";

import styles from "./Toolbar.module.css";

const THEME_CYCLE: Record<
	TThemePreference,
	{ next: TThemePreference; icon: TIconName; label: string; nextLabel: string }
> = {
	system: {
		next: "light",
		icon: "system",
		label: "Theme: match device",
		nextLabel: "Switch to light",
	},
	light: { next: "dark", icon: "sun", label: "Theme: light", nextLabel: "Switch to dark" },
	dark: { next: "system", icon: "moon", label: "Theme: dark", nextLabel: "Switch to match device" },
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
	const perspective = useEditor((s) => s.projection === "perspective");
	const toggleProjection = useEditor((s) => s.toggleProjection);
	const theme = useEditor((s) => s.scene.theme);
	const commit = useEditor((s) => s.commit);
	const boxSelecting = useEditor((s) => s.boxSelect === "add");
	const toggleBoxSelect = () => useEditor.getState().setBoxSelect(boxSelecting ? null : "add");
	const painting = useEditor((s) => s.painting);

	const panes = useSidePanes();
	const panesHidden = !panes.left && !panes.right;
	const themeInfo = THEME_CYCLE[theme];
	const cycleTheme = () =>
		commit((s) => {
			s.theme = themeInfo.next;
		});

	return (
		<header className={styles.toolbar}>
			<div className={styles.brand}>
				<span className={styles.logo} aria-hidden="true" />

				<span className={styles.title}>{APP_NAME}</span>

				<FileMenu />

				<SaveStatus />
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
				{/* Buttons come in clusters, like the mode switch: history, snapping, the view. */}
				{mode === "edit" && (
					<IconButtonGroup cluster="History">
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
					</IconButtonGroup>
				)}

				{mode === "edit" && (
					<span className={styles.wideOnly}>
						<IconButtonGroup cluster="Editing">
							<IconButton
								size="md"
								tooltipSide="bottom"
								icon="grid"
								label={snapping ? "Snap to grid: on" : "Snap to grid: off"}
								pressed={snapping}
								onClick={toggleSnapping}
							/>

							<IconButton
								size="md"
								tooltipSide="bottom"
								icon="boxSelect"
								label="Select with a box (B)"
								pressed={boxSelecting}
								onClick={toggleBoxSelect}
							/>

							<IconButton
								size="md"
								tooltipSide="bottom"
								icon="brush"
								label="Paint objects: trees, bushes, rocks… (N)"
								pressed={painting}
								onClick={() => useEditor.getState().setPainting(!painting)}
							/>

							<IconButton
								size="md"
								tooltipSide="bottom"
								icon="sidebars"
								label={
									panesHidden
										? "Show the side panels (Ctrl+Space)"
										: "Hide the side panels (Ctrl+Space)"
								}
								pressed={panesHidden}
								onClick={toggleSidePanes}
							/>
						</IconButtonGroup>
					</span>
				)}

				<ViewpointsMenu />

				<span className={styles.wideOnly}>
					<ShadingSwitcher />
				</span>

				<span className={styles.wideOnly}>
					<IconButtonGroup cluster="View">
						<IconButton
							size="md"
							tooltipSide="bottom"
							icon={playing ? "pause" : "play"}
							label={playing ? "Pause motion (Space)" : "Play motion (Space)"}
							onClick={togglePlaying}
						/>

						<CameraMenu />

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
							onClick={cycleTheme}
						/>
					</IconButtonGroup>
				</span>

				{/* Phones: the buttons above that don't fit, as a menu. */}
				<span className={styles.narrowOnly}>
					<Menu.Root>
						<Menu.Trigger label="More" chevron={false}>
							<Icon name="more" size={18} />
						</Menu.Trigger>

						<Menu.Popup>
							<Menu.CheckboxItem
								icon="play"
								label="Play motion"
								checked={playing}
								onCheckedChange={togglePlaying}
							/>

							<Menu.CheckboxItem
								icon="perspective"
								label="Perspective"
								checked={perspective}
								onCheckedChange={toggleProjection}
							/>

							{mode === "edit" && (
								<Menu.CheckboxItem
									icon="grid"
									label="Snap to grid"
									checked={snapping}
									onCheckedChange={toggleSnapping}
								/>
							)}

							{mode === "edit" && (
								<Menu.Item
									icon="boxSelect"
									label="Select with a box"
									description="Then drag over what to select"
									onClick={toggleBoxSelect}
								/>
							)}

							<Menu.Separator />

							<ShadingMenuGroup />

							<Menu.Separator />

							<Menu.Item icon="focus" label="Re-centre camera" onClick={resetView} />

							<Menu.Item
								icon={themeInfo.icon}
								label={themeInfo.label}
								description={themeInfo.nextLabel}
								onClick={cycleTheme}
							/>
						</Menu.Popup>
					</Menu.Root>
				</span>
			</div>
		</header>
	);
};
