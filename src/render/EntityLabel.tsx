import { drawnModeOf, useEditor } from "#/editor/store";
import type { TEntity } from "#/scene/schema";

import { registerLabelAnchor, registerLabelPin } from "./labelRegistry";

type TV3 = [number, number, number];

interface IEntityLabelProps {
	entity: TEntity;
	anchorY: number;
	color: string;
}

/**
 * The 3D half of a label: the pin dot and an invisible anchor where the card
 * would like to sit. The card and its dashed leader line are DOM (ui/LabelLayer),
 * placed by LabelProjector, which may move the card aside so cards don't overlap.
 */
export const EntityLabel = ({ entity, anchorY, color }: IEntityLabelProps) => {
	// The pin shows where its card does (ui/LabelLayer): not in View mode when the world hides its
	// cards, nor in a picture without them (ADR-0084); Edit mode shows them, faded.
	const pinHidden = useEditor((s) =>
		s.stillRender
			? !s.stillRender.showsCards
			: drawnModeOf(s) === "view" && !s.scene.onScreen.showsLabelCards,
	);
	const label = entity.label;
	if (!label) {
		return null;
	}

	const anchor: TV3 = [0, anchorY, 0];
	const card: TV3 = [label.offset[0], anchorY + label.offset[1], label.offset[2]];

	return (
		<group>
			<mesh
				position={anchor}
				visible={!pinHidden}
				ref={(object) => registerLabelPin(entity.id, object)}
			>
				<sphereGeometry args={[0.13, 16, 16]} />

				<meshBasicMaterial color={color} />
			</mesh>

			<group position={card} ref={(object) => registerLabelAnchor(entity.id, object)} />
		</group>
	);
};
