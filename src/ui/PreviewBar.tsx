import { useState } from "react";

import { closePreview, keepPreview } from "#/editor/fileActions";
import { allowLink } from "#/editor/linkTrust";
import { hostsOf, useWaitingSources } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { previewOf } from "#/editor/whatIsOpen";

import { Button, IconButton } from "./Button";

import bars from "./DrawingBar.module.css";
import styles from "./PreviewBar.module.css";

const whenItGoes = (expiresAt: string) =>
	new Date(expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * While a world from a link is open as a preview (ADR-0121): says it isn't
 * kept in this browser, with Keep a copy (a world of one's own, saved from
 * then on; Edit asks the same) and Close world (back to one's own world, or
 * home). External sources it reads that this browser hasn't allowed are said
 * here too, for as long as they wait, with Allow: a preview has no Data tab.
 * It can be hidden, until the page reloads or another preview opens (Edit
 * still asks to keep a copy).
 */
export const PreviewBar = () => {
	const preview = useEditor((s) => previewOf(s.whatIsOpen));
	const waiting = useWaitingSources();
	// Which preview it was hidden for: never kept, so a reload (or another preview) brings it back.
	const [hiddenFor, setHiddenFor] = useState<string | null>(null);
	if (!preview || hiddenFor === preview.id) {
		return null;
	}
	const what = preview.from === "shared" ? "A shared world" : "A template";
	const one = waiting.length === 1;
	return (
		<div className={`${bars.bar} ${styles.bar}`} data-label-obstacle="" role="status">
			<div className={`${bars.text} ${styles.text}`}>
				<strong>{`${what}, not kept in this browser`}</strong>

				<span className={bars.keys}>
					{preview.expiresAt
						? `Keep a copy to edit it or come back to it. The link works until ${whenItGoes(preview.expiresAt)}.`
						: "Keep a copy to edit it or come back to it."}
				</span>

				{waiting.length > 0 && (
					<span className={`${bars.keys} ${styles.waiting}`}>
						{`It reads ${one ? "an external source" : `${waiting.length} external sources`} not read yet: ${hostsOf(waiting)}.`}
					</span>
				)}
			</div>

			<div className={`${bars.actions} ${styles.actions}`}>
				{waiting.length > 0 && (
					<Button
						icon="check"
						onClick={() => {
							for (const source of waiting) {
								allowLink(source.url ?? "");
							}
						}}
					>
						{one ? "Allow it" : "Allow them"}
					</Button>
				)}

				<Button onClick={closePreview}>Close world</Button>

				<Button variant="primary" icon="download" onClick={keepPreview}>
					Keep a copy
				</Button>

				<IconButton
					icon="close"
					label="Hide this bar (it's back when the page reloads)"
					onClick={() => setHiddenFor(preview.id)}
				/>
			</div>
		</div>
	);
};
