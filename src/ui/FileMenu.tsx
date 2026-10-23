import { useState } from "react";

import {
	deleteOpenWorld,
	duplicateWorld,
	openSavedWorld,
	openWorldFile,
	saveWorldFile,
	startNewWorld,
} from "#/editor/fileActions";
import { type IWorldInfo, listWorlds, openWorldId } from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { createEmptyScene, TEMPLATES } from "#/templates";

import { ConfirmDialog } from "./ConfirmDialog";
import { Menu } from "./Menu";
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
	const [browsing, setBrowsing] = useState(false);
	// Kept while the dialog animates out, so its text doesn't change.
	const [deletingTitle, setDeletingTitle] = useState(title);

	return (
		<>
			<Menu.Root
				onOpenChange={(open) => {
					if (open) {
						setWorlds(listWorlds());
						setOpenId(openWorldId());
					}
				}}
			>
				<Menu.Trigger>File</Menu.Trigger>

				<Menu.Popup>
					<Menu.Item
						icon="file"
						label="New empty world"
						onClick={() => startNewWorld(createEmptyScene())}
					/>

					<Menu.Submenu icon="layers" label="New from a template">
						{TEMPLATES.map((template) => (
							<Menu.Item
								key={template.id}
								label={template.name}
								description={template.description}
								onClick={() => startNewWorld(template.create())}
							/>
						))}
					</Menu.Submenu>

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

					<Menu.Separator />

					<Menu.Item icon="upload" label="Open file…" shortcut="Ctrl+O" onClick={openWorldFile} />

					<Menu.Item
						icon="download"
						label="Save to file"
						shortcut="Ctrl+S"
						onClick={saveWorldFile}
					/>
				</Menu.Popup>
			</Menu.Root>

			<WorldsDialog open={browsing} onOpenChange={setBrowsing} />

			<ConfirmDialog
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete “${deletingTitle}”?`}
				description="It’s removed from your worlds, and undo can’t bring it back. A copy is kept under Scene → Backups."
				confirmLabel="Delete"
				danger
				onConfirm={() => deleteOpenWorld(createEmptyScene)}
				extraAction={{ label: "Save to file", onClick: saveWorldFile }}
			/>
		</>
	);
};
