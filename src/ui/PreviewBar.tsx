import { useState } from "react";

import { closePreview, keepPreview } from "#/editor/fileActions";
import { allowLink } from "#/editor/linkTrust";
import { setPaletteCategory } from "#/editor/paletteMemory";
import { keepInLibrary } from "#/editor/prefabLibrary";
import { sitesOf, useWaitingSources } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
import { previewOf } from "#/editor/whatIsOpen";
import { localDateTime } from "#/lib/when";
import { prefabName } from "#/parts/prefabParts";

import { AllowSourcesDialog } from "./AllowSourcesDialog";
import { Button } from "./Button";
import { FloatingBar, FloatingBarNote } from "./FloatingBar";

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
	// A shared prefab (ADR-0134): offered to My prefabs, from where it's placed in one's worlds.
	if (preview.from === "prefab") {
		const addToLibrary = () => {
			const [prefab] = useEditor.getState().scene.prefabs;
			if (!prefab) {
				return;
			}
			if (keepInLibrary(prefab)) {
				notify(
					`Added ${prefabName(prefab)} to My prefabs`,
					"Place it in any of your worlds from Add to scene's Prefabs chip.",
					"success",
				);
				setPaletteCategory("prefabs");
				closePreview();
			} else {
				notify(
					"It wasn't added to My prefabs",
					"The browser refused to keep it (its storage may be full).",
					"error",
				);
			}
		};
		return (
			<FloatingBar
				icon="prefab"
				title="Preview of a shared prefab"
				dismiss={{
					label: "Hide this bar (it's back when the page reloads)",
					onDismiss: () => setHiddenFor(preview.id),
				}}
				actions={
					<>
						<Button onClick={closePreview}>Close</Button>

						<Button variant="primary" icon="plus" onClick={addToLibrary}>
							Add to My prefabs
						</Button>
					</>
				}
			>
				<span>
					Add it to My prefabs to place it in any of your worlds.
					{preview.expiresAt && ` The link works until ${localDateTime(preview.expiresAt)}.`}
				</span>
			</FloatingBar>
		);
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
			<AllowSourcesDialog
				open={isReviewing && addresses.length > 1}
				onOpenChange={setReviewing}
				addresses={addresses}
				later="Not now leaves them waiting. You can forget any you allow later, from the Data tab (External sources this browser reads…)."
			/>
		</>
	);
};
