import { downloadSceneBackup, type TStoredSceneResult } from "#/editor/persistence";

import { Button } from "./Button";

import styles from "./DrawingBar.module.css";

export type TRecovery = Extract<TStoredSceneResult, { status: "repaired" | "unreadable" }>;

interface IRecoveryBarProps {
	recovery: TRecovery;
	onDismiss: () => void;
}

/**
 * Shown when the saved world had to be repaired (ADR-0026) or couldn't be
 * opened at all (ADR-0020). Either way nothing is lost: the original was kept
 * as a backup, and it can be downloaded from here even if that backup failed.
 */
export const RecoveryBar = ({ recovery, onDismiss }: IRecoveryBarProps) => {
	const { raw, backup } = recovery;
	const repaired = recovery.status === "repaired";
	const keptNote = backup
		? "The original is kept as a backup under File → Backups."
		: "The original couldn’t be backed up automatically (browser storage may be full). Download it now, before you edit, or it will be replaced.";

	return (
		<div className={styles.bar} role="alert">
			<div className={styles.text}>
				<strong>
					{repaired
						? "Your saved world was repaired to open in this version"
						: "Your saved world couldn’t be opened by this version"}
				</strong>

				<span>{repaired ? `${recovery.summary} ${keptNote}` : keptNote}</span>

				{!repaired && <span className={styles.keys}>Reason: {recovery.reason}</span>}
			</div>

			<div className={styles.actions}>
				<Button onClick={onDismiss}>Dismiss</Button>

				<Button
					variant="primary"
					onClick={() => downloadSceneBackup(backup ?? { key: "", savedAt: Date.now(), raw })}
				>
					{repaired ? "Download original" : "Download backup"}
				</Button>
			</div>
		</div>
	);
};
