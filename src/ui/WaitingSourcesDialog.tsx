import { useEffect, useState } from "react";

import { allowLink } from "#/editor/linkTrust";
import { markAddressesAsked, useAskedAddresses, useWaitingSources } from "#/editor/sourceRefresh";
import { useEditor } from "#/editor/store";
import { previewOf } from "#/editor/whatIsOpen";

import { ConfirmDialog } from "./ConfirmDialog";

import styles from "./WaitingSourcesDialog.module.css";

/** The first this many addresses are listed; the rest are counted. */
const ADDRESSES_SHOWN = 6;

/**
 * Asks before a world reads from outside (ADR-0119): when a world opens, or a
 * change to it (a patch, a paste) brings addresses this browser hasn't
 * allowed, it says which, and why they wait. Allow and read them, or not now:
 * they stay listed in the Data tab under Sources, with a button to go there.
 * Each address is asked about once per opening, once the world is on screen
 * (not over its loading screen).
 */
export const WaitingSourcesDialog = () => {
	const opening = useEditor((s) => s.openedWorldCount);
	const waiting = useWaitingSources();
	const [open, setOpen] = useState(false);
	const isOnScreen = useEditor((s) => s.openingWorld === null);
	// A preview from a link has no Data tab: its bar offers Allow (ADR-0121).
	const isPreview = useEditor((s) => previewOf(s.whatIsOpen) !== null);
	const addresses = [...new Set(waiting.map((source) => source.url ?? ""))];

	useEffect(() => {
		// The addresses already asked about since the world opened (here, or before a shared world loaded).
		const asked = useAskedAddresses.getState();
		const already = asked.opening === opening ? asked.urls : new Set<string>();
		const fresh = addresses.filter((url) => !already.has(url));
		if (fresh.length > 0) {
			markAddressesAsked(fresh);
			setOpen(true);
		}
		if (addresses.length === 0) {
			setOpen(false);
		}
	}, [opening, addresses.join("\n")]);

	const one = addresses.length === 1;
	return (
		<ConfirmDialog
			open={open && addresses.length > 0 && isOnScreen}
			onOpenChange={setOpen}
			title="This world uses external sources"
			description={
				<div className={styles.body}>
					<p>
						{one
							? "It reads data from an external source this browser hasn't read before. Worlds can come from anyone (a file, an AI's answer), so nothing is read from it until you allow it: reading tells it you're looking."
							: `It reads data from ${addresses.length} external sources this browser hasn't read before. Worlds can come from anyone (a file, an AI's answer), so nothing is read from them until you allow them: reading tells each one you're looking.`}
					</p>

					<ul className={styles.addresses}>
						{addresses.slice(0, ADDRESSES_SHOWN).map((url) => (
							<li key={url}>{url}</li>
						))}
					</ul>

					{addresses.length > ADDRESSES_SHOWN && (
						<p>{`And ${addresses.length - ADDRESSES_SHOWN} more.`}</p>
					)}

					<p>
						{`Until then the world shows what it last read. You can allow ${one ? "it" : "them"} later ${isPreview ? "from the bar at the top" : "in the Data tab, under Sources"}.`}
					</p>
				</div>
			}
			confirmLabel={one ? "Allow and read it" : "Allow and read them"}
			onConfirm={() => {
				for (const url of addresses) {
					allowLink(url);
				}
				setOpen(false);
			}}
			cancelLabel="Not now"
			extraAction={{
				label: "Open the Data tab",
				onClick: () => {
					useEditor.getState().setTab("data");
					setOpen(false);
				},
			}}
		/>
	);
};
