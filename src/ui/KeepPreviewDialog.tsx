import { keepPreview } from "#/editor/fileActions";
import { useEditor } from "#/editor/store";

import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Edit, asked for while a world from a link is a preview (ADR-0121): editing
 * it keeps a copy in this browser first, which is said plainly. Stay in View
 * keeps nothing.
 */
export const KeepPreviewDialog = () => {
	const open = useEditor((s) => s.isAskingToKeep);
	const title = useEditor((s) => s.scene.meta.title);
	const close = () => useEditor.getState().setAskingToKeep(false);
	return (
		<ConfirmDialog
			open={open}
			onOpenChange={(next) => !next && close()}
			title="Keep a copy to edit it?"
			description={`Editing “${title}” keeps a copy of it in this browser, next to your worlds, saved as you work. The link isn't changed: whoever opens it still sees it as it was shared.`}
			confirmLabel="Keep a copy and edit"
			cancelLabel="Stay in View"
			onConfirm={() => {
				keepPreview();
				close();
				useEditor.getState().setMode("edit");
			}}
		/>
	);
};
