import { type CSSProperties, useEffect, useRef, useState } from "react";

import { loadStoredScene, saveScene, startAutosave } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { useShortcuts } from "#/editor/useShortcuts";
import { useThemeAttribute } from "#/editor/useTheme";
import { Viewport } from "#/render/Viewport";

import { IconButton } from "./Button";
import { CameraFollowBar } from "./CameraFollowBar";
import { DetailSheet } from "./DetailSheet";
import { DrawingBar } from "./DrawingBar";
import { FollowOfferBar } from "./FollowOfferBar";
import { Inspector } from "./Inspector";
import { ItemContextMenu } from "./ItemContextMenu";
import { JoinOfferBar } from "./JoinOfferBar";
import { LabelLayer } from "./LabelLayer";
import { Outliner } from "./Outliner";
import { PartsPalette } from "./PartsPalette";
import { RecoveryBar, type TRecovery } from "./RecoveryBar";
import {
	INSPECTOR_WIDTH,
	OUTLINER_HEIGHT,
	PALETTE_WIDTH,
	ResizeHandle,
	useInspectorWidth,
	useOutlinerHeight,
	usePaletteWidth,
} from "./ResizeHandle";
import { StatusBanner } from "./StatusBanner";
import { Toaster } from "./Toaster";
import { Toolbar } from "./Toolbar";
import { TooltipProvider } from "./Tooltip";
import { TransformBar } from "./TransformBar";
import { useNarrowLayout } from "./useNarrowLayout";
import { ViewpointBar } from "./ViewpointBar";

import styles from "./AppShell.module.css";

const SceneTitle = () => {
	const meta = useEditor((s) => s.scene.meta);
	return (
		// Label cards step aside for it (data-label-obstacle), like for the bars.
		<div className={styles.sceneTitle} data-label-obstacle="">
			<h1>{meta.title}</h1>

			{meta.subtitle && <p>{meta.subtitle}</p>}
		</div>
	);
};

export const AppShell = () => {
	// Dev only: open /?crash to see the error screen (ErrorScreen). Stripped from production builds.
	if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("crash")) {
		throw new Error("Test crash (opened with ?crash in development)");
	}

	const mode = useEditor((s) => s.mode);
	const [ready, setReady] = useState(false);
	const [inspectorWidth, setInspectorWidth] = useInspectorWidth();
	const [outlinerHeight, setOutlinerHeight] = useOutlinerHeight();
	const [paletteWidth, setPaletteWidth] = usePaletteWidth();
	const [recovery, setRecovery] = useState<TRecovery | null>(null);
	const narrow = useNarrowLayout();
	// Narrow layout: the inspector is a bottom sheet over the scene. It opens when something is
	// selected or a tab is picked, and folds down to its tab bar when the selection is cleared.
	const [sheetOpen, setSheetOpen] = useState(false);
	const selection = useEditor((s) => s.selectedId ?? s.selectedRoadId ?? s.selectedAreaId);
	useEffect(() => {
		setSheetOpen(selection !== null);
	}, [selection]);
	// Tell the camera how much of the scene the sheet covers, so it can keep the selection in view.
	const sheet = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const element = sheet.current;
		const { setViewInset } = useEditor.getState();
		if (!narrow || !element) {
			setViewInset(0);
			return;
		}
		const observer = new ResizeObserver(() => setViewInset(element.offsetHeight));
		observer.observe(element);
		return () => {
			observer.disconnect();
			setViewInset(0);
		};
	}, [narrow, mode]);

	useEffect(() => {
		const stored = loadStoredScene();
		if (stored.status === "ok" || stored.status === "repaired") {
			useEditor.getState().loadScene(stored.scene);
		}
		if (stored.status === "repaired" || stored.status === "unreadable") {
			// The original save is already backed up, so autosaving over it is safe.
			setRecovery(stored);
		}
		if (stored.status === "repaired" && stored.backup) {
			// Save the repaired world now, so the next visit opens it as it is instead of repairing
			// (and reporting) the same original again. Only once the original is safely backed up.
			saveScene(stored.scene);
		}
		setReady(true);
		return startAutosave(useEditor);
	}, []);

	useThemeAttribute();
	useShortcuts();

	return (
		<TooltipProvider>
			<Toaster>
				<div
					className={styles.shell}
					data-mode={mode}
					style={
						{
							"--inspector-width": `${inspectorWidth}px`,
							"--palette-width": `${paletteWidth}px`,
						} as CSSProperties
					}
				>
					<StatusBanner />

					<Toolbar />

					<div className={styles.body}>
						{mode === "edit" && (
							<aside className={styles.left}>
								<PartsPalette />

								<ResizeHandle
									edge="right"
									size={paletteWidth}
									onResize={setPaletteWidth}
									limits={PALETTE_WIDTH}
									label="Resize Add to scene"
								/>
							</aside>
						)}

						<main className={styles.stage}>
							<SceneTitle />

							{ready && <Viewport />}

							{ready && <LabelLayer />}

							<DrawingBar />

							<TransformBar />

							<JoinOfferBar />

							<FollowOfferBar />

							<ViewpointBar />

							<CameraFollowBar />

							{recovery && <RecoveryBar recovery={recovery} onDismiss={() => setRecovery(null)} />}

							<DetailSheet />

							<ItemContextMenu />
						</main>

						{mode === "edit" && (
							<div
								ref={sheet}
								className={styles.rightColumn}
								data-sheet={narrow ? (sheetOpen ? "open" : "closed") : undefined}
								// The narrow layout's sheet floats over the scene: label cards keep clear of it.
								data-label-obstacle={narrow ? "" : undefined}
							>
								<ResizeHandle
									edge="left"
									size={inspectorWidth}
									onResize={setInspectorWidth}
									limits={INSPECTOR_WIDTH}
									label="Resize the inspector"
								/>

								{/* Like Blender: the outliner on top, the selection's settings below. */}
								{!narrow && (
									<>
										<section
											className={styles.outlinerPane}
											style={{ height: outlinerHeight }}
											aria-label="Outliner"
										>
											<Outliner />
										</section>

										<ResizeHandle
											edge="bottom"
											size={outlinerHeight}
											onResize={setOutlinerHeight}
											limits={OUTLINER_HEIGHT}
											label="Resize the outliner"
										/>
									</>
								)}

								<aside className={styles.right}>
									<Inspector
										narrow={narrow}
										open={!narrow || sheetOpen}
										onTabSelect={() => setSheetOpen(true)}
										tabBarEnd={
											narrow && (
												<IconButton
													icon={sheetOpen ? "chevronDown" : "chevronUp"}
													label={sheetOpen ? "Hide panel" : "Show panel"}
													onClick={() => setSheetOpen(!sheetOpen)}
												/>
											)
										}
									/>
								</aside>
							</div>
						)}
					</div>
				</div>
			</Toaster>
		</TooltipProvider>
	);
};
