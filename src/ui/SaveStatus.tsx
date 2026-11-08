import { saveWorldFile } from "#/editor/fileActions";
import { type TNotSavedReason, type TSaveStatus, useSaveStatus } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { useSharedLinks } from "#/editor/userWorlds";
import { keepsOpenWorld } from "#/editor/whatIsOpen";

import { Icon } from "./Icon";
import { Menu } from "./Menu";

import styles from "./SaveStatus.module.css";

const timeOf = (at: number) =>
	new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Why the world isn't saved, and what to do, for each reason. */
const FAILED_DETAIL: Record<TNotSavedReason, string> = {
	full: "This browser’s storage for the site is full. Save your world to a file, or delete worlds you no longer need (File → All worlds).",
	unavailable:
		"This browser doesn’t let the site store anything (private browsing or blocked site data). Save your world to a file to keep it.",
	wiped:
		"Everything was wiped from this browser, so nothing is saved any more. Reload the page to start again.",
	wipedElsewhere:
		"Everything was wiped from this browser in another tab, so this tab stopped saving rather than bring this world back. Save it to a file to keep it, or reload the page to start again.",
	changedElsewhere:
		"Another tab opened a different world, deleted this one or replaced this browser’s worlds, so this tab stopped saving rather than write over that. Save to file keeps what changed here; reload the page for what’s open now, or open a world from the File menu here to save again.",
};

/** What the status says, and the longer explanation in its menu. */
const describe = (status: TSaveStatus): { label: string; detail: string } => {
	switch (status.state) {
		case "new":
			return {
				label: "Not saved yet",
				detail: "Your changes are saved in this browser as you make them.",
			};
		case "saving":
			return { label: "Saving…", detail: "Saving your changes in this browser." };
		case "saved":
			return {
				label: "Saved",
				detail: `${status.at ? `Saved in this browser at ${timeOf(status.at)}` : "Saved in this browser"}, as you make changes. Only this browser has it: save it to a file to keep a copy elsewhere, or share a link to open it somewhere else.`,
			};
		case "failed":
			return {
				label: "Not saved",
				detail: FAILED_DETAIL[status.reason],
			};
	}
};

/**
 * Whether the open world is saved, next to the File menu (ADR-0057): "Saved",
 * "Saving…" or "Not saved". Its menu says when, where and what to do, with
 * Save to file and Share a link… (ADR-0120). Edit mode only; nothing changes
 * in View mode.
 */
export const SaveStatus = () => {
	const mode = useEditor((s) => s.mode);
	// Only a world of one's own is saved: not a preview from a link, not the home screen (ADR-0121).
	const ownsWorld = useEditor((s) => keepsOpenWorld(s.whatIsOpen));
	const status = useSaveStatus();
	const linkCount = useSharedLinks((s) => s.links.length);
	if (mode !== "edit" || !ownsWorld) {
		return null;
	}
	const { label, detail } = describe(status);
	return (
		<Menu.Root>
			<Menu.Trigger
				label={`${label}: more about saving`}
				chevron={false}
				tone={status.state === "failed" ? "danger" : undefined}
			>
				<span className={styles.status} data-state={status.state}>
					{status.state === "saving" ? (
						<span className={styles.pulse} aria-hidden="true" />
					) : (
						<Icon name={status.state === "failed" ? "alert" : "check"} size={14} />
					)}

					<span className={styles.label}>{label}</span>
				</span>
			</Menu.Trigger>

			<Menu.Popup>
				<Menu.Note>{detail}</Menu.Note>

				<Menu.Separator />

				<Menu.Item icon="download" label="Save to file" shortcut="Ctrl+S" onClick={saveWorldFile} />

				<Menu.Item
					icon="newTab"
					label="Share a link…"
					description={
						linkCount > 0
							? `A public copy for anyone with the link; this browser shares ${linkCount === 1 ? "1 link" : `${linkCount} links`}`
							: "A public copy for anyone with the link, until it expires"
					}
					onClick={() => useEditor.getState().setShareOpen(true)}
				/>
			</Menu.Popup>
		</Menu.Root>
	);
};
