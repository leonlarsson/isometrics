import { Grid, RoundedBox } from "@react-three/drei";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { isClick } from "#/lib/pointer";

import { openGroundMenuOnClick } from "./contextMenu";

export const Ground = () => {
	const ground = useEditor((s) => s.scene.ground);
	const mode = useEditor((s) => s.mode);
	const clearSelection = useEditor((s) => s.clearSelection);
	const palette = usePalette();

	return (
		<group>
			<RoundedBox
				args={[ground.width, 1, ground.depth]}
				radius={0.45}
				smoothness={4}
				position={[0, -0.5, 0]}
				receiveShadow
				onClick={(e) => {
					if (!isClick(e)) {
						return;
					}
					e.stopPropagation();
					clearSelection();
				}}
				onContextMenu={openGroundMenuOnClick}
			>
				<meshStandardMaterial color={ground.color ?? palette.ground} roughness={0.95} />
			</RoundedBox>

			{mode === "edit" && (
				<Grid
					args={[ground.width, ground.depth]}
					position={[0, 0.004, 0]}
					cellSize={1}
					sectionSize={5}
					cellThickness={0.6}
					sectionThickness={1}
					cellColor={palette.gridCell}
					sectionColor={palette.gridSection}
					fadeDistance={1000}
					fadeStrength={0}
					followCamera={false}
					infiniteGrid={false}
				/>
			)}
		</group>
	);
};
