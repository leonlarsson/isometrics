import { useState } from "react";

import { saveWorldFile } from "#/editor/fileActions";
import { type TNotSavedReason, useSaveStatus } from "#/editor/persistence";

import { Button } from "./Button";
import { FloatingBar } from "./FloatingBar";

/** The bar's lines for each reason another tab gave this one to stop saving. */
const ELSEWHERE: Partial<Record<TNotSavedReason, string>> = {
	wipedElsewhere:
		"Everything was wiped from this browser in another tab. Saving here would bring this world back, so this tab stopped. Save it to a file to keep it, or reload the page to start again.",
	changedElsewhere:
		"Another tab opened a different world, deleted this one or replaced this browser’s worlds. Saving here would write over that, so this tab stopped. Save it to a file to keep what changed here, or reload the page for what’s open now.",
};

/**
 * When another tab of the app wiped everything or changed which world is open,
 * this tab stops saving (ADR-0158) and this bar says why, with Save to file
 * and Reload. It can be hidden; the save status still says Not saved.
 */
export const StoppedSavingBar = () => {
	const status = useSaveStatus();
	const [isHidden, setHidden] = useState(false);
	const text = status.state === "failed" ? ELSEWHERE[status.reason] : undefined;
	if (!text || isHidden) {
		return null;
	}
	return (
		<FloatingBar
			icon="alert"
			title="This tab stopped saving"
			dismiss={{
				label: "Hide this bar (the save status still says Not saved)",
				onDismiss: () => setHidden(true),
			}}
			actions={
				<>
					<Button icon="download" onClick={saveWorldFile}>
						Save to file
					</Button>

					<Button variant="primary" icon="reset" onClick={() => window.location.reload()}>
						Reload
					</Button>
				</>
			}
		>
			<span>{text}</span>
		</FloatingBar>
	);
};
