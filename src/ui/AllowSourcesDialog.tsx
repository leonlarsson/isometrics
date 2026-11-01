import { allowLink } from "#/editor/linkTrust";

import { ConfirmDialog } from "./ConfirmDialog";

import styles from "./WaitingSourcesDialog.module.css";

interface IAllowSourcesDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The addresses it would allow, each listed in full. */
	addresses: readonly string[];
	/** Where the ones not allowed now can be allowed or forgotten later, in a sentence. */
	later: string;
}

/**
 * Several external sources to allow at once (ADR-0119): every address listed
 * in full before any is allowed, none hidden behind "and 3 more", with Allow
 * all or Not now. From the preview's bar and the Data tab.
 */
export const AllowSourcesDialog = ({
	open,
	onOpenChange,
	addresses,
	later,
}: IAllowSourcesDialogProps) => (
	<ConfirmDialog
		open={open && addresses.length > 0}
		onOpenChange={onOpenChange}
		title={`Allow these ${addresses.length} external sources?`}
		description={
			<div className={styles.body}>
				<p>
					This browser reads each of them from then on, for any world that uses them. Reading one
					lets whoever runs it see your visit (your IP address, and when).
				</p>

				<ul className={styles.addresses}>
					{addresses.map((url) => (
						<li key={url}>{url}</li>
					))}
				</ul>

				<p>{later}</p>
			</div>
		}
		confirmLabel="Allow all"
		cancelLabel="Not now"
		onConfirm={() => {
			for (const url of addresses) {
				allowLink(url);
			}
		}}
	/>
);
