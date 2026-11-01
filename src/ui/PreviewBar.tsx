import { useState } from "react";

import { closePreview, keepPreview } from "#/editor/fileActions";
import { allowLink } from "#/editor/linkTrust";
import { hostsOf, useWaitingSources } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { previewOf } from "#/editor/whatIsOpen";
import { localDateTime } from "#/lib/when";

import { Button } from "./Button";
import { FloatingBar, FloatingBarNote } from "./FloatingBar";

/**
 * While a world from a link is open as a preview (ADR-0121): says it isn't
 * kept in this browser, with Keep a copy (a world of one's own, saved from
 * then on; Edit asks the same) and Close world (back to one's own world, or
 * home). External sources it reads that this browser hasn't allowed are said
 * in a row of their own, for as long as they wait, with Allow: a preview has
 * no Data tab. It shows once the world is on screen, and can be hidden, until
 * the page reloads or another preview opens (Edit still asks to keep a copy).
 */
export const PreviewBar = () => {
	const preview = useEditor((s) => previewOf(s.whatIsOpen));
	const waiting = useWaitingSources();
	// Once the world is on screen: never over its loading screen.
	const isOnScreen = useEditor((s) => s.openingWorld === null);
	// Which preview it was hidden for: never kept, so a reload (or another preview) brings it back.
	const [hiddenFor, setHiddenFor] = useState<string | null>(null);
	if (!preview || !isOnScreen || hiddenFor === preview.id) {
		return null;
	}
	const one = waiting.length === 1;
	return (
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
						<Button
							size="sm"
							icon="check"
							onClick={() => {
								for (const source of waiting) {
									allowLink(source.url ?? "");
								}
							}}
						>
							{one ? "Allow it" : "Allow them"}
						</Button>
					}
				>
					{`${one ? "An external source waits" : `${waiting.length} external sources wait`} for your yes: ${hostsOf(waiting)}`}
				</FloatingBarNote>
			)}
		</FloatingBar>
	);
};
