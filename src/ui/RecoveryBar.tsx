import { downloadSceneBackup, type ISceneBackup } from "#/editor/persistence";

import styles from "./DrawingBar.module.css";

interface IRecoveryBarProps {
	/** The unreadable save, so it can be downloaded even if backing it up failed. */
	raw: string;
	backup: ISceneBackup | null;
	reason: string;
	onDismiss: () => void;
}

/** Shown when the saved world can't be read by this version. Nothing is lost: it was kept as a backup. */
export const RecoveryBar = ({ raw, backup, reason, onDismiss }: IRecoveryBarProps) => (
	<div className={styles.bar} role="alert">
		<div className={styles.text}>
			<strong>Your saved world couldn’t be opened by this version</strong>

			<span>
				{backup
					? "It has been kept as a backup. Download it to keep it safe; you can also find it later under Scene → Backups."
					: "It couldn’t be backed up automatically (browser storage may be full). Download it now, before you edit, or it will be replaced."}
			</span>

			<span className={styles.keys} title={reason}>
				Reason: {reason}
			</span>
		</div>

		<div className={styles.actions}>
			<button type="button" className={styles.secondary} onClick={onDismiss}>
				Dismiss
			</button>

			<button
				type="button"
				className={styles.primary}
				onClick={() => downloadSceneBackup(backup ?? { key: "", savedAt: Date.now(), raw })}
			>
				Download backup
			</button>
		</div>
	</div>
);
