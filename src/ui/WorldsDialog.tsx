import { useEffect, useState } from "react";

import { deleteSavedWorld, duplicateSavedWorld, openSavedWorld } from "#/editor/fileActions";
import { type IWorldInfo, listWorlds, openWorldId } from "#/editor/persistence";
import { createEmptyScene } from "#/templates";

import { IconButton } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Hint, TextField } from "./fields";
import { List, ListItem } from "./List";
import { StorageMeter } from "./StorageMeter";

/** "Edited 23 Oct 2026, 13:55", for a world's last save. */
export const formatEdited = (ms: number) =>
	ms
		? `Edited ${new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
		: "Edited at an unknown time";

interface IWorldsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Every world saved in this browser, searchable: open one, or copy or delete
 * it without opening it first (ADR-0044). Deleting asks first and keeps a backup.
 */
export const WorldsDialog = ({ open, onOpenChange }: IWorldsDialogProps) => {
	const [query, setQuery] = useState("");
	// Read from localStorage when the dialog opens and after each change.
	const [worlds, setWorlds] = useState<IWorldInfo[]>([]);
	const [openId, setOpenId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<IWorldInfo | null>(null);
	// Separate from `deleting` so the dialog's text stays put while it closes.
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const refresh = () => {
		setWorlds(listWorlds());
		setOpenId(openWorldId());
	};
	useEffect(() => {
		if (open) {
			setQuery("");
			refresh();
		}
	}, [open]);

	const needle = query.trim().toLowerCase();
	const shown = needle
		? worlds.filter((world) => world.title.toLowerCase().includes(needle))
		: worlds;

	return (
		<>
			<Dialog
				open={open}
				onOpenChange={onOpenChange}
				title="All worlds"
				description={`${worlds.length} saved in this browser, most recently edited first.`}
			>
				<StorageMeter />

				<TextField label="Search" value={query} onChange={setQuery} placeholder="Search by title" />

				{shown.length === 0 ? (
					<Hint>{needle ? `No world matches “${query.trim()}”.` : "No saved worlds yet."}</Hint>
				) : (
					<List>
						{shown.map((world) => (
							<ListItem
								key={world.id}
								label={world.title}
								meta={world.id === openId ? "Open now" : formatEdited(world.updatedAt)}
								stacked
								current={world.id === openId}
								onClick={() => {
									openSavedWorld(world.id);
									onOpenChange(false);
								}}
								actions={
									<>
										<IconButton
											icon="copy"
											size="sm"
											label="Duplicate"
											onClick={() => {
												duplicateSavedWorld(world.id);
												onOpenChange(false);
											}}
										/>

										<IconButton
											icon="trash"
											size="sm"
											label="Delete"
											onClick={() => {
												setDeleting(world);
												setConfirmingDelete(true);
											}}
										/>
									</>
								}
							/>
						))}
					</List>
				)}
			</Dialog>

			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title={`Delete “${deleting?.title ?? "this world"}”?`}
				description="It’s removed from your worlds, and undo can’t bring it back. A copy is kept under File → Backups."
				confirmLabel="Delete"
				danger
				onConfirm={() => {
					if (deleting) {
						deleteSavedWorld(deleting.id, createEmptyScene);
						refresh();
					}
				}}
			/>
		</>
	);
};
