import { useState } from "react";

import {
	deleteSceneBackup,
	downloadSceneBackup,
	type ISceneBackup,
	listSceneBackups,
} from "#/editor/persistence";

import { IconButton, IconButtonGroup } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Hint, Section } from "./fields";
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
		? new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
		: "Unknown date";

/**
 * Saved worlds that a newer version couldn't open, kept so nothing is lost
 * (ADR-0020). Only shown when there are any.
 */
export const BackupsPanel = () => {
	const [backups, setBackups] = useState(listSceneBackups);
	// The backup to delete stays set while the dialog animates closed, so its text doesn't change.
	const [target, setTarget] = useState<ISceneBackup | null>(null);
	const [confirming, setConfirming] = useState(false);

	if (backups.length === 0) {
		return null;
	}

	return (
		<Section title="Backups">
			<Hint>
				Saved worlds this version couldn’t open, or had to repair, exactly as they were. Download
				one to keep it, or delete it when you no longer need it.
			</Hint>

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
									icon="download"
									label="Download backup"
									onClick={() => downloadSceneBackup(backup)}
								/>

								<IconButton
									icon="trash"
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
		</Section>
	);
};
