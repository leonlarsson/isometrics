import { Html, Line } from "@react-three/drei";

import { drawnModeOf, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { workshopOf } from "#/editor/whatIsOpen";
import { boundsOf } from "#/editor/workshop";
import { isPrefabKind } from "#/scene/schema";

import styles from "./WorkshopMarker.module.css";

/** Just above the ground, under the pieces' selection frames. */
const LIFT = 0.03;
/** How far round the pieces the footprint's outline runs. */
const MARGIN = 0.25;
/** The footprint shown while nothing is built yet. */
const EMPTY_HALF = 1;

type TPoint = [number, number, number];

/**
 * In the Workshop (ADR-0134): where the prefab's base and front are. A dashed
 * outline round what's built (its footprint, as copies will have it), a cross
 * at its middle (the prefab's origin, where a copy stands), and an arrow off
 * its front side, the way copies face (+z), marked Front. It follows what's
 * built as it changes: saving centres the prefab on that middle.
 */
export const WorkshopMarker = () => {
	const isOpen = useEditor((s) => workshopOf(s.whatIsOpen) !== null && drawnModeOf(s) === "edit");
	const entities = useEditor((s) => s.scene.entities);
	const fences = useEditor((s) => s.scene.fences);
	const palette = usePalette();
	if (!isOpen) {
		return null;
	}
	const bounds = boundsOf({
		entities: entities.filter((entity) => !isPrefabKind(entity.kind)),
		fences,
	});
	const box = bounds?.box ?? {
		minX: -EMPTY_HALF,
		maxX: EMPTY_HALF,
		minZ: -EMPTY_HALF,
		maxZ: EMPTY_HALF,
	};
	const minX = box.minX - MARGIN;
	const maxX = box.maxX + MARGIN;
	const minZ = box.minZ - MARGIN;
	const maxZ = box.maxZ + MARGIN;
	const x = (minX + maxX) / 2;
	const z = (minZ + maxZ) / 2;
	const cross = Math.min(0.5, (maxX - minX) / 4, (maxZ - minZ) / 4);
	const outline: TPoint[] = [
		[minX, LIFT, minZ],
		[maxX, LIFT, minZ],
		[maxX, LIFT, maxZ],
		[minX, LIFT, maxZ],
		[minX, LIFT, minZ],
	];
	// Long enough to read at any size of prefab.
	const tip = maxZ + Math.max(1.6, (maxZ - minZ) * 0.45);
	return (
		<group>
			<Line
				points={outline}
				color={palette.gridSection}
				lineWidth={1.5}
				dashed
				dashSize={0.25}
				gapSize={0.18}
			/>

			<Line
				points={[
					[x - cross, LIFT, z],
					[x + cross, LIFT, z],
				]}
				color={palette.gridSection}
				lineWidth={1.5}
			/>

			<Line
				points={[
					[x, LIFT, z - cross],
					[x, LIFT, z + cross],
				]}
				color={palette.gridSection}
				lineWidth={1.5}
			/>

			{/* The front: an arrow off the side copies face (+z). */}
			<Line
				points={[
					[x, LIFT, maxZ + 0.25],
					[x, LIFT, tip],
					[x - 0.3, LIFT, tip - 0.35],
					[x, LIFT, tip],
					[x + 0.3, LIFT, tip - 0.35],
				]}
				color={palette.selection}
				lineWidth={3}
			/>

			<Html position={[x, LIFT, tip + 0.9]} center zIndexRange={[1, 0]}>
				<span className={styles.front}>Front</span>
			</Html>
		</group>
	);
};
