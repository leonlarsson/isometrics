import { useEditor } from "#/editor/store";
import { workshopOf } from "#/editor/whatIsOpen";
import {
	boundsOf,
	describePrefabInWorkshop,
	newPrefabName,
	renamePrefabInWorkshop,
	showGroundInWorkshop,
	workshopHasPieces,
} from "#/editor/workshop";
import { round } from "#/lib/math";
import { measurePrefab, prefabName } from "#/parts/prefabParts";
import { isPrefabKind } from "#/scene/schema";

import { Hint, resetToDefault, Section, SwitchField, TextField } from "./fields";

/**
 * The properties' Prefab tab in the Workshop (ADR-0134), in place of the
 * world's tabs: the prefab's name and description, how big it is, and
 * whether the ground shows under it. The world's light, sky, data and
 * viewpoints aren't the prefab's, so they aren't here.
 */
export const WorkshopPrefabTab = () => {
	const workshop = useEditor((s) => workshopOf(s.whatIsOpen));
	const entities = useEditor((s) => s.scene.entities);
	const fences = useEditor((s) => s.scene.fences);
	if (!workshop) {
		return null;
	}
	const before = workshop.from.scene.prefabs.find((prefab) => prefab.id === workshop.prefabId);
	const startName = before ? prefabName(before) : newPrefabName(workshop.from.scene.prefabs);
	const pieces = { entities: entities.filter((entity) => !isPrefabKind(entity.kind)), fences };
	const hasPieces = workshopHasPieces({ entities, fences });
	const box = boundsOf(pieces)?.box;
	const { height } = measurePrefab(pieces);
	const size = box
		? `${round(box.maxX - box.minX, 1)} × ${round(box.maxZ - box.minZ, 1)} wide, ${round(height, 1)} tall`
		: "Nothing built yet";

	return (
		<>
			<Section icon="prefab" title="Prefab" keywords="workshop name description size">
				<TextField
					label="Name"
					value={workshop.name}
					placeholder={startName}
					onChange={renamePrefabInWorkshop}
					inherit={resetToDefault(workshop.name, startName, () =>
						renamePrefabInWorkshop(startName),
					)}
				/>

				<TextField
					label="Description"
					value={workshop.description}
					placeholder="What it is, in a line"
					multiline
					rows={2}
					onChange={describePrefabInWorkshop}
					inherit={resetToDefault(
						workshop.description,
						before?.description ?? "",
						() => describePrefabInWorkshop(before?.description ?? ""),
						before?.description ? undefined : "none",
					)}
				/>

				<Hint>{`Size: ${size}. Its middle is where a copy stands, its front faces the arrow.`}</Hint>
			</Section>

			<Section id="workshop.studio" icon="workshop" title="Studio" keywords="ground backdrop">
				<SwitchField
					label="Show the ground"
					checked={workshop.showsGround}
					onChange={showGroundInWorkshop}
					inherit={resetToDefault(workshop.showsGround, false, () => showGroundInWorkshop(false))}
				/>

				<Hint>
					{hasPieces
						? "Build with Add to scene: its objects and fences are the prefab. The world's light, sky, data and viewpoints stay the world's. Save the prefab or Leave without saving from the bar at the top."
						: "Nothing to save yet: add shapes, parts or fences from Add to scene. Its objects and fences are the prefab."}
				</Hint>
			</Section>
		</>
	);
};
