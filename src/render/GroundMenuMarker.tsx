import { Line } from "@react-three/drei";

import { spotOnGrid, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";

/** Just above the ground and areas (areas start at 0.004), under roads' edges. */
const LIFT = 0.03;
const RING = { inner: 0.42, outer: 0.58 };
/** Half the length of each arm of the cross. */
const ARM = 1.2;

/**
 * A crosshair on the ground while its context menu is open (ui/GroundContextMenu),
 * on the spot where "Add here" and "Draw … from here" would start: the clicked
 * point, on the grid while snapping is on.
 */
export const GroundMenuMarker = () => {
	const point = useEditor((s) => s.groundMenu?.point ?? null);
	const snapping = useEditor((s) => s.snapping);
	const palette = usePalette();
	if (!point) {
		return null;
	}
	const [x, z] = spotOnGrid(point, snapping);

	return (
		<group position={[x, LIFT, z]}>
			<mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
				<ringGeometry args={[RING.inner, RING.outer, 32]} />

				<meshBasicMaterial color={palette.selection} depthTest={false} transparent />
			</mesh>

			<Line
				points={[
					[-ARM, 0, 0],
					[ARM, 0, 0],
				]}
				color={palette.selection}
				lineWidth={2}
				depthTest={false}
				renderOrder={1}
			/>

			<Line
				points={[
					[0, 0, -ARM],
					[0, 0, ARM],
				]}
				color={palette.selection}
				lineWidth={2}
				depthTest={false}
				renderOrder={1}
			/>
		</group>
	);
};
