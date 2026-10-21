import { Line } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { memo, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SNAP_STEP, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { clamp, snap, toRadians } from "#/lib/math";
import { getPart, resolveColors, resolveLabelColor, resolveProps } from "#/parts/registry";
import { createPathSampler } from "#/scene/paths";
import type { TEntity } from "#/scene/schema";

import { EntityLabel } from "./EntityLabel";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

interface IDragState {
	dx: number;
	dz: number;
	token: string;
}

const SelectionFrame = ({
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
	const path = useEditor((s) =>
		entity.follow ? (s.scene.paths.find((p) => p.id === entity.follow?.pathId) ?? null) : null,
	);
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
	const sampler = useMemo(
		() => (path ? createPathSampler(path.points, path.closed) : null),
		[path],
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
		outer.current.position.set(sample.position[0], entity.elevation, sample.position[1]);
		inner.current.rotation.y = sample.heading + toRadians(entity.rotation);
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
			if (mode !== "edit" || e.nativeEvent.button !== 0) {
				return;
			}
			e.stopPropagation();
			select(entity.id);
			if (!editable || !e.ray.intersectPlane(groundPlane, hit)) {
				return;
			}
			drag.current = {
				dx: entity.position[0] - hit.x,
				dz: entity.position[1] - hit.z,
				token: `${entity.id}:${performance.now()}`,
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
			if (!e.ray.intersectPlane(groundPlane, hit)) {
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
			if (mode !== "view" || e.delta > 5) {
				return;
			}
			e.stopPropagation();
			select(entity.id);
		},
		onPointerOver: (e: ThreeEvent<PointerEvent>) => {
			e.stopPropagation();
			setHovered(true);
			document.body.style.cursor = editable ? "grab" : "pointer";
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
