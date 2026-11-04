import { toggleSidePanes, useSidePanes } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { whyNoWorldAction } from "#/editor/whatIsOpen";

import { AppMenu } from "./AppMenu";
import { Button, IconButton, IconButtonGroup } from "./Button";
import { FileMenu } from "./FileMenu";
import { SaveStatus } from "./SaveStatus";
import { useNarrowLayout } from "./useNarrowLayout";
import { useNarrowToolbar } from "./useNarrowToolbar";
import { useThemeCycle } from "./useThemeCycle";
import { ViewBar } from "./ViewBar";

import styles from "./AppRow.module.css";

/**
 * The app row (ADR-0142): a slim row across the whole window with what's about the app and this
 * browser. On the left the logo (the app menu), File, the AI button and the save status; on the
 * right a tray: the side panels' toggle (in Edit mode), Preferences and the theme. What's about
 * editing and looking is in the view bar, over the view. On phones there's room for one row only:
 * the view bar comes in here, after the save status, as the phone toolbar was (ADR-0046).
 */
export const AppRow = () => {
	// On the home screen, or while a link opens, there's no world to edit or view (ADR-0121).
	const hasWorld = useEditor((s) => s.whatIsOpen.kind === "world");
	const editing = useEditor((s) => s.mode === "edit");
	const isPhone = useNarrowToolbar();
	// The narrow layout has a bottom sheet instead of side panels (ADR-0030).
	const hasSidePanels = !useNarrowLayout();
	const panes = useSidePanes();
	const panesHidden = !panes.left && !panes.right;
	const theme = useThemeCycle();

	return (
		<header className={styles.appRow}>
			<div className={styles.brand}>
				<AppMenu />

				<FileMenu />

				{/* Build with AI one click away (ADR-0116): changing the world open, else a new one (the
				other a click away in it); at phone width, in File only. */}
				{!isPhone && (
					<Button
						variant="ghost"
						icon="sparkle"
						iconTone="accent"
						onClick={() =>
							useEditor
								.getState()
								.setBuildWithAi(
									whyNoWorldAction(useEditor.getState().whatIsOpen) === null ? "change" : "new",
								)
						}
					>
						AI
					</Button>
				)}

				<SaveStatus />
			</div>

			{isPhone && hasWorld && <ViewBar isInline />}

			{/* The tray: the app's and this browser's own switches. On phones, in File and More. */}
			{!isPhone && (
				<div className={styles.tray}>
					<IconButtonGroup>
						{hasWorld && editing && hasSidePanels && (
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
						)}

						<IconButton
							size="md"
							tooltipSide="bottom"
							icon="cog"
							label="Preferences… (Ctrl+,)"
							onClick={() => useEditor.getState().setPreferencesOpen(true)}
						/>

						{/* The theme is the open world's (saved with it), so only while one is open. */}
						{hasWorld && (
							<IconButton
								size="md"
								tooltipSide="bottom"
								icon={theme.icon}
								label={theme.label}
								onClick={theme.cycle}
							/>
						)}
					</IconButtonGroup>
				</div>
			)}
		</header>
	);
};
