import { useEffect, useState } from "react";

import { restoreBackup } from "#/editor/fileActions";
import {
	deleteSceneBackup,
	downloadSceneBackup,
	type ISceneBackup,
	listSceneBackups,
} from "#/editor/persistence";

import { IconButton, IconButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Hint } from "./fields";
import { List, ListItem } from "./List";

const titleOf = (raw: string) => {
	try {
		const parsed = JSON.parse(raw) as { meta?: { title?: unknown } };
		return typeof parsed.meta?.title === "string" ? parsed.meta.title : "Untitled";
	} catch {
		return "Unreadable file";
	}
};

const formatDate = (ms: number) =>
	ms
		? `Kept ${new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
		: "Kept at an unknown time";

interface IBackupsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Copies of worlds kept before anything could lose them (ADR-0020, ADR-0044):
 * deleted worlds, saves that had to be repaired or couldn't be opened, and
 * worlds left behind by Start fresh. Restore one as a new world, download it,
 * or delete it. They belong to the browser, not to the open world, so they
 * live in the File menu rather than the Scene tab.
 */
export const BackupsDialog = ({ open, onOpenChange }: IBackupsDialogProps) => {
	// Read from localStorage when the dialog opens and after each change.
	const [backups, setBackups] = useState<ISceneBackup[]>([]);
	// The backup to delete stays set while the dialog animates closed, so its text doesn't change.
	const [target, setTarget] = useState<ISceneBackup | null>(null);
	const [confirming, setConfirming] = useState(false);

	useEffect(() => {
		if (open) {
			setBackups(listSceneBackups());
		}
	}, [open]);

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={onOpenChange}
				title="Backups"
				description="Copies of worlds kept before they were deleted, repaired or couldn’t be opened, exactly as they were."
			>
				{backups.length === 0 ? (
					<Hint>No backups. One is made whenever a world is deleted or has to be repaired.</Hint>
				) : (
					<List>
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
												setTarget(backup);
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
				description={`“${target ? titleOf(target.raw) : ""}” will be removed from this browser for good. Download it first if you might need it.`}
				confirmLabel="Delete"
				danger
				onConfirm={() => {
					if (target) {
						deleteSceneBackup(target.key);
						setBackups(listSceneBackups());
					}
				}}
				extraAction={
					target ? { label: "Download", onClick: () => downloadSceneBackup(target) } : undefined
				}
			/>
		</>
	);
};
