import { useState } from "react";

import { useEditor } from "#/editor/store";
import { currentView } from "#/render/viewpoints";

import { ContextMenu, Menu } from "./Menu";
import { RenamePopover } from "./RenamePopover";
import { useLastNonNull } from "./useLastNonNull";
import { viewpointName } from "./ViewpointsSection";

/**
 * The right-click menu for a viewpoint's camera in the world (Edit mode,
 * render/ViewpointMarkers): go there, save the current view over it, make it
 * the opening view, rename it, or delete it. Opened through the store
 * (`openViewpointMenu`) by render/contextMenu.
 */
export const ViewpointContextMenu = () => {
	const menuNow = useEditor((s) => s.viewpointMenu);
	// The last one opened, kept while it animates closed.
	const menu = useLastNonNull(menuNow);
	const viewpoints = useEditor((s) => s.scene.viewpoints);
	const openingId = useEditor((s) => s.scene.camera.openingViewpointId);
	const [renamingNow, setRenaming] = useState<{ id: string; x: number; y: number } | null>(null);
	const renaming = useLastNonNull(renamingNow);
	const store = () => useEditor.getState();
	const index = viewpoints.findIndex((v) => v.id === menu?.id);
	const viewpoint = viewpoints[index];
	const renamedIndex = viewpoints.findIndex((v) => v.id === renaming?.id);
	const renamed = viewpoints[renamedIndex];
	const name = viewpoint ? viewpointName(viewpoint, index) : "";

	return (
		<>
			<ContextMenu
				open={menuNow !== null && viewpoint !== undefined}
				onOpenChange={(open) => {
					if (!open) {
						store().openViewpointMenu(null);
					}
				}}
				x={menu?.x ?? 0}
				y={menu?.y ?? 0}
				title={name}
				subtitle={viewpoint?.perspective ? "Viewpoint · Perspective" : "Viewpoint"}
			>
				{viewpoint && (
					<>
						<Menu.Item
							icon="camera"
							label="Go there"
							shortcut={index < 9 ? String(index + 1) : undefined}
							onClick={() => store().goToViewpoint(viewpoint.id)}
						/>

						<Menu.Item
							icon="camera"
							label={`Save the current view as “${name}”`}
							onClick={() => {
								const pose = currentView.read?.();
								if (pose) {
									store().updateViewpoint(viewpoint.id, (v) => {
										Object.assign(v, pose);
									});
								}
							}}
						/>

						<Menu.CheckboxItem
							icon="star"
							label="Opening view"
							checked={viewpoint.id === openingId}
							onCheckedChange={(on) => store().setOpeningViewpoint(on ? viewpoint.id : null)}
						/>

						<Menu.Separator />

						<Menu.Item icon="edit" label="Rename" onClick={() => menu && setRenaming(menu)} />

						<Menu.Item
							icon="list"
							label="Show in the Viewpoints tab"
							onClick={() => store().setTab("views")}
						/>

						<Menu.Separator />

						<Menu.Item
							icon="trash"
							label="Delete"
							onClick={() => store().removeViewpoint(viewpoint.id)}
						/>
					</>
				)}
			</ContextMenu>

			<RenamePopover
				open={renamingNow !== null && renamed !== undefined}
				onClose={() => setRenaming(null)}
				x={renaming?.x ?? 0}
				y={renaming?.y ?? 0}
				label={renamed ? viewpointName(renamed, renamedIndex) : ""}
				value={renamed?.name ?? ""}
				placeholder={`Viewpoint ${renamedIndex + 1}`}
				onCommit={(text) =>
					renaming &&
					store().updateViewpoint(renaming.id, (v) => {
						v.name = text;
					})
				}
			/>
		</>
	);
};
