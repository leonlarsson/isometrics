import { Grid, RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useState } from "react";
import * as THREE from "three";

import { drawnModeOf, isToggleClick, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { tintColor } from "#/lib/color";
import { isClick } from "#/lib/pointer";

import { pixelsPerUnitAt } from "./cameraMath";
import { openGroundMenuOnClick } from "./contextMenu";

/** The grid's cell sizes, finest first; each section line marks 5 cells. */
const GRID_CELLS = [1, 5, 25, 125];
/** Grid lines are never closer than this on screen (px); zoomed further out, the cells get bigger. */
const MIN_CELL_PIXELS = 6;

const origin = new THREE.Vector3();

/**
 * The grid cell size for the current zoom: 1 unit up close, then 5, 25 and 125
 * as the view zooms out, so the lines stay apart. Finer lines than a few
 * pixels turn into a moiré (or vanish) on a big ground.
 */
const useGridCell = () => {
	const [cell, setCell] = useState(GRID_CELLS[0]);
	const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
	useFrame(({ camera, size }) => {
		const pixels = pixelsPerUnitAt(camera, controls?.target ?? origin, size.height);
		const next = GRID_CELLS.find((step) => step * pixels >= MIN_CELL_PIXELS) ?? GRID_CELLS.at(-1);
		if (next !== undefined && next !== cell) {
			setCell(next);
		}
	});
	return cell;
};

export const Ground = () => {
	const ground = useEditor((s) => s.scene.ground);
	const mode = useEditor(drawnModeOf);
	const clearSelection = useEditor((s) => s.clearSelection);
	const palette = usePalette();
	const cell = useGridCell();

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
					// Shift or Ctrl, which add to the selection, leave it as it is.
					if (!isToggleClick(e.nativeEvent)) {
						clearSelection();
					}
				}}
				onContextMenu={openGroundMenuOnClick}
			>
				{/*
					Pushed back in the depth test, so the grid and flat areas lying a hair above it always
					win: over a big ground, depth rounding exceeds that gap and they'd vanish in patches.
				*/}
				<meshStandardMaterial
					color={ground.color ?? palette.ground}
					roughness={0.95}
					polygonOffset
					polygonOffsetFactor={1}
					polygonOffsetUnits={600}
				/>
			</RoundedBox>

			{mode === "edit" && (
				<Grid
					args={[ground.width, ground.depth]}
					position={[0, 0.004, 0]}
					cellSize={cell}
					sectionSize={cell * 5}
					cellThickness={0.6}
					sectionThickness={1}
					// Darkened at night: the grid isn't lit, so it would glare on a dark world.
					cellColor={tintColor(palette.gridCell, "#000000", palette.night * 0.75)}
					sectionColor={tintColor(palette.gridSection, "#000000", palette.night * 0.7)}
					// Never fades: a big ground reaches further from the camera than any fixed distance.
					fadeDistance={100_000}
					fadeStrength={0}
					followCamera={false}
					infiniteGrid={false}
				/>
			)}
		</group>
	);
};
