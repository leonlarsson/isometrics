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
import { ResizeHandle, useInspectorWidth } from "./ResizeHandle";
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
	const mode = useEditor((s) => s.mode);
	const [ready, setReady] = useState(false);
	const [inspectorWidth, setInspectorWidth] = useInspectorWidth();

	useEffect(() => {
		const stored = loadStoredScene();
		if (stored) {
			useEditor.getState().loadScene(stored);
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
