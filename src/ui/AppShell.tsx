import { type CSSProperties, useEffect, useState } from "react";

import { loadStoredScene, startAutosave } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { useShortcuts } from "#/editor/useShortcuts";
import { useThemeAttribute } from "#/editor/useTheme";
import { Viewport } from "#/render/Viewport";

import { DetailSheet } from "./DetailSheet";
import { DrawingBar } from "./DrawingBar";
import { Inspector } from "./Inspector";
import { JoinOfferBar } from "./JoinOfferBar";
import { LabelLayer } from "./LabelLayer";
import { PartsPalette } from "./PartsPalette";
import { RecoveryBar, type TRecovery } from "./RecoveryBar";
import { ResizeHandle, useInspectorWidth } from "./ResizeHandle";
import { StatusBanner } from "./StatusBanner";
import { Toaster } from "./Toaster";
import { Toolbar } from "./Toolbar";
import { TooltipProvider } from "./Tooltip";

import styles from "./AppShell.module.css";

const SceneTitle = () => {
	const meta = useEditor((s) => s.scene.meta);
	return (
		<div className={styles.sceneTitle}>
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
	const [recovery, setRecovery] = useState<TRecovery | null>(null);

	useEffect(() => {
		const stored = loadStoredScene();
		if (stored.status === "ok" || stored.status === "repaired") {
			useEditor.getState().loadScene(stored.scene);
		}
		if (stored.status === "repaired" || stored.status === "unreadable") {
			// The original save is already backed up, so autosaving over it is safe.
			setRecovery(stored);
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
					style={{ "--inspector-width": `${inspectorWidth}px` } as CSSProperties}
				>
					<StatusBanner />

					<Toolbar />

					<div className={styles.body}>
						{mode === "edit" && (
							<aside className={styles.left}>
								<PartsPalette />
							</aside>
						)}

						<main className={styles.stage}>
							<SceneTitle />

							{ready && <Viewport />}

							{ready && <LabelLayer />}

							<DrawingBar />

							<JoinOfferBar />

							{recovery && <RecoveryBar recovery={recovery} onDismiss={() => setRecovery(null)} />}

							<DetailSheet />
						</main>

						{mode === "edit" && (
							<div className={styles.rightColumn}>
								<ResizeHandle width={inspectorWidth} onResize={setInspectorWidth} />

								<aside className={styles.right}>
									<Inspector />
								</aside>
							</div>
						)}
					</div>
				</div>
			</Toaster>
		</TooltipProvider>
	);
};
