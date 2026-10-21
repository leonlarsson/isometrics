import { Line } from "@react-three/drei";

import type { TEntity } from "#/scene/schema";

import { registerLabelAnchor } from "./labelRegistry";

type TV3 = [number, number, number];

interface IEntityLabelProps {
	entity: TEntity;
	anchorY: number;
	color: string;
}

/**
 * The 3D half of a label: pin dot, dashed leader line, and an invisible anchor
 * at the card position. The card itself is DOM, rendered by ui/LabelLayer.
 */
export const EntityLabel = ({ entity, anchorY, color }: IEntityLabelProps) => {
	const label = entity.label;
	if (!label) {
		return null;
	}

	const anchor: TV3 = [0, anchorY, 0];
	const card: TV3 = [label.offset[0], anchorY + label.offset[1], label.offset[2]];

	return (
		<group>
			<mesh position={anchor}>
				<sphereGeometry args={[0.13, 16, 16]} />

				<meshBasicMaterial color={color} />
			</mesh>

			<Line
				points={[anchor, card]}
				color={color}
				lineWidth={1.6}
				dashed
				dashSize={0.22}
				gapSize={0.16}
			/>

			<group position={card} ref={(object) => registerLabelAnchor(entity.id, object)} />
		</group>
	);
};
