import { type CSSProperties, useEffect, useState } from "react";

import { type ISceneBackup, loadStoredScene, startAutosave } from "#/editor/persistence";
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
import { RecoveryBar } from "./RecoveryBar";
import { ResizeHandle, useInspectorWidth } from "./ResizeHandle";
import { StatusBanner } from "./StatusBanner";
import { Toolbar } from "./Toolbar";

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
	const [unreadable, setUnreadable] = useState<{
		raw: string;
		backup: ISceneBackup | null;
		reason: string;
	} | null>(null);

	useEffect(() => {
		const stored = loadStoredScene();
		if (stored.status === "ok") {
			useEditor.getState().loadScene(stored.scene);
		} else if (stored.status === "unreadable") {
			// The old save is already backed up, so autosaving the template over it is safe.
			setUnreadable({ raw: stored.raw, backup: stored.backup, reason: stored.reason });
		}
		setReady(true);
		return startAutosave(useEditor);
	}, []);

	useThemeAttribute();
	useShortcuts();

	return (
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

					{unreadable && (
						<RecoveryBar
							raw={unreadable.raw}
							backup={unreadable.backup}
							reason={unreadable.reason}
							onDismiss={() => setUnreadable(null)}
						/>
					)}

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
	);
};
