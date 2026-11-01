import { useState } from "react";

import { closePreview, keepPreview } from "#/editor/fileActions";
import { allowLink } from "#/editor/linkTrust";
import { hostsOf, useWaitingSources } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { previewOf } from "#/editor/whatIsOpen";
import { localDateTime } from "#/lib/when";

import { Button } from "./Button";
import { FloatingBar } from "./FloatingBar";

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
		<FloatingBar
			title={`${what}, not kept in this browser`}
			dismiss={{
				label: "Hide this bar (it's back when the page reloads)",
				onDismiss: () => setHiddenFor(preview.id),
			}}
			actions={
				<>
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
				</>
			}
		>
			<span>
				{preview.expiresAt
					? `Keep a copy to edit it or come back to it. The link works until ${localDateTime(preview.expiresAt)}.`
					: "Keep a copy to edit it or come back to it."}
			</span>

			{waiting.length > 0 && (
				<span>
					{`It reads ${one ? "an external source" : `${waiting.length} external sources`} not read yet: ${hostsOf(waiting)}.`}
				</span>
			)}
		</FloatingBar>
	);
};
