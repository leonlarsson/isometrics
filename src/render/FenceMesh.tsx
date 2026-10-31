import { Line } from "@react-three/drei";
import type { ThreeElements, ThreeEvent } from "@react-three/fiber";
import { memo, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { drawnModeOf, isItemBoxed, isItemSelected, isToggleClick, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { createFenceBuilder } from "#/fences/builder";
import {
	buildFence,
	builtShareOf,
	fenceHeightOf,
	layoutOfFence,
	resolveFenceColors,
} from "#/fences/fenceModel";
import { isClick } from "#/lib/pointer";
import type { TArea, TDataValue, TFence } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { openContextMenuOnClick } from "./contextMenu";
import { setViewCursor } from "./viewCursor";

type TFenceHandlers = Pick<
	ThreeElements["mesh"],
	"onClick" | "onPointerOver" | "onPointerOut" | "onContextMenu"
>;

/**
 * The invisible band that takes a fence's clicks: this thick round its line, so thin pickets are
 * easy to hit, and a little taller than the fence, for its caps and leafy tops.
 */
const HIT_THICKNESS = 0.35;
const HIT_TALLER = 1.12;
/** The selection outline runs this far above the fence's top. */
const OUTLINE_LIFT = 0.04;

interface IFenceBodyProps {
	fence: TFence;
	palette: IScenePalette;
	/** The ground it stands on. */
	areas: readonly TArea[];
	data: readonly TDataValue[];
	/** Outlined as the selection. */
	selected: boolean;
	handlers?: TFenceHandlers;
}

/**
 * How a fence looks, from its settings alone (ADR-0103): one mesh per colour,
 * rebuilt only when its shape, the ground or how much is built changes. The
 * editor's FenceMesh adds the selection and clicks; world pictures
 * (scenePictures) use it as it is.
 */
export const FenceBody = ({ fence, palette, areas, data, selected, handlers }: IFenceBodyProps) => {
	// Data only rebuilds it when it changes how much is built.
	const built = builtShareOf(fence, data);
	const shape = useMemo(() => ({ ...fence, builtShare: built, data: {} }), [fence, built]);
	const geometries = useMemo(() => buildFence(shape, areas, []), [shape, areas]);
	useLayoutEffect(
		() => () => {
			for (const geometry of geometries.values()) {
				geometry.dispose();
			}
		},
		[geometries],
	);

	// An invisible band along it takes the clicks, and only it: three's raycasting doesn't skip what
	// isn't drawn, and a few faces a span are far quicker to test the pointer against than every picket.
	const layout = useMemo(() => layoutOfFence(shape, areas, []), [shape, areas]);
	const height = fenceHeightOf(fence);
	const hit = useMemo(() => {
		if (!handlers) {
			return null;
		}
		const builder = createFenceBuilder();
		for (const span of layout.spans) {
			builder.beam(span, {
				color: "hit",
				bottom: 0,
				top: height * HIT_TALLER,
				thickness: HIT_THICKNESS,
			});
		}
		return builder.geometries().get("hit") ?? null;
	}, [layout, height, handlers]);
	useLayoutEffect(() => () => hit?.dispose(), [hit]);

	const outline = useMemo(() => {
		const points = layout.posts.map(
			(post) =>
				[post.x, Math.max(post.baseBefore, post.baseAfter) + height + OUTLINE_LIFT, post.z] as [
					number,
					number,
					number,
				],
		);
		if (fence.loops && points.length > 2 && layout.spans.length === points.length) {
			points.push(points[0]);
		}
		return points;
	}, [layout, height, fence.loops]);

	const colors = resolveFenceColors(fence, palette, data);

	return (
		<group>
			{[...geometries].map(([id, geometry]) => {
				const { color, transparency } = colors[id] ?? { color: "#999999", transparency: 0 };
				const seeThrough = transparency > 0;
				return (
					<mesh key={id} geometry={geometry} castShadow={!seeThrough} receiveShadow>
						<meshStandardMaterial
							color={color}
							roughness={0.85}
							transparent={seeThrough}
							opacity={1 - transparency}
							depthWrite={!seeThrough}
							side={seeThrough ? THREE.DoubleSide : THREE.FrontSide}
						/>
					</mesh>
				);
			})}

			{hit && (
				<mesh geometry={hit} visible={false} {...handlers}>
					<meshBasicMaterial />
				</mesh>
			)}

			{selected && outline.length > 1 && (
				<Line points={outline} color={palette.selection} lineWidth={3} />
			)}
		</group>
	);
};

/** A fence in the editor: selectable while editing. */
export const FenceMesh = memo(({ fence }: { fence: TFence }) => {
	const palette = usePalette();
	const mode = useEditor(drawnModeOf);
	const areas = useEditor((s) => s.scene.areas);
	const data = useWorldData().values;
	// A box being drawn that would take it out of the selection shows it dashed instead (HoverHighlight).
	const selected = useEditor(
		(s) =>
			isItemSelected(s, "fence", fence.id) &&
			!(s.boxDrag?.removing && isItemBoxed(s, "fence", fence.id)),
	);
	const drawing = useEditor((s) => s.drawing !== null);

	const editable = mode === "edit" && !drawing;
	const handlers = useMemo<TFenceHandlers | undefined>(
		() =>
			editable
				? {
						onClick: (e: ThreeEvent<MouseEvent>) => {
							// Stop here so the ground behind doesn't deselect, even after a camera drag.
							e.stopPropagation();
							if (!isClick(e)) {
								return;
							}
							if (isToggleClick(e.nativeEvent)) {
								useEditor.getState().toggleSelected({ kind: "fence", id: fence.id });
							} else {
								useEditor.getState().selectFence(fence.id);
							}
						},
						onPointerOver: (e: ThreeEvent<PointerEvent>) => {
							e.stopPropagation();
							setViewCursor("pointer");
						},
						onPointerOut: () => {
							setViewCursor("");
						},
						onContextMenu: openContextMenuOnClick({ kind: "fence", id: fence.id }),
					}
				: undefined,
		[editable, fence.id],
	);

	return (
		<FenceBody
			fence={fence}
			palette={palette}
			areas={areas}
			data={data}
			selected={selected && mode === "edit"}
			handlers={handlers}
		/>
	);
});
