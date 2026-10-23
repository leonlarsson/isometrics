import { STORAGE_LIMIT_CHARS, storageUsage } from "#/editor/persistence";

import styles from "./StorageMeter.module.css";

/** From this share of the limit on, the meter warns that storage is almost full. */
const ALMOST_FULL = 0.8;

const KB = 1024;
const MB = 1024 * 1024;

/** "320 KB" / "1.2 MB", counting a character as a byte, in the same units as the 5 MB limit. */
const formatSize = (chars: number) =>
	chars >= MB ? `${(chars / MB).toFixed(1)} MB` : `${Math.ceil(chars / KB)} KB`;

/**
 * How much of the browser's storage for this site the worlds and backups use,
 * as a line of text and a thin bar, with a warning when it's almost full
 * (ADR-0044). Read each time it renders; show it in places that open fresh,
 * such as dialogs.
 */
export const StorageMeter = () => {
	const usage = storageUsage();
	const share = (part: number) => Math.min(100, (part / STORAGE_LIMIT_CHARS) * 100);
	const used = usage.total / STORAGE_LIMIT_CHARS;
	const almostFull = used >= ALMOST_FULL;

	return (
		<div className={styles.meter}>
			{/* Decorative: the line below says the same in words. */}
			<div className={styles.bar} aria-hidden="true" data-almost-full={almostFull || undefined}>
				{usage.worlds > 0 && (
					<span className={styles.worlds} style={{ width: `${share(usage.worlds)}%` }} />
				)}

				{usage.backups > 0 && (
					<span className={styles.backups} style={{ width: `${share(usage.backups)}%` }} />
				)}
			</div>

			<p className={styles.text}>
				{`${formatSize(usage.total)} of about 5 MB used (${Math.round(used * 100)}%): worlds ${formatSize(usage.worlds)}, backups ${formatSize(usage.backups)}.`}

				{almostFull &&
					" Almost full: delete worlds or backups you don’t need, or save them to files, before saving fails."}
			</p>
		</div>
	);
};
