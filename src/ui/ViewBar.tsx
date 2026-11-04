import { type ReactNode, useRef } from "react";

import { useEditor } from "#/editor/store";

import { IconButton, IconButtonGroup } from "./Button";
import { CameraMenu } from "./CameraMenu";
import { Icon, type TIconName } from "./Icon";
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

/** The tool the view's drags use: one at a time, Select unless another is picked. */
type TTool = "select" | "box" | "paint";

const pickTool = (tool: TTool) => {
	const store = useEditor.getState();
	if (tool === "box") {
		store.setBoxSelect("add");
	} else if (tool === "paint") {
		store.setPainting(true);
	} else {
		store.setBoxSelect(null);
		store.setPainting(false);
	}
};

const TOOLS: { tool: TTool; icon: TIconName; label: string; inMenu: string }[] = [
	{ tool: "select", icon: "pointer", label: "Select", inMenu: "Select" },
	{ tool: "box", icon: "boxSelect", label: "Select with a box (B)", inMenu: "Select with a box" },
	{
		tool: "paint",
		icon: "brush",
		label: "Paint objects: trees, bushes, rocks… (N)",
		inMenu: "Paint objects",
	},
];

interface IViewBarProps {
	/**
	 * On phones, inside the app row: one row for both, as the phone toolbar was (ADR-0046),
	 * already folded as far as the phone toolbar is, and the theme in More (the tray has no room).
	 */
	isInline?: boolean;
}

/**
 * The view bar (ADR-0142): the 3D view's own bar, across the top of the view between the side
 * panels. On the left what's about editing: the Edit/View switch, undo and redo, the tools (one at
 * a time, like a paint program's) and Snap to grid; on the right what's about looking, in groups
 * by meaning: the view (Views, Overlays, shading), motion (play) and the camera. It folds by its
 * own width, in steps (useViewBarFolds), into More, which keeps the bar's order; what's about the
 * app and this browser is in the app row above.
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
	const tool = useEditor((s): TTool => (s.painting ? "paint" : s.boxSelect ? "box" : "select"));
	const theme = useThemeCycle();
	const editing = mode === "edit";

	const bar = useRef<HTMLDivElement>(null);
	const folds = useViewBarFolds(bar, mode, isInline ? "viewMenus" : null);

	// What the bar has folded away at this width (only that), as the More menu, in the bar's order.
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
		tools: TOOLS.filter(
			// Painting is a desktop tool; the phone toolbar never had it (ADR-0046).
			(item) => !(isInline && item.tool === "paint"),
		).map(
			(item) =>
				folds("tools") &&
				editing && (
					<Menu.CheckboxItem
						key={item.tool}
						icon={item.icon}
						label={item.inMenu}
						checked={tool === item.tool}
						onCheckedChange={() => pickTool(item.tool)}
					/>
				),
		),
		snap: [
			folds("tools") && editing && (
				<Menu.CheckboxItem
					key="snap"
					icon="grid"
					label="Snap to grid"
					checked={snapping}
					onCheckedChange={toggleSnapping}
				/>
			),
		],
		view: [
			folds("viewMenus") && <ShadingMenuGroup key="shading" />,
			folds("viewMenus") && <OverlaysSubmenu key="overlays" />,
		],
		motion: [
			folds("playAndRecentre") && (
				<Menu.CheckboxItem
					key="play"
					icon="play"
					label="Play motion"
					checked={playing}
					onCheckedChange={togglePlaying}
				/>
			),
		],
		camera: [
			folds("viewMenus") && (
				<Menu.CheckboxItem
					key="perspective"
					icon="perspective"
					label="Perspective"
					checked={perspective}
					onCheckedChange={toggleProjection}
				/>
			),
			folds("playAndRecentre") && (
				<Menu.Item key="recentre" icon="focus" label="Re-centre camera" onClick={resetView} />
			),
		],
		app: [
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

				{/* The tools, one at a time: the one in use shows pressed, Select when none other is. */}
				{editing && !folds("tools") && (
					<IconButtonGroup cluster="Tools">
						{TOOLS.map((item) => (
							<IconButton
								key={item.tool}
								size="md"
								tooltipSide="bottom"
								icon={item.icon}
								label={item.label}
								pressed={tool === item.tool}
								onClick={() => pickTool(item.tool)}
							/>
						))}
					</IconButtonGroup>
				)}

				{/* A switch on where moves land, with any tool: apart from the tools. */}
				{editing && !folds("tools") && (
					<IconButtonGroup cluster="Snapping">
						<IconButton
							size="md"
							tooltipSide="bottom"
							icon="grid"
							label={snapping ? "Snap to grid: on" : "Snap to grid: off"}
							pressed={snapping}
							onClick={toggleSnapping}
						/>
					</IconButtonGroup>
				)}
			</div>

			<div className={styles.end}>
				{/* The view: which one, what's drawn over it, and how it's shaded. */}
				<div className={styles.group}>
					<IconButtonGroup cluster="View">
						<ViewpointsMenu showsLabel={!folds("viewsLabel")} />

						{!folds("viewMenus") && <OverlaysMenu />}

						{!folds("viewMenus") && folds("shading") && <ShadingMenu />}
					</IconButtonGroup>

					{!folds("shading") && <ShadingSwitcher />}
				</div>

				{/* Motion: the world's vehicles, boats and day running or held. */}
				{!folds("playAndRecentre") && (
					<IconButtonGroup cluster="Motion">
						<IconButton
							size="md"
							tooltipSide="bottom"
							icon={playing ? "pause" : "play"}
							label={playing ? "Pause motion (Space)" : "Play motion (Space)"}
							onClick={togglePlaying}
						/>
					</IconButtonGroup>
				)}

				{/* The camera: its menu, and back to the start. */}
				{!folds("viewMenus") && (
					<IconButtonGroup cluster="Camera">
						<CameraMenu />

						{!folds("playAndRecentre") && (
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
