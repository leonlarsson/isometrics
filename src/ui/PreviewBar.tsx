import { closePreview, keepPreview } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";
import { previewOf } from "#/editor/whatIsOpen";

import { Button } from "./Button";

import styles from "./DrawingBar.module.css";

const whenItGoes = (expiresAt: string) =>
	new Date(expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * While a world from a link is open as a preview (ADR-0121): says it isn't
 * kept in this browser, with Keep a copy (a world of one's own, saved from
 * then on; Edit asks the same) and Close (back to one's own world, or home).
 */
export const PreviewBar = () => {
	const preview = useEditor((s) => previewOf(s.whatIsOpen));
	if (!preview) {
		return null;
	}
	const what = preview.from === "shared" ? "A shared world" : "A template";
	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<div className={styles.text}>
				<strong>{`${what}, not kept in this browser`}</strong>

				<span className={styles.keys}>
					{preview.expiresAt
						? `Keep a copy to edit it or come back to it. The link works until ${whenItGoes(preview.expiresAt)}.`
						: "Keep a copy to edit it or come back to it."}
				</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={closePreview}>Close</Button>

				<Button variant="primary" icon="download" onClick={keepPreview}>
					Keep a copy
				</Button>
			</div>
		</div>
	);
};
