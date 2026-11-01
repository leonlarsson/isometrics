import { useState } from "react";

import { closePreview, keepPreview } from "#/editor/fileActions";
import { allowLink } from "#/editor/linkTrust";
import { sitesOf, useWaitingSources } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { previewOf } from "#/editor/whatIsOpen";
import { localDateTime } from "#/lib/when";

import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { FloatingBar, FloatingBarNote } from "./FloatingBar";

import dialogStyles from "./WaitingSourcesDialog.module.css";

/**
 * While a world from a link is open as a preview (ADR-0121): says it isn't
 * kept in this browser, with Keep a copy (a world of one's own, saved from
 * then on; Edit asks the same) and Close world (back to one's own world, or
 * home). External sources it reads that this browser hasn't allowed are said
 * in a row of their own, for as long as they wait: a preview has no Data
 * tab. One is named in full, with Allow it; several open a list of every
 * address in full first (Review and allow…), so nothing is allowed unseen. It shows once the world is on screen, and can be hidden, until
 * the page reloads or another preview opens (Edit still asks to keep a copy).
 */
export const PreviewBar = () => {
	const preview = useEditor((s) => previewOf(s.whatIsOpen));
	const waiting = useWaitingSources();
	// Once the world is on screen: never over its loading screen.
	const isOnScreen = useEditor((s) => s.openingWorld === null);
	// Which preview it was hidden for: never kept, so a reload (or another preview) brings it back.
	const [hiddenFor, setHiddenFor] = useState<string | null>(null);
	const [isReviewing, setReviewing] = useState(false);
	if (!preview || !isOnScreen || hiddenFor === preview.id) {
		return null;
	}
	const one = waiting.length === 1;
	const addresses = [...new Set(waiting.map((source) => source.url ?? ""))];
	const allow = () => {
		for (const url of addresses) {
			allowLink(url);
		}
	};
	return (
		<>
			<FloatingBar
				icon="eye"
				title={preview.from === "shared" ? "Preview of a shared world" : "Preview of a template"}
				dismiss={{
					label: "Hide this bar (it's back when the page reloads)",
					onDismiss: () => setHiddenFor(preview.id),
				}}
				actions={
					<>
						<Button onClick={closePreview}>Close world</Button>

						<Button variant="primary" icon="download" onClick={keepPreview}>
							Keep a copy
						</Button>
					</>
				}
			>
				<span>
					Not kept in this browser: keep a copy to edit it or come back later.
					{preview.expiresAt && ` The link works until ${localDateTime(preview.expiresAt)}.`}
				</span>

				{waiting.length > 0 && (
					<FloatingBarNote
						action={
							<Button size="sm" icon="check" onClick={one ? allow : () => setReviewing(true)}>
								{one ? "Allow it" : "Review and allow…"}
							</Button>
						}
					>
						{one
							? `An external source waits for your yes: ${addresses[0]}`
							: `${waiting.length} external sources wait for your yes, from ${sitesOf(waiting)}.`}
					</FloatingBarNote>
				)}
			</FloatingBar>

			{/* Every address in full before any is allowed: none hidden behind "and 3 more". */}
			<ConfirmDialog
				open={isReviewing && addresses.length > 1}
				onOpenChange={setReviewing}
				title={`Allow these ${addresses.length} external sources?`}
				description={
					<div className={dialogStyles.body}>
						<p>
							This browser reads each of them from then on, for any world that uses them. Reading
							one lets whoever runs it see your visit (your IP address, and when).
						</p>

						<ul className={dialogStyles.addresses}>
							{addresses.map((url) => (
								<li key={url}>{url}</li>
							))}
						</ul>

						<p>
							Not now leaves them waiting. You can forget any you allow later, from the Data tab
							(External sources this browser reads…).
						</p>
					</div>
				}
				confirmLabel="Allow all"
				cancelLabel="Not now"
				onConfirm={allow}
			/>
		</>
	);
};
