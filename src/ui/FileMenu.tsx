import { useState } from "react";

import {
	deleteOpenWorld,
	duplicateWorld,
	openSavedWorld,
	openWorldFile,
	resetThisBrowsersSettings,
	saveWorldFile,
} from "#/editor/fileActions";
import { type IWorldInfo, listSceneBackups, listWorlds, openWorldId } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { createEmptyScene } from "#/templates";

import { BackupsDialog } from "./BackupsDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { Menu } from "./Menu";
import { NewWorldDialog } from "./NewWorldDialog";
import { WipeEverything } from "./WipeEverything";
import { formatEdited, WorldsDialog } from "./WorldsDialog";

/** How many worlds Open world lists; All worlds… shows the rest. */
const RECENT_WORLDS = 8;

/**
 * The toolbar's File menu: the worlds kept in this browser (new, from a
 * template, open, duplicate, delete) and world files (open, save). New worlds
 * open next to the others instead of replacing one (ADR-0044).
 */
export const FileMenu = () => {
	const title = useEditor((s) => s.scene.meta.title);
	// Read when the menu opens: the list lives in localStorage, not in the store.
	const [worlds, setWorlds] = useState<IWorldInfo[]>([]);
	const [openId, setOpenId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [creating, setCreating] = useState(false);
	const [browsing, setBrowsing] = useState(false);
	const [viewingBackups, setViewingBackups] = useState(false);
	const [backupCount, setBackupCount] = useState(0);
	// Kept while the dialog animates out, so its text doesn't change.
	const [deletingTitle, setDeletingTitle] = useState(title);
	// Wiping everything takes two confirmations; the second one names what goes.
	const [wiping, setWiping] = useState(false);
	const [resettingSettings, setResettingSettings] = useState(false);

	return (
		<>
			<Menu.Root
				onOpenChange={(open) => {
					if (open) {
						setWorlds(listWorlds());
						setBackupCount(listSceneBackups().length);
						setOpenId(openWorldId());
					}
				}}
			>
				<Menu.Trigger>File</Menu.Trigger>

				<Menu.Popup>
					<Menu.Item
						icon="file"
						label="New world…"
						description="Blank, or from a starter world"
						onClick={() => setCreating(true)}
					/>

					<Menu.Submenu icon="folder" label="Open world">
						{worlds.length === 0 && (
							<Menu.Item label="No saved worlds yet" disabled onClick={() => {}} />
						)}

						{worlds.slice(0, RECENT_WORLDS).map((world) => (
							<Menu.Item
								key={world.id}
								icon={world.id === openId ? "check" : "file"}
								label={world.title}
								description={world.id === openId ? "Open now" : formatEdited(world.updatedAt)}
								onClick={() => openSavedWorld(world.id)}
							/>
						))}

						{worlds.length > 0 && <Menu.Separator />}

						{worlds.length > 0 && (
							<Menu.Item
								icon="search"
								label="All worlds…"
								description={`Search, copy or delete any of the ${worlds.length}`}
								onClick={() => setBrowsing(true)}
							/>
						)}
					</Menu.Submenu>

					<Menu.Item icon="copy" label="Duplicate world" onClick={duplicateWorld} />

					<Menu.Item
						icon="trash"
						label="Delete world…"
						onClick={() => {
							setDeletingTitle(title);
							setDeleting(true);
						}}
					/>

					<Menu.Item
						icon="reset"
						label="Backups…"
						description={
							backupCount === 0
								? "None kept yet"
								: `${backupCount} kept: restore, download or delete`
						}
						onClick={() => setViewingBackups(true)}
					/>

					<Menu.Separator />

					<Menu.Item icon="upload" label="Open file…" shortcut="Ctrl+O" onClick={openWorldFile} />

					<Menu.Item
						icon="download"
						label="Save to file"
						shortcut="Ctrl+S"
						onClick={saveWorldFile}
					/>

					<Menu.Separator />

					<Menu.Item
						icon="user"
						label="Preferences…"
						description="How the camera moves for you, and overlays, in this browser"
						onClick={() => useEditor.getState().setPreferencesOpen(true)}
					/>

					<Menu.Item
						icon="reset"
						label="Reset this browser’s settings…"
						description="Panels, favourites, cameras, Preferences; keeps your worlds"
						onClick={() => setResettingSettings(true)}
					/>

					<Menu.Item
						icon="trash"
						label="Wipe everything…"
						description="Every world, backup and setting in this browser"
						onClick={() => setWiping(true)}
					/>
				</Menu.Popup>
			</Menu.Root>

			<NewWorldDialog open={creating} onOpenChange={setCreating} />

			<WorldsDialog open={browsing} onOpenChange={setBrowsing} />

			<BackupsDialog open={viewingBackups} onOpenChange={setViewingBackups} />

			<ConfirmDialog
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete “${deletingTitle}”?`}
				description="It’s removed from your worlds, and undo can’t bring it back. A copy is kept under File → Backups."
				confirmLabel="Delete"
				danger
				onConfirm={() => deleteOpenWorld(createEmptyScene)}
				extraAction={{ label: "Save to file", onClick: saveWorldFile }}
			/>

			<WipeEverything open={wiping} onClose={() => setWiping(false)} />

			<ConfirmDialog
				open={resettingSettings}
				onOpenChange={setResettingSettings}
				title="Reset this browser’s settings?"
				description="Panel sizes and folds, Add to scene’s favourites and recently used, where the camera was in each world, and Preferences go back to their defaults. Your worlds and backups stay. The page reloads."
				confirmLabel="Reset settings"
				danger
				onConfirm={resetThisBrowsersSettings}
			/>
		</>
	);
};
