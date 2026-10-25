import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { rememberedView } from "#/editor/cameraMemory";
import { useSceneHours } from "#/editor/dayClock";
import { loadStoredScene, openWorldId, saveScene, startAutosave } from "#/editor/persistence";
import { setSidePaneOpen, useSidePanes } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { useShortcuts } from "#/editor/useShortcuts";
import { useThemeAttribute } from "#/editor/useTheme";
import { Viewport } from "#/render/Viewport";
import { formatHour, skyLightAt } from "#/scene/sun";

import { Button, IconButton } from "./Button";
import { CameraFollowBar } from "./CameraFollowBar";
import { DetailSheet } from "./DetailSheet";
import { DrawingBar } from "./DrawingBar";
import { FollowOfferBar } from "./FollowOfferBar";
import { FreshStartOffer } from "./FreshStartOffer";
import { GroundContextMenu } from "./GroundContextMenu";
import { Icon } from "./Icon";
import { Inspector, RailShortcuts } from "./Inspector";
import { ItemContextMenu } from "./ItemContextMenu";
import { JoinOfferBar } from "./JoinOfferBar";
import { LabelLayer } from "./LabelLayer";
import { Outliner } from "./Outliner";
import { PaneStrip } from "./PaneStrip";
import { PartsPalette } from "./PartsPalette";
import { RecoveryBar, type TRecovery } from "./RecoveryBar";
import {
	INSPECTOR_WIDTH,
	OUTLINER_HEIGHT,
	PALETTE_WIDTH,
	PANE_STRIP,
	ResizeHandle,
	useInspectorWidth,
	useOutlinerHeight,
	usePaletteWidth,
} from "./ResizeHandle";
import { StatusBanner } from "./StatusBanner";
import { Toaster } from "./Toaster";
import { Toolbar } from "./Toolbar";
import { Tooltip, TooltipProvider } from "./Tooltip";
import { TransformBar } from "./TransformBar";
import { useNarrowLayout } from "./useNarrowLayout";
import { ViewpointBar } from "./ViewpointBar";

import styles from "./AppShell.module.css";

/**
 * The sky behind the world for its time of day (ADR-0052): the theme's own
 * background at noon, blended towards the day's sky as the light colours
 * (dawn, golden hour) and almost fully at dusk and night. Nothing with the
 * classic daylight.
 */
const useSky = (): { style: CSSProperties; dark: boolean } => {
	const lighting = useEditor((s) => s.scene.lighting);
	const sky = skyLightAt(lighting, useSceneHours());
	if (!sky.sky) {
		return { style: {}, dark: false };
	}
	// As coloured as the light: the theme's own background at noon, the day's sky at dusk and night.
	const weight = Math.min(0.9, 0.9 * Math.max(sky.night, sky.tintAmount * 1.2));
	return {
		style: { "--sky": sky.sky, "--sky-weight": `${Math.round(weight * 100)}%` } as CSSProperties,
		// The world's title switches to light text on a night sky (AppShell.module.css).
		dark: sky.night >= 0.5,
	};
};

/**
 * The stage, with the sky behind the world. Its own component, so a running
 * day re-renders only this element, not the whole app: the children it's given
 * stay the same, so React skips them.
 */
const Stage = ({ children }: { children: ReactNode }) => {
	const sky = useSky();
	return (
		<main className={styles.stage} style={sky.style} data-sky-dark={sky.dark || undefined}>
			{children}
		</main>
	);
};

/**
 * The world's title and subtitle, and under them its time when it has one
 * (classic daylight has no clock). In edit mode the time also says where it
 * comes from, in the words of Sun & sky's Time follows, and opens that tab.
 */
const SceneTitle = ({ onOpenSky }: { onOpenSky: () => void }) => {
	const meta = useEditor((s) => s.scene.meta);
	const hour = useSceneHours();
	const editing = useEditor((s) => s.mode === "edit");
	const lighting = useEditor((s) => s.scene.lighting);
	const timeEntry = useEditor((s) =>
		s.scene.data.find((entry) => entry.key === s.scene.lighting.timeKey),
	);
	const source =
		lighting.timeSource === "cycle"
			? `Day cycle, ${lighting.dayLength} s`
			: lighting.timeSource === "clock"
				? "Viewer's clock"
				: lighting.timeSource === "data"
					? `From data: ${timeEntry ? timeEntry.label || timeEntry.key : "no value"}`
					: "Fixed time";
	return (
		// Label cards step aside for it (data-label-obstacle), like for the bars.
		<div className={styles.sceneTitle} data-label-obstacle="">
			<h1>{meta.title}</h1>

			{meta.subtitle && <p>{meta.subtitle}</p>}

			{editing ? (
				<p className={styles.sceneTime}>
					<span className={styles.sceneTimeOpen}>
						<Tooltip label="Open Sun & sky">
							<Button variant="text" size="sm" icon="clock" onClick={onOpenSky}>
								{hour === null ? (
									"Classic daylight"
								) : (
									<>
										{formatHour(hour)} <span className={styles.sceneTimeSource}>({source})</span>
									</>
								)}
							</Button>
						</Tooltip>
					</span>
				</p>
			) : (
				hour !== null && (
					<p className={styles.sceneTime}>
						<Icon name="clock" size={13} />

						{formatHour(hour)}
					</p>
				)
			)}
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
	const setTab = useEditor((s) => s.setTab);
	// Wide layout: each side pane can fold to a thin strip (ADR-0055). Phones have the sheet instead.
	const panes = useSidePanes();
	const leftOpen = narrow || panes.left;
	const rightOpen = narrow || panes.right;
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
			useEditor.getState().showOpeningView(rememberedView(openWorldId()));
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
	}, []);

	// Saving follows the store: in development a code change makes a new one (see editor/store.ts),
	// and autosave has to move over to it.
	useEffect(() => {
		return startAutosave(useEditor);
	}, [useEditor]);

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
							"--pane-strip": `${PANE_STRIP}px`,
							"--inspector-width": rightOpen ? `${inspectorWidth}px` : "var(--pane-strip)",
							"--palette-width": leftOpen ? `${paletteWidth}px` : "var(--pane-strip)",
						} as CSSProperties
					}
				>
					<StatusBanner />

					<Toolbar />

					<div className={styles.body}>
						{mode === "edit" && !leftOpen && (
							<PaneStrip
								side="left"
								label="Show Add to scene"
								onOpen={() => setSidePaneOpen("left", true)}
							/>
						)}

						{mode === "edit" && leftOpen && (
							<aside className={styles.left}>
								<PartsPalette />
							</aside>
						)}

						<Stage>
							<SceneTitle
								onOpenSky={() => {
									setTab("sky");
									setSidePaneOpen("right", true);
									setSheetOpen(true);
								}}
							/>

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

							<GroundContextMenu />

							{/* Once the world is loaded: after a big update, offers to start fresh (ADR-0059). */}
							{ready && <FreshStartOffer />}
						</Stage>

						{mode === "edit" && !rightOpen && (
							<PaneStrip
								side="right"
								label="Show the outliner and properties"
								onOpen={() => setSidePaneOpen("right", true)}
							>
								<RailShortcuts onOpen={() => setSidePaneOpen("right", true)} />
							</PaneStrip>
						)}

						{mode === "edit" && rightOpen && (
							<div
								ref={sheet}
								className={styles.rightColumn}
								data-sheet={narrow ? (sheetOpen ? "open" : "closed") : undefined}
								// The narrow layout's sheet floats over the scene: label cards keep clear of it.
								data-label-obstacle={narrow ? "" : undefined}
							>
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

						{/*
						 * The side panes' edges, outside the panes so a drag can fold a pane and open it
						 * again without letting go (ADR-0055). Phones have the sheet instead.
						 */}
						{mode === "edit" && !narrow && (
							<div className={styles.paneEdge} data-side="left">
								<ResizeHandle
									edge="right"
									size={paletteWidth}
									onResize={setPaletteWidth}
									limits={PALETTE_WIDTH}
									label="Resize Add to scene"
									collapse={{
										collapsed: !panes.left,
										onChange: (collapsed) => setSidePaneOpen("left", !collapsed),
										stripSize: PANE_STRIP,
									}}
								/>
							</div>
						)}

						{mode === "edit" && !narrow && (
							<div className={styles.paneEdge} data-side="right">
								<ResizeHandle
									edge="left"
									size={inspectorWidth}
									onResize={setInspectorWidth}
									limits={INSPECTOR_WIDTH}
									label="Resize the inspector"
									collapse={{
										collapsed: !panes.right,
										onChange: (collapsed) => setSidePaneOpen("right", !collapsed),
										stripSize: PANE_STRIP,
									}}
								/>
							</div>
						)}
					</div>
				</div>
			</Toaster>
		</TooltipProvider>
	);
};
