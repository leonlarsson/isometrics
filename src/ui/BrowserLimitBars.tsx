import { useState } from "react";

import { saveWorldFile } from "#/editor/fileActions";
import { storageAvailable } from "#/lib/storage";
import { useDrawingLost } from "#/render/webgl";

import { Button } from "./Button";
import { FloatingBar } from "./FloatingBar";

/**
 * Bars over the view for what the browser won't do (ADR-0145), so a stranger
 * in an unusual browser is told what's going on rather than finding out later.
 */

/**
 * When the browser takes the 3D view's WebGL context away while it's open
 * (its graphics were reset, or it ran short of memory), the view stops
 * drawing and won't start again by itself: this bar says so, with Reload.
 * Gone again if the browser gives the context back.
 */
export const DrawingLostBar = () => {
	const isLost = useDrawingLost((s) => s.isLost);
	if (!isLost) {
		return null;
	}
	return (
		<FloatingBar
			icon="alert"
			title="The 3D view stopped drawing"
			actions={
				<Button variant="primary" icon="reset" onClick={() => window.location.reload()}>
					Reload
				</Button>
			}
		>
			<span>
				The browser stopped drawing it (its graphics were reset, or it ran short of memory). Reload
				the page to draw it again.
			</span>
		</FloatingBar>
	);
};

/** Read once: whether storage is blocked doesn't change while the page is open. */
const isStorageBlocked = () => !storageAvailable();

/**
 * When the browser blocks site data, the app opens all the same and this bar
 * says nothing will be kept, with Save to file. It can be hidden until the
 * page reloads.
 */
export const NothingSavedBar = () => {
	const [isBlocked] = useState(isStorageBlocked);
	const [isHidden, setHidden] = useState(false);
	if (!isBlocked || isHidden) {
		return null;
	}
	return (
		<FloatingBar
			icon="alert"
			title="Nothing will be saved in this browser"
			dismiss={{
				label: "Hide this bar (it's back when the page reloads)",
				onDismiss: () => setHidden(true),
			}}
			actions={
				<Button icon="download" onClick={saveWorldFile}>
					Save to file
				</Button>
			}
		>
			<span>
				This browser doesn’t let the site store anything (private browsing or blocked site data).
				Save your world to a file to keep it.
			</span>
		</FloatingBar>
	);
};
