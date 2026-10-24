import { useRef, useState } from "react";

import { saveWorldFile } from "#/editor/fileActions";
import { listSceneBackups, listWorlds, wipeEverything } from "#/editor/persistence";
import { notify } from "#/editor/toasts";

import { ConfirmDialog } from "./ConfirmDialog";

interface IWipeEverythingProps {
	open: boolean;
	onClose: () => void;
}

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/**
 * Deleting everything this app keeps in the browser, behind two confirmations
 * (ADR-0045): the first says what goes and offers Save to file, the second
 * names the counts and only works after a 3-second countdown. Then the page
 * reloads as on a first visit. From File → Wipe everything, and from the
 * offer to start fresh after a big update (ADR-0059).
 */
export const WipeEverything = ({ open, onClose }: IWipeEverythingProps) => {
	const [sure, setSure] = useState(false);
	const [counts, setCounts] = useState({ worlds: 0, backups: 0 });
	// Continue closes the first dialog in the same click, before `sure` has updated: this tells
	// that close apart from a cancel.
	const continuing = useRef(false);
	const close = () => {
		setSure(false);
		onClose();
	};

	return (
		<>
			<ConfirmDialog
				open={open && !sure}
				onOpenChange={(next) => {
					// Closing after Continue mustn't close the second dialog too.
					if (!next && !continuing.current) {
						close();
					}
					continuing.current = false;
				}}
				title="Wipe everything?"
				description="This deletes every world in this browser, all backups, and settings such as panel sizes. Save any world you want to keep to a file first."
				confirmLabel="Continue"
				danger
				onConfirm={() => {
					continuing.current = true;
					setCounts({ worlds: listWorlds().length, backups: listSceneBackups().length });
					setSure(true);
				}}
				extraAction={{ label: "Save to file", onClick: saveWorldFile }}
			/>

			<ConfirmDialog
				open={open && sure}
				onOpenChange={(next) => {
					if (!next) {
						close();
					}
				}}
				title="This can’t be undone"
				description={`${plural(counts.worlds, "world")} and ${plural(counts.backups, "backup")} will be deleted for good.`}
				confirmLabel="Wipe everything"
				danger
				confirmDelaySeconds={3}
				onConfirm={() => {
					if (wipeEverything()) {
						// Start over on the plain path, as on a first visit.
						window.location.assign(window.location.pathname);
					} else {
						notify(
							"Nothing was wiped",
							"The browser refused to clear this site’s storage.",
							"error",
						);
					}
				}}
			/>
		</>
	);
};
