import { useState } from "react";

import { openWorldFile, replaceWorld, saveWorldFile } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";
import type { TScene } from "#/scene/schema";
import { createEmptyScene, TEMPLATES } from "#/templates";

import { ConfirmDialog } from "./ConfirmDialog";
import { Menu } from "./Menu";

/** A world waiting for the user to confirm it may replace the current one. */
interface IPendingWorld {
	name: string;
	create: () => TScene;
	/** Title of the world it replaces, kept so the dialog's text stays put while it closes. */
	replacing: string;
}

/** The toolbar's File menu: new, open, save to file and start from a template. */
export const FileMenu = () => {
	const title = useEditor((s) => s.scene.meta.title);
	const [pending, setPending] = useState<IPendingWorld | null>(null);
	// Separate from `pending` so the dialog's text doesn't change while it animates out.
	const [confirming, setConfirming] = useState(false);

	const ask = (name: string, create: () => TScene) => {
		setPending({ name, create, replacing: title });
		setConfirming(true);
	};

	return (
		<>
			<Menu.Root>
				<Menu.Trigger>File</Menu.Trigger>

				<Menu.Popup>
					<Menu.Item
						icon="file"
						label="New empty world"
						onClick={() => ask("an empty world", createEmptyScene)}
					/>

					<Menu.Submenu icon="layers" label="Start from a template">
						{TEMPLATES.map((template) => (
							<Menu.Item
								key={template.id}
								label={template.name}
								description={template.description}
								onClick={() => ask(`“${template.name}”`, template.create)}
							/>
						))}
					</Menu.Submenu>

					<Menu.Separator />

					<Menu.Item icon="folder" label="Open file…" shortcut="Ctrl+O" onClick={openWorldFile} />

					<Menu.Item
						icon="download"
						label="Save to file"
						shortcut="Ctrl+S"
						onClick={saveWorldFile}
					/>
				</Menu.Popup>
			</Menu.Root>

			<ConfirmDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={`Replace “${pending?.replacing ?? title}”?`}
				description={`It will be replaced by ${pending?.name ?? "another world"}, and undo can’t bring it back. Save it to a file first to keep a copy.`}
				confirmLabel="Replace"
				onConfirm={() => {
					if (pending) {
						replaceWorld(pending.create());
					}
				}}
				extraAction={{ label: "Save to file", onClick: saveWorldFile }}
			/>
		</>
	);
};
