import { setSidePaneOpen } from "#/editor/sidePanes";
import { useEditor } from "#/editor/store";
import { workshopOf } from "#/editor/whatIsOpen";
import {
	confirmLeavingWorkshop,
	leaveWorkshopFirst,
	newPrefabName,
	renamePrefabInWorkshop,
	saveWorkshop,
	showGroundInWorkshop,
	workshopHasPieces,
} from "#/editor/workshop";
import { prefabName } from "#/parts/prefabParts";

import { Button, IconButton } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { FloatingBar } from "./FloatingBar";
import { Input } from "./fields";

import styles from "./WorkshopBar.module.css";

/**
 * The Workshop's bar (ADR-0134): one slim row over the view, so it stays out
 * of the way while building. The prefab's name (typed in place), Show the
 * ground, Leave without saving and Save the prefab; what the Workshop is, in
 * a tooltip, and its Prefab panel a click away. Leaving with something built
 * is asked here first, whatever asked to leave (`leaveWorkshopFirst`).
 */
export const WorkshopBar = () => {
	const workshop = useEditor((s) => workshopOf(s.whatIsOpen));
	const hasPieces = useEditor((s) => workshopHasPieces(s.scene));
	const isAsking = useEditor((s) => s.workshopLeaving !== null);
	if (!workshop) {
		return null;
	}
	const before = workshop.from.scene.prefabs.find((prefab) => prefab.id === workshop.prefabId);
	const startName = before ? prefabName(before) : newPrefabName(workshop.from.scene.prefabs);
	const world = workshop.from.scene.meta.title;
	const openPanel = () => {
		useEditor.getState().setTab("prefab");
		setSidePaneOpen("right", true);
	};
	return (
		<>
			<FloatingBar
				isCompact
				icon="workshop"
				title={
					<>
						<span className={styles.name}>
							<Input
								ariaLabel="Prefab's name"
								value={workshop.name}
								placeholder={startName}
								onChange={renamePrefabInWorkshop}
							/>
						</span>

						<IconButton
							icon="info"
							label={`The Workshop. ${before ? `Changing ${startName}: every copy in ${world} follows once it's saved.` : `A new prefab for ${world}.`} Build it from shapes, parts and fences in Add to scene; its objects and fences are the prefab. More in its Prefab panel.`}
							onClick={openPanel}
						/>
					</>
				}
				actions={
					<>
						<IconButton
							icon="area"
							label={workshop.showsGround ? "Hide the ground" : "Show the ground"}
							pressed={workshop.showsGround}
							onClick={() => showGroundInWorkshop(!workshop.showsGround)}
						/>

						<Button size="sm" onClick={() => leaveWorkshopFirst()}>
							Leave without saving
						</Button>

						<Button
							size="sm"
							variant="primary"
							icon="check"
							disabled={!hasPieces}
							onClick={saveWorkshop}
						>
							Save the prefab
						</Button>
					</>
				}
			/>

			<ConfirmDialog
				open={isAsking}
				onOpenChange={(open) => {
					if (!open) {
						useEditor.getState().setWorkshopLeaving(null);
					}
				}}
				title="Leave without saving?"
				description={`What you built in the Workshop is left behind, and ${world} stays as it was.`}
				confirmLabel="Leave without saving"
				cancelLabel="Keep building"
				onConfirm={confirmLeavingWorkshop}
				danger
			/>
		</>
	);
};
