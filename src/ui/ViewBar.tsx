import { type ReactNode, useRef } from "react";

import { useEditor } from "#/editor/store";

import { IconButton, IconButtonGroup } from "./Button";
import { CameraMenu } from "./CameraMenu";
import { Icon } from "./Icon";
import { Menu } from "./Menu";
import { OverlaysMenu, OverlaysSubmenu } from "./OverlaysMenu";
import { ShadingMenu, ShadingMenuGroup, ShadingSwitcher } from "./ShadingSwitcher";
import { useThemeCycle } from "./useThemeCycle";
import { useViewBarFolds, VIEW_BAR_FOLDS } from "./useViewBarFolds";
import { ViewpointsMenu } from "./ViewpointsMenu";

import styles from "./ViewBar.module.css";

/** A menu's groups of items, by name, with a line between each, leaving out the empty ones. */
const withSeparators = (groups: Record<string, ReactNode[]>) =>
	Object.entries(groups)
		.map(([name, items]) => [name, items.filter(Boolean)] as const)
		.filter(([, items]) => items.length > 0)
		.flatMap(([name, items], index) =>
			index === 0 ? items : [<Menu.Separator key={`${name}-line`} />, ...items],
		);

interface IViewBarProps {
	/**
	 * On phones, inside the app row: one row for both, as the phone toolbar was (ADR-0046),
	 * already folded as far as the phone toolbar is, and the theme in More (the tray has no room).
	 */
	isInline?: boolean;
}

/**
 * The view bar (ADR-0142): the 3D view's own bar, across the top of the view between the side
 * panels, with what's about editing and looking: the Edit/View switch, undo and redo, the tools,
 * then Views, Overlays, the shading switcher and the camera. It folds by its own width, in steps
 * (useViewBarFolds), into More; what's about the app and this browser is in the app row above.
 */
export const ViewBar = ({ isInline = false }: IViewBarProps) => {
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
	const boxSelecting = useEditor((s) => s.boxSelect === "add");
	const toggleBoxSelect = () => useEditor.getState().setBoxSelect(boxSelecting ? null : "add");
	const painting = useEditor((s) => s.painting);
	const togglePainting = () => useEditor.getState().setPainting(!painting);
	const theme = useThemeCycle();
	const editing = mode === "edit";

	const bar = useRef<HTMLDivElement>(null);
	const folds = useViewBarFolds(bar, mode, isInline ? "viewMenus" : null);

	// What the bar has folded away at this width (only that), as the More menu.
	const more = withSeparators({
		history: [
			folds("history") && editing && (
				<Menu.Item
					key="undo"
					icon="undo"
					label="Undo"
					shortcut="Ctrl+Z"
					disabled={!canUndo}
					onClick={undo}
				/>
			),
			folds("history") && editing && (
				<Menu.Item
					key="redo"
					icon="redo"
					label="Redo"
					shortcut="Ctrl+Shift+Z"
					disabled={!canRedo}
					onClick={redo}
				/>
			),
		],
		switches: [
			folds("view") && (
				<Menu.CheckboxItem
					key="play"
					icon="play"
					label="Play motion"
					checked={playing}
					onCheckedChange={togglePlaying}
				/>
			),
			folds("viewMenus") && (
				<Menu.CheckboxItem
					key="perspective"
					icon="perspective"
					label="Perspective"
					checked={perspective}
					onCheckedChange={toggleProjection}
				/>
			),
			folds("tools") && editing && (
				<Menu.CheckboxItem
					key="snap"
					icon="grid"
					label="Snap to grid"
					checked={snapping}
					onCheckedChange={toggleSnapping}
				/>
			),
			folds("tools") && editing && (
				<Menu.Item
					key="box"
					icon="boxSelect"
					label="Select with a box"
					description="Then drag over what to select"
					onClick={toggleBoxSelect}
				/>
			),
			// Painting is a desktop tool; the phone toolbar never had it (ADR-0046).
			folds("tools") && editing && !isInline && (
				<Menu.CheckboxItem
					key="paint"
					icon="brush"
					label="Paint objects"
					checked={painting}
					onCheckedChange={togglePainting}
				/>
			),
		],
		look: [
			folds("viewMenus") && <ShadingMenuGroup key="shading" />,
			folds("viewMenus") && <OverlaysSubmenu key="overlays" />,
		],
		rest: [
			folds("view") && (
				<Menu.Item key="recentre" icon="focus" label="Re-centre camera" onClick={resetView} />
			),
			isInline && (
				<Menu.Item
					key="theme"
					icon={theme.icon}
					label={theme.label}
					description={theme.nextLabel}
					onClick={theme.cycle}
				/>
			),
		],
	});

	return (
		<div
			ref={bar}
			className={styles.bar}
			data-view-bar=""
			data-inline={isInline || undefined}
			// What it has folded at this width, for the tests: "shading viewsLabel …".
			data-folded={VIEW_BAR_FOLDS.filter(folds).join(" ")}
			data-folds-mode-labels={folds("modeLabels") || undefined}
		>
			<div className={styles.start}>
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

							{/* Visually hidden once folded, but still the button's name. */}
							<span className={styles.modeLabel}>{m === "edit" ? "Edit" : "View"}</span>
						</button>
					))}
				</fieldset>

				{/* Buttons come in clusters, like the mode switch: history, the tools, the view. */}
				{editing && !folds("history") && (
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

				{editing && !folds("tools") && (
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
							onClick={togglePainting}
						/>
					</IconButtonGroup>
				)}
			</div>

			<div className={styles.end}>
				<ViewpointsMenu showsLabel={!folds("viewsLabel")} />

				{!folds("viewMenus") && <OverlaysMenu />}

				{!folds("viewMenus") && (folds("shading") ? <ShadingMenu /> : <ShadingSwitcher />)}

				{!folds("viewMenus") && (
					<IconButtonGroup cluster="View">
						{!folds("view") && (
							<IconButton
								size="md"
								tooltipSide="bottom"
								icon={playing ? "pause" : "play"}
								label={playing ? "Pause motion (Space)" : "Play motion (Space)"}
								onClick={togglePlaying}
							/>
						)}

						<CameraMenu />

						{!folds("view") && (
							<IconButton
								size="md"
								tooltipSide="bottom"
								icon="focus"
								label="Re-centre camera"
								onClick={resetView}
							/>
						)}
					</IconButtonGroup>
				)}

				{more.length > 0 && (
					<Menu.Root>
						<Menu.Trigger label="More" chevron={false}>
							<Icon name="more" size={18} />
						</Menu.Trigger>

						<Menu.Popup>{more}</Menu.Popup>
					</Menu.Root>
				)}
			</div>
		</div>
	);
};
