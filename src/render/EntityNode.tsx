import { Line } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { memo, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SNAP_STEP, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { clamp, snap, toRadians } from "#/lib/math";
import { isClick, pastDragThreshold } from "#/lib/pointer";
import { getPart, resolveColors, resolveLabelColor, resolveProps } from "#/parts/registry";
import { createPathSampler } from "#/scene/paths";
import { laneOffset, resolveTurns, roadCenterlineOf, turnSmoothing } from "#/scene/roads";
import type { TEntity } from "#/scene/schema";

import { EntityLabel } from "./EntityLabel";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

interface IDragState {
	dx: number;
	dz: number;
	token: string;
	/** Where the press started (screen px); the object stays put until it passes the threshold. */
	from: { clientX: number; clientY: number };
	moving: boolean;
}

export const SelectionFrame = ({
	size: [w, d],
	color,
	dashed = false,
}: {
	size: [number, number];
	color: string;
	dashed?: boolean;
}) => {
	const points = useMemo(() => {
		const hw = w / 2 + 0.3;
		const hd = d / 2 + 0.3;
		const y = 0.07;
		return [
			[-hw, y, -hd],
			[hw, y, -hd],
			[hw, y, hd],
			[-hw, y, hd],
			[-hw, y, -hd],
		] as [number, number, number][];
	}, [w, d]);
	return (
		<Line
			points={points}
			color={color}
			lineWidth={dashed ? 1.5 : 2.5}
			dashed={dashed}
			dashSize={0.3}
			gapSize={0.2}
		/>
	);
};

const UnknownPart = () => {
	return (
		<mesh position={[0, 0.5, 0]}>
			<boxGeometry args={[1, 1, 1]} />

			<meshStandardMaterial color="#e85d75" wireframe />
		</mesh>
	);
};

export const EntityNode = memo(({ entity }: { entity: TEntity }) => {
	const part = getPart(entity.kind);
	const palette = usePalette();
	const mode = useEditor((s) => s.mode);
	const selected = useEditor((s) => s.selectedId === entity.id);
	const playing = useEditor((s) => s.playing);
	const ground = useEditor((s) => s.scene.ground);
	const road = useEditor((s) =>
		entity.follow ? (s.scene.roads.find((r) => r.id === entity.follow?.roadId) ?? null) : null,
	);
	const driving = useEditor((s) => s.scene.driving);
	const sceneTurns = useEditor((s) => s.scene.turns);
	const drawing = useEditor((s) => s.drawing !== null);
	const select = useEditor((s) => s.select);
	const moveEntity = useEditor((s) => s.moveEntity);
	const setDragging = useEditor((s) => s.setDragging);
	const controls = useThree((s) => s.controls) as unknown as {
		enabled: boolean;
	} | null;

	const outer = useRef<THREE.Group>(null);
	const inner = useRef<THREE.Group>(null);
	const drag = useRef<IDragState | null>(null);
	const travelled = useRef(0);
	const [hovered, setHovered] = useState(false);

	const props = useMemo(() => (part ? resolveProps(part, entity.props) : {}), [part, entity.props]);
	// Vehicles face +X, so their length is the footprint's X; smooth turns take about half of it.
	const vehicleLength = part ? part.footprint(props)[0] * entity.scale : 1;
	const turns = resolveTurns(sceneTurns, road?.turns, entity.follow?.turns);
	const sampler = useMemo(
		() =>
			road
				? createPathSampler(roadCenterlineOf(road), road.closed, {
						lane: laneOffset(road, driving),
						smoothing: turnSmoothing(turns, vehicleLength),
					})
				: null,
		[road, driving, turns, vehicleLength],
	);
	const following = Boolean(sampler && entity.follow);

	useFrame((_, delta) => {
		if (!sampler || !entity.follow || !outer.current || !inner.current) {
			return;
		}
		if (playing) {
			travelled.current += Math.min(delta, 0.1) * entity.follow.speed;
		}
		const sample = sampler.at(entity.follow.offset + travelled.current);
		const [x, z] = sample.position;
		outer.current.position.set(x, entity.elevation + sample.height, z);
		// Heading around Y, then nose up/down on slopes (vehicles face +X, so pitch is about Z).
		inner.current.rotation.set(0, sample.heading + toRadians(entity.rotation), sample.pitch);
	});

	const editable = mode === "edit" && !entity.locked && !following;

	const endDrag = (e: ThreeEvent<PointerEvent>) => {
		if (!drag.current) {
			return;
		}
		drag.current = null;
		(e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
		if (controls) {
			controls.enabled = true;
		}
		setDragging(false);
	};

	const handlers = {
		onPointerDown: (e: ThreeEvent<PointerEvent>) => {
			// Only a selected object can be dragged. Pressing anything else leaves the press to the
			// camera (so panning across the scene never grabs a building); a click selects it.
			// While drawing a road, presses pass through to the ground too.
			if (drawing || !selected || !editable || e.nativeEvent.button !== 0) {
				return;
			}
			if (!e.ray.intersectPlane(groundPlane, hit)) {
				return;
			}
			e.stopPropagation();
			drag.current = {
				dx: entity.position[0] - hit.x,
				dz: entity.position[1] - hit.z,
				token: `${entity.id}:${performance.now()}`,
				from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
				moving: false,
			};
			(e.target as unknown as Element).setPointerCapture(e.pointerId);
			if (controls) {
				controls.enabled = false;
			}
			setDragging(true);
		},
		onPointerMove: (e: ThreeEvent<PointerEvent>) => {
			const state = drag.current;
			if (!state) {
				return;
			}
			e.stopPropagation();
			// A click that wobbles a few pixels only selects; it mustn't nudge the object.
			if (!state.moving && !pastDragThreshold(state.from, e.nativeEvent)) {
				return;
			}
			if (!e.ray.intersectPlane(groundPlane, hit)) {
				return;
			}
			if (!state.moving) {
				// Grab from here, not from the press: otherwise the distance already covered
				// snaps the object a cell over the moment the drag starts.
				state.moving = true;
				state.dx = entity.position[0] - hit.x;
				state.dz = entity.position[1] - hit.z;
				return;
			}
			const free = e.nativeEvent.altKey || !useEditor.getState().snapping;
			const place = (v: number) => (free ? v : snap(v, SNAP_STEP));
			const x = clamp(place(hit.x + state.dx), -ground.width / 2, ground.width / 2);
			const z = clamp(place(hit.z + state.dz), -ground.depth / 2, ground.depth / 2);
			if (x === entity.position[0] && z === entity.position[1]) {
				return;
			}
			moveEntity(entity.id, [x, z], { coalesce: `drag:${state.token}` });
		},
		onPointerUp: endDrag,
		onLostPointerCapture: endDrag,
		onClick: (e: ThreeEvent<MouseEvent>) => {
			if (drawing) {
				return;
			}
			// Always stop here: otherwise the click reaches the ground behind, which deselects.
			e.stopPropagation();
			if (!isClick(e)) {
				return;
			}
			select(entity.id);
		},
		onPointerOver: (e: ThreeEvent<PointerEvent>) => {
			// No hover while drawing, or while a new part is dragged in from the palette.
			if (drawing || useEditor.getState().placingKind) {
				return;
			}
			e.stopPropagation();
			setHovered(true);
			document.body.style.cursor = editable && selected ? "grab" : "pointer";
		},
		onPointerOut: () => {
			setHovered(false);
			document.body.style.cursor = "";
		},
	};

	if (!part) {
		return (
			<group position={[entity.position[0], entity.elevation, entity.position[1]]} {...handlers}>
				<UnknownPart />
			</group>
		);
	}

	const { color, accent } = resolveColors(part, entity, palette);
	const footprint = part.footprint(props);
	const anchorY = part.height(props) * entity.scale;
	const Component = part.Component;

	return (
		<group
			ref={outer}
			position={following ? undefined : [entity.position[0], entity.elevation, entity.position[1]]}
		>
			<group
				ref={inner}
				rotation={following ? undefined : [0, toRadians(entity.rotation), 0]}
				scale={entity.scale}
				{...handlers}
			>
				<Component
					props={props}
					color={color}
					accent={accent}
					palette={palette}
					playing={playing}
				/>

				{mode === "edit" && (selected || hovered) && (
					<SelectionFrame size={footprint} color={palette.selection} dashed={!selected} />
				)}
			</group>

			{entity.label?.enabled && (
				<EntityLabel
					entity={entity}
					anchorY={anchorY}
					color={resolveLabelColor(part, entity, palette)}
				/>
			)}
		</group>
	);
});
