import type { ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";

import {
	downloadScene,
	downloadSceneBackup,
	readSavedRaw,
	readSaveStatus,
	startFreshAfterCrash,
} from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { storageAvailable } from "#/lib/storage";

import { Button } from "./Button";

import styles from "./ErrorScreen.module.css";

const messageOf = (error: unknown) =>
	error instanceof Error ? error.message.split("\n")[0].slice(0, 300) : String(error);

/** Download the world being edited; if that fails, the saved copy exactly as stored. */
const downloadWorld = () => {
	try {
		downloadScene(useEditor.getState().scene);
	} catch {
		const raw = readSavedRaw();
		if (raw) {
			downloadSceneBackup({ key: "", savedAt: Date.now(), raw });
		}
	}
};

/**
 * What can truly be said about the world being saved (ADR-0145): only that it
 * was, and when, if the save status says so; nothing at all is kept when the
 * browser blocks storage; otherwise it may not be (a preview, a change not
 * saved yet, a first visit).
 */
const savedWords = () => {
	if (!storageAvailable()) {
		return "This browser doesn’t let the site store anything, so nothing is saved: download your world to keep it, then try again.";
	}
	const status = readSaveStatus();
	if (status.state === "saved") {
		const when = status.at
			? ` at ${new Date(status.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
			: "";
		return `Your world was last saved in this browser${when}; changes since may not be. Download a copy to be safe, then try again or start fresh.`;
	}
	return "Your world may not be saved in this browser. Download a copy to be safe, then try again or start fresh.";
};

/**
 * Shown instead of a blank page when rendering crashes. Users can save their
 * world, retry, or start fresh; starting fresh backs the saved world up first
 * (ADR-0020), so nothing is lost.
 */
export const ErrorScreen = ({ error, reset }: ErrorComponentProps) => {
	const [problem, setProblem] = useState<string | null>(null);
	const text = `The editor hit an error and couldn’t continue. ${savedWords()}`;

	return (
		<main className={styles.page} role="alert">
			<span className={styles.logo} aria-hidden="true" />

			<h1 className={styles.title}>Something went wrong</h1>

			<p className={styles.text}>{text}</p>

			<div className={styles.actions}>
				<Button variant="primary" onClick={downloadWorld}>
					Download your world
				</Button>

				<Button onClick={() => reset()}>Try again</Button>

				<Button
					onClick={() => {
						if (startFreshAfterCrash()) {
							// Reload on the plain path, dropping any query string (e.g. the dev ?crash trigger).
							window.location.assign(window.location.pathname);
						} else {
							setProblem(
								"Couldn’t back up your world, so nothing was cleared. Download it first, then try again.",
							);
						}
					}}
				>
					Start fresh
				</Button>
			</div>

			<p className={styles.hint}>
				Starting fresh opens a new world; this one stays in File → Recent worlds, and a copy is kept
				under File → Backups.
			</p>

			{problem && <p className={styles.problem}>{problem}</p>}

			<details className={styles.details}>
				<summary>Error details</summary>

				<code>{messageOf(error)}</code>
			</details>
		</main>
	);
};
