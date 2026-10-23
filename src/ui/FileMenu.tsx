import { useState } from "react";

import {
	deleteOpenWorld,
	duplicateWorld,
	openSavedWorld,
	openWorldFile,
	saveWorldFile,
	startNewWorld,
} from "#/editor/fileActions";
import {
	type IWorldInfo,
	listSceneBackups,
	listWorlds,
	openWorldId,
	wipeEverything,
} from "#/editor/persistence";
import { useEditor } from "#/editor/store";
import { notify } from "#/editor/toasts";
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
	// Wiping everything takes two confirmations; the second one names what goes.
	const [wipeStep, setWipeStep] = useState<0 | 1 | 2>(0);
	const [wipeCounts, setWipeCounts] = useState({ worlds: 0, backups: 0 });
	const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

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

					<Menu.Separator />

					<Menu.Item
						icon="trash"
						label="Wipe everything…"
						description="Every world, backup and setting in this browser"
						onClick={() => setWipeStep(1)}
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

			<ConfirmDialog
				open={wipeStep === 1}
				// Closing after Continue mustn't undo the step to the second dialog.
				onOpenChange={(open) => setWipeStep((step) => (open ? 1 : step === 1 ? 0 : step))}
				title="Wipe everything?"
				description="This deletes every world in this browser, all backups, and settings such as panel sizes. Save any world you want to keep to a file first."
				confirmLabel="Continue"
				danger
				onConfirm={() => {
					setWipeCounts({ worlds: listWorlds().length, backups: listSceneBackups().length });
					setWipeStep(2);
				}}
				extraAction={{ label: "Save to file", onClick: saveWorldFile }}
			/>

			<ConfirmDialog
				open={wipeStep === 2}
				onOpenChange={(open) => setWipeStep((step) => (open ? 2 : step === 2 ? 0 : step))}
				title="This can’t be undone"
				description={`${plural(wipeCounts.worlds, "world")} and ${plural(wipeCounts.backups, "backup")} will be deleted for good.`}
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
