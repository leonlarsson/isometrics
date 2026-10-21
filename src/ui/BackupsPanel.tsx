import { useState } from "react";

import { deleteSceneBackup, downloadSceneBackup, listSceneBackups } from "#/editor/persistence";

import { Section } from "./fields";
import { Icon } from "./Icon";

import styles from "./Fields.module.css";

const titleOf = (raw: string) => {
	try {
		const parsed = JSON.parse(raw) as { meta?: { title?: unknown } };
		return typeof parsed.meta?.title === "string" ? parsed.meta.title : "Untitled";
	} catch {
		return "Unreadable file";
	}
};

const formatDate = (ms: number) =>
	ms
		? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
		: "Unknown date";

/**
 * Saved worlds that a newer version couldn't open, kept so nothing is lost
 * (ADR-0020). Only shown when there are any.
 */
export const BackupsPanel = () => {
	const [backups, setBackups] = useState(listSceneBackups);
	const [confirming, setConfirming] = useState<string | null>(null);

	if (backups.length === 0) {
		return null;
	}

	return (
		<Section title="Backups">
			<p className={styles.hint}>
				Saved worlds this version couldn’t open. Download one to keep it, or delete it when you no
				longer need it.
			</p>

			<ul className={styles.roadList}>
				{backups.map((backup) => (
					<li key={backup.key} className={styles.backupItem}>
						<span className={styles.backupText}>
							<strong>{titleOf(backup.raw)}</strong>

							<span className={styles.roadMeta}>{formatDate(backup.savedAt)}</span>
						</span>

						<button
							type="button"
							className={styles.iconButton}
							title="Download backup"
							onClick={() => downloadSceneBackup(backup)}
						>
							<Icon name="download" size={15} />
						</button>

						{confirming === backup.key ? (
							<button
								type="button"
								className={styles.dangerButton}
								onClick={() => {
									deleteSceneBackup(backup.key);
									setConfirming(null);
									setBackups(listSceneBackups());
								}}
							>
								Delete
							</button>
						) : (
							<button
								type="button"
								className={styles.iconButton}
								title="Delete backup"
								onClick={() => setConfirming(backup.key)}
							>
								<Icon name="trash" size={15} />
							</button>
						)}
					</li>
				))}
			</ul>
		</Section>
	);
};
