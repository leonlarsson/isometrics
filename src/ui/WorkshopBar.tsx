import { useEditor } from "#/editor/store";
import { workshopOf } from "#/editor/whatIsOpen";
import {
	confirmLeavingWorkshop,
	leaveWorkshopFirst,
	newPrefabName,
	renamePrefabInWorkshop,
	saveWorkshop,
	workshopHasPieces,
} from "#/editor/workshop";
import { prefabName } from "#/parts/prefabParts";

import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { FloatingBar, FloatingBarNote } from "./FloatingBar";
import { resetToDefault, TextField } from "./fields";

import styles from "./WorkshopBar.module.css";

/**
 * The Workshop's bar over the view (ADR-0134): the prefab's name, Save the
 * prefab (back to the world, which keeps it, as one undo step) and Leave
 * without saving. Leaving with something built is asked here first, whatever
 * asked to leave (this bar, New world, Open file, a recent world…:
 * `leaveWorkshopFirst`). What's built here of objects and fences is the
 * prefab; the rest of this world is the world's.
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
	return (
		<>
			<FloatingBar
				icon="workshop"
				title={before ? `The Workshop: changing ${startName}` : "The Workshop: a new prefab"}
				actions={
					<>
						<Button onClick={() => leaveWorkshopFirst()}>Leave without saving</Button>

						<Button variant="primary" icon="check" disabled={!hasPieces} onClick={saveWorkshop}>
							Save the prefab
						</Button>
					</>
				}
			>
				<div className={styles.name}>
					<TextField
						label="Prefab's name"
						value={workshop.name}
						placeholder={startName}
						onChange={renamePrefabInWorkshop}
						inherit={resetToDefault(workshop.name, startName, () =>
							renamePrefabInWorkshop(startName),
						)}
					/>
				</div>

				<span>
					{before
						? `Its objects and fences are here: change them, and every copy in ${world} follows once it's saved.`
						: `Build it from shapes, parts and fences in Add to scene. It's kept in ${world} once it's saved.`}
				</span>

				{!hasPieces && (
					<FloatingBarNote>Nothing to save yet: add an object or a fence first.</FloatingBarNote>
				)}
			</FloatingBar>

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
