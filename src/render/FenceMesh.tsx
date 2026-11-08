import { Line } from "@react-three/drei";
import { type ThreeElements, type ThreeEvent, useFrame } from "@react-three/fiber";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { drawnModeOf, isItemBoxed, isItemSelected, isToggleClick, useEditor } from "#/editor/store";
import { useThemePalette } from "#/editor/useTheme";
import { useWorldData } from "#/editor/worldData";
import { createFenceBuilder } from "#/fences/builder";
import {
	buildFence,
	builtShareOf,
	fenceHeightOf,
	gateIsOpen,
	layoutOfFence,
	resolveFenceColors,
} from "#/fences/fenceModel";
import { buildSwingingLeaf, gateLeavesOf, type IFenceGateLook } from "#/fences/gates";
import { FENCE_STYLES } from "#/fences/registry";
import { prefersLessMotion } from "#/lib/lessMotion";
import { isClick } from "#/lib/pointer";
import type { IFenceGatePlace } from "#/scene/fences";
import type { TArea, TDataValue, TFence, TFenceGate, TGround } from "#/scene/schema";
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
	/** The ground it stands on: the areas, and the grounds under them (ADR-0155). */
	areas: readonly TArea[];
	grounds: readonly TGround[];
	data: readonly TDataValue[];
	/** Outlined as the selection. */
	selected: boolean;
	handlers?: TFenceHandlers;
	/**
	 * Its swinging gates turn open or shut over half a second when that changes (the editor's
	 * view, ADR-0133); left out, as in pictures, they are drawn as they end.
	 */
	swingsGates?: boolean;
}

/** How long a gate takes to swing all the way open or shut, in seconds. */
const SWING_SECONDS = 0.5;
/** The longest step a swing takes in one frame, so a frame after a pause doesn't skip it. */
const LONGEST_STEP = 0.1;

/** A gate swinging (ADR-0133): which, and from and to how open (0 shut, 1 open). */
interface IGateSwing {
	index: number;
	from: number;
	to: number;
}

/** Each gate as a letter: s = a swinging gate shut, o = open, g = a gap. */
const gateStatesOf = (fence: TFence, data: readonly TDataValue[]) =>
	fence.gates
		.map((gate) => (gate.kind === "gap" ? "g" : gateIsOpen(gate, data) ? "o" : "s"))
		.join("");

/**
 * The fence's gates swinging now: a swing starts when a swinging gate opens or
 * shuts (by hand, from data or undone), from where it is if it was already
 * swinging, and ends when it gets there (`ended`). Nothing swings while
 * `swings` is off, for a viewer who prefers less motion, or when gates are
 * added or taken out.
 */
const useGateSwings = (states: string, swings: boolean) => {
	const [seen, setSeen] = useState(states);
	const [swinging, setSwinging] = useState<readonly IGateSwing[]>([]);
	// How open each swinging gate is now, kept by its swing every frame.
	const openness = useRef(new Map<number, number>());
	// Worked out while rendering (React's way of adjusting state to a changed prop), so the fence
	// isn't built once with the gate where it ends and again without it.
	if (seen !== states) {
		setSeen(states);
		const next: IGateSwing[] = [];
		if (swings && seen.length === states.length && !prefersLessMotion()) {
			for (let i = 0; i < states.length; i++) {
				const [was, now] = [seen[i], states[i]];
				const ongoing = swinging.find((swing) => swing.index === i);
				if (was === now) {
					if (ongoing) {
						next.push(ongoing);
					}
				} else if (was !== "g" && now !== "g") {
					next.push({
						index: i,
						from: ongoing ? (openness.current.get(i) ?? ongoing.from) : was === "o" ? 1 : 0,
						to: now === "o" ? 1 : 0,
					});
				}
			}
		}
		setSwinging(next);
	}
	const ended = useCallback((ending: IGateSwing) => {
		openness.current.delete(ending.index);
		setSwinging((all) => all.filter((swing) => swing !== ending));
	}, []);
	return { swinging, openness: openness.current, ended };
};

interface IFencePieceProps {
	geometry: THREE.BufferGeometry;
	color: string;
	transparency: number;
}

/** One of a fence's colours, drawn. */
const FencePiece = ({ geometry, color, transparency }: IFencePieceProps) => {
	const seeThrough = transparency > 0;
	return (
		<mesh geometry={geometry} castShadow={!seeThrough} receiveShadow>
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
};

type TFenceColors = ReturnType<typeof resolveFenceColors>;

const colorOf = (colors: TFenceColors, id: string) =>
	colors[id] ?? { color: "#999999", transparency: 0 };

interface IGateSwingProps {
	swing: IGateSwing;
	place: IFenceGatePlace;
	gate: TFenceGate;
	look: IFenceGateLook;
	height: number;
	colors: TFenceColors;
	/** How open swinging gates are now, by index: kept up to date here every frame. */
	openness: Map<number, number>;
	ended: (swing: IGateSwing) => void;
}

/**
 * A gate swinging open or shut (ADR-0133): its leaves on their own, each
 * turned about its hinge every frame until it gets there, while the fence has
 * a gap there. Mounted only while it swings, so a gate standing still costs
 * no work a frame. Fences aren't batched with objects (ADR-0086), so nothing
 * needs telling that these move.
 */
const GateSwing = ({
	swing,
	place,
	gate,
	look,
	height,
	colors,
	openness,
	ended,
}: IGateSwingProps) => {
	const { opensToTheLeft, hasTwoLeaves } = gate;
	const leaves = useMemo(
		() =>
			gateLeavesOf(place, { opensToTheLeft, hasTwoLeaves }, look).map((leaf) => {
				const builder = createFenceBuilder();
				buildSwingingLeaf(builder, leaf, look, height);
				return { leaf, geometries: builder.geometries() };
			}),
		[place, opensToTheLeft, hasTwoLeaves, look, height],
	);
	useLayoutEffect(
		() => () => {
			for (const { geometries } of leaves) {
				for (const geometry of geometries.values()) {
					geometry.dispose();
				}
			}
		},
		[leaves],
	);

	const hinges = useRef<(THREE.Group | null)[]>([]);
	const progress = useRef(0);
	const now = useRef(swing.from);
	const done = useRef(false);
	const turnTo = (open: number) => {
		leaves.forEach(({ leaf }, i) => {
			const hinge = hinges.current[i];
			if (hinge) {
				hinge.rotation.y = leaf.openTurn * open;
			}
		});
	};
	useLayoutEffect(() => {
		openness.set(swing.index, swing.from);
	}, []);
	// Where it is, before the first frame and whenever its leaves are rebuilt (set here, not as a
	// prop, so a re-render can't turn it back).
	useLayoutEffect(() => turnTo(now.current), [leaves]);
	useFrame((_, delta) => {
		if (done.current) {
			return;
		}
		const way = Math.abs(swing.to - swing.from);
		const step = Math.min(delta, LONGEST_STEP) / (SWING_SECONDS * Math.max(way, 1e-6));
		progress.current = Math.min(1, progress.current + step);
		const t = progress.current;
		const open = swing.from + (swing.to - swing.from) * t * t * (3 - 2 * t);
		now.current = open;
		openness.set(swing.index, open);
		turnTo(open);
		if (t >= 1) {
			done.current = true;
			ended(swing);
		}
	});

	return (
		<group>
			{leaves.map(({ leaf, geometries }, i) => (
				<group
					// biome-ignore lint/suspicious/noArrayIndexKey: a gate's one or two leaves, in order
					key={i}
					position={leaf.hinge}
					ref={(group) => {
						hinges.current[i] = group;
					}}
				>
					{[...geometries].map(([id, geometry]) => (
						<FencePiece key={id} geometry={geometry} {...colorOf(colors, id)} />
					))}
				</group>
			))}
		</group>
	);
};

/**
 * How a fence looks, from its settings alone (ADR-0103): one mesh per colour,
 * rebuilt only when its shape, the ground or how much is built changes, or a
 * gate opens or shuts. The editor's FenceMesh adds the selection, clicks and
 * gates swinging; world pictures (scenePictures) use it as it is.
 */
export const FenceBody = ({
	fence,
	palette,
	areas,
	grounds,
	data,
	selected,
	handlers,
	swingsGates = false,
}: IFenceBodyProps) => {
	// Data only rebuilds it when it changes how much is built, or opens or shuts a gate.
	const built = builtShareOf(fence, data);
	const gateStates = gateStatesOf(fence, data);
	const { swinging, openness, ended } = useGateSwings(gateStates, swingsGates);
	const line = useMemo(
		() => ({
			...fence,
			builtShare: built,
			data: {},
			gates: fence.gates.map((gate) => ({ ...gate, data: {} })),
		}),
		[fence, built],
	);
	const layout = useMemo(() => layoutOfFence(line, { areas, grounds }, []), [line, areas, grounds]);
	// A gate swinging is drawn on its own (GateSwing), and the fence has a gap there meanwhile.
	const placed = swinging.flatMap((swing) => {
		const place = layout.gates.find((each) => each.index === swing.index);
		return place ? [{ swing, place }] : [];
	});
	const apartNow = placed.map(({ swing }) => swing.index).join(",");
	const shape = useMemo(() => {
		const apart = new Set(apartNow.split(",").filter(Boolean).map(Number));
		return {
			...line,
			gates: line.gates.map((gate, i) => ({
				...gate,
				kind: apart.has(i) ? ("gap" as const) : gate.kind,
				isOpen: gateStates[i] !== "s",
			})),
		};
	}, [line, gateStates, apartNow]);
	const geometries = useMemo(
		() => buildFence(shape, { areas, grounds }, []),
		[shape, areas, grounds],
	);
	useLayoutEffect(
		() => () => {
			for (const geometry of geometries.values()) {
				geometry.dispose();
			}
		},
		[geometries],
	);
	// A swing of a gate that isn't built has nothing to draw: it ends at once.
	useEffect(() => {
		for (const swing of swinging) {
			if (!layout.gates.some((each) => each.index === swing.index)) {
				ended(swing);
			}
		}
	}, [swinging, layout]);

	// An invisible band along it takes the clicks, and only it: three's raycasting doesn't skip what
	// isn't drawn, and a few faces a span are far quicker to test the pointer against than every picket.
	const height = fenceHeightOf(fence);
	const hit = useMemo(() => {
		if (!handlers) {
			return null;
		}
		const builder = createFenceBuilder();
		// Its gates take clicks too, shut or open, across their opening.
		for (const span of [...layout.spans, ...layout.gates]) {
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
		if (
			fence.loops &&
			points.length > 2 &&
			layout.spans.length + layout.gates.length === points.length
		) {
			points.push(points[0]);
		}
		return points;
	}, [layout, height, fence.loops]);

	const colors = resolveFenceColors(fence, palette, data);

	return (
		<group>
			{[...geometries].map(([id, geometry]) => (
				<FencePiece key={id} geometry={geometry} {...colorOf(colors, id)} />
			))}

			{placed.map(({ swing, place }) => (
				<GateSwing
					key={`${swing.index}:${swing.to}`}
					swing={swing}
					place={place}
					gate={fence.gates[swing.index]}
					look={FENCE_STYLES[fence.kind].gate}
					height={height}
					colors={colors}
					openness={openness}
					ended={ended}
				/>
			))}

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

/** A fence in the editor: selectable while editing, its gates swinging open and shut. */
export const FenceMesh = memo(({ fence }: { fence: TFence }) => {
	// The theme's colours: a fence doesn't change as it gets dark.
	const palette = useThemePalette();
	const mode = useEditor(drawnModeOf);
	const areas = useEditor((s) => s.scene.areas);
	const grounds = useEditor((s) => s.scene.grounds);
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
			grounds={grounds}
			data={data}
			selected={selected && mode === "edit"}
			handlers={handlers}
			swingsGates
		/>
	);
});
