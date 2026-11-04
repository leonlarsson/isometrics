import { useEffect, useState } from "react";

import {
	deleteBrowserBackup,
	type IBrowserBackup,
	listBrowserBackups,
	readBrowserExport,
} from "#/editor/browserExport";
import { addBrowserBackup, downloadBrowserBackup, restoreBackup } from "#/editor/fileActions";
import {
	deleteSceneBackup,
	downloadSceneBackup,
	formatStorageSize,
	type ISceneBackup,
	listSceneBackups,
} from "#/editor/persistence";
import { localDateTime } from "#/lib/when";
import { plural } from "#/scene/format";

import { IconButton, IconButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Hint } from "./fields";
import { List, ListItem } from "./List";
import { StorageMeter } from "./StorageMeter";

const titleOf = (raw: string) => {
	try {
		const parsed = JSON.parse(raw) as { meta?: { title?: unknown } };
		return typeof parsed.meta?.title === "string" ? parsed.meta.title : "Untitled";
	} catch {
		return "Unreadable file";
	}
};

const formatDate = (ms: number) => (ms ? `Kept ${localDateTime(ms)}` : "Kept at an unknown time");

/** What a copy of this browser is called in the list. */
const BROWSER_COPY = "This browser before an import";

/** A copy of this browser, with how many worlds it holds (null: it can't be read). */
interface IBrowserCopy {
	backup: IBrowserBackup;
	worlds: number | null;
}

const listBrowserCopies = (): IBrowserCopy[] =>
	listBrowserBackups().map((backup) => {
		try {
			return { backup, worlds: readBrowserExport(backup.raw).worlds.length };
		} catch {
			return { backup, worlds: null };
		}
	});

/** The backup to delete: a world's, or a copy of this browser. */
type TTarget =
	| { kind: "world"; backup: ISceneBackup }
	| { kind: "browser"; backup: IBrowserBackup };

interface IBackupsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Copies of worlds kept before anything could lose them (ADR-0020, ADR-0044):
 * deleted worlds, saves that had to be repaired or couldn't be opened, and
 * worlds left behind by Start fresh. Restore one as a new world, download it,
 * or delete it. Copies of the whole browser kept before an import replaced
 * it (ADR-0140) are listed first: download one as an export, or add its
 * worlds back. They belong to the browser, not to the open world, so they
 * live in the File menu rather than the properties.
 */
export const BackupsDialog = ({ open, onOpenChange }: IBackupsDialogProps) => {
	// Read from localStorage when the dialog opens and after each change.
	const [backups, setBackups] = useState<ISceneBackup[]>([]);
	const [browserCopies, setBrowserCopies] = useState<IBrowserCopy[]>([]);
	// The backup to delete stays set while the dialog animates closed, so its text doesn't change.
	const [target, setTarget] = useState<TTarget | null>(null);
	const [confirming, setConfirming] = useState(false);

	useEffect(() => {
		if (open) {
			setBackups(listSceneBackups());
			setBrowserCopies(listBrowserCopies());
		}
	}, [open]);

	const download = (chosen: TTarget) =>
		chosen.kind === "world"
			? downloadSceneBackup(chosen.backup)
			: downloadBrowserBackup(chosen.backup);

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={onOpenChange}
				title="Backups"
				description="Copies of worlds kept before they were deleted, repaired or couldn’t be opened, and of this browser before an import replaced it, exactly as they were."
			>
				<StorageMeter />

				{backups.length + browserCopies.length === 0 ? (
					<Hint>No backups. One is made whenever a world is deleted or has to be repaired.</Hint>
				) : (
					<List>
						{browserCopies.map(({ backup, worlds }) => (
							<ListItem
								key={backup.key}
								stacked
								label={BROWSER_COPY}
								meta={`${formatDate(backup.savedAt)}: ${worlds === null ? "can’t be read" : plural(worlds, "world")}, ${formatStorageSize(backup.raw.length)}`}
								actions={
									<IconButtonGroup>
										<IconButton
											icon="reset"
											size="sm"
											label="Add its worlds and backups to this browser"
											disabled={worlds === null}
											onClick={() => {
												addBrowserBackup(backup);
												onOpenChange(false);
											}}
										/>

										<IconButton
											icon="download"
											size="sm"
											label="Download it as a browser’s export"
											onClick={() => downloadBrowserBackup(backup)}
										/>

										<IconButton
											icon="trash"
											size="sm"
											label="Delete backup"
											onClick={() => {
												setTarget({ kind: "browser", backup });
												setConfirming(true);
											}}
										/>
									</IconButtonGroup>
								}
							/>
						))}

						{backups.map((backup) => (
							<ListItem
								key={backup.key}
								stacked
								label={titleOf(backup.raw)}
								meta={formatDate(backup.savedAt)}
								actions={
									<IconButtonGroup>
										<IconButton
											icon="reset"
											size="sm"
											label="Restore as a new world"
											onClick={() => {
												restoreBackup(backup);
												onOpenChange(false);
											}}
										/>

										<IconButton
											icon="download"
											size="sm"
											label="Download backup"
											onClick={() => downloadSceneBackup(backup)}
										/>

										<IconButton
											icon="trash"
											size="sm"
											label="Delete backup"
											onClick={() => {
												setTarget({ kind: "world", backup });
												setConfirming(true);
											}}
										/>
									</IconButtonGroup>
								}
							/>
						))}
					</List>
				)}
			</Dialog>

			<ConfirmDialog
				open={confirming}
				onOpenChange={setConfirming}
				title="Delete this backup?"
				description={`“${target?.kind === "browser" ? BROWSER_COPY : target ? titleOf(target.backup.raw) : ""}” will be removed from this browser for good. Download it first if you might need it.`}
				confirmLabel="Delete"
				danger
				onConfirm={() => {
					if (target?.kind === "world") {
						deleteSceneBackup(target.backup.key);
						setBackups(listSceneBackups());
					} else if (target?.kind === "browser") {
						deleteBrowserBackup(target.backup.key);
						setBrowserCopies(listBrowserCopies());
					}
				}}
				extraAction={target ? { label: "Download", onClick: () => download(target) } : undefined}
			/>
		</>
	);
};
