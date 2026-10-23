import { Line } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SNAP_STEP, useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { clamp, DEG2RAD, normalizeDegrees, round, snap, toRadians } from "#/lib/math";
import { isClick, pastDragThreshold } from "#/lib/pointer";
import { getPart, resolveColors, resolveLabelColor, resolveProps } from "#/parts/registry";
import { laneOffset, resolveTurns, turnSmoothing } from "#/scene/roads";
import { createRouteSampler } from "#/scene/routes";
import type { TEntity, TVec2 } from "#/scene/schema";

import { openContextMenuOnClick } from "./contextMenu";
import { EntityGizmo } from "./EntityGizmo";
import { EntityLabel } from "./EntityLabel";
import { createVehicleRouteDrag, type IVehicleRouteDrag, livePoses } from "./routeDrop";
import { drivingVehicles, type IDrivingVehicle } from "./traffic";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();

interface IDragState {
	dx: number;
	dz: number;
	token: string;
	/** Where the press started (screen px); the object stays put until it passes the threshold. */
	from: { clientX: number; clientY: number };
	moving: boolean;
	/** Snaps a vehicle onto roads it's dragged over. */
	route: IVehicleRouteDrag | null;
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
	// Its place in the traffic while it drives along a road (moved by TrafficStep).
	const vehicle = useRef<IDrivingVehicle | null>(null);
	const [hovered, setHovered] = useState(false);
	// Hovered in a list (the outliner): highlighted like a hover in the scene.
	const listHovered = useEditor((s) => s.hovered?.kind === "entity" && s.hovered.id === entity.id);

	const props = useMemo(() => (part ? resolveProps(part, entity.props) : {}), [part, entity.props]);
	// Only parts that show values follow the data, so editing a value doesn't redraw everything.
	const usesData = part?.fields.some((field) => field.type === "dataKey") ?? false;
	const data = useEditor((s) => (usesData ? s.scene.data : undefined));
	// Vehicles face +X, so their length is the footprint's X; smooth turns take about half of it.
	const vehicleLength = part ? part.footprint(props)[0] * entity.scale : 1;
	const turns = resolveTurns(sceneTurns, road?.turns, entity.follow?.turns);
	const reverse = entity.follow?.reverse ?? false;
	const sampler = useMemo(
		() =>
			road
				? createRouteSampler(road, driving, {
						reverse,
						smoothing: turnSmoothing(turns, vehicleLength),
					})
				: null,
		[road, driving, turns, vehicleLength, reverse],
	);
	const following = Boolean(sampler && entity.follow);
	// Sideways from its lane to where it overtakes (right of travel is positive): the oncoming lane,
	// or beside the line on roads without lanes.
	const vehicleWidth = part ? part.footprint(props)[1] * entity.scale : 1;
	const lane = road ? laneOffset(road, driving) : 0;
	const passOffset =
		lane !== 0 ? -2 * lane : (driving === "right" ? -1 : 1) * Math.max(vehicleWidth * 1.3, 0.6);

	// Join the traffic while driving (hidden vehicles don't); driving again later starts from its
	// start point, not from how far it had got.
	const inTraffic = following && !entity.hidden;
	useEffect(() => {
		if (!inTraffic || !sampler || !entity.follow) {
			return;
		}
		const entry: IDrivingVehicle = {
			roadId: entity.follow.roadId,
			sampler,
			offset: entity.follow.offset,
			speed: entity.follow.speed,
			length: vehicleLength,
			travelled: 0,
			state: null,
		};
		vehicle.current = entry;
		drivingVehicles.set(entity.id, entry);
		return () => {
			drivingVehicles.delete(entity.id);
			vehicle.current = null;
		};
	}, [inTraffic, entity.id]);

	useFrame(() => {
		if (!sampler || !entity.follow || !outer.current || !inner.current) {
			return;
		}
		const current = vehicle.current;
		if (current) {
			current.roadId = entity.follow.roadId;
			current.sampler = sampler;
			current.offset = entity.follow.offset;
			current.speed = entity.follow.speed;
			current.length = vehicleLength;
		}
		const sample = sampler.at(entity.follow.offset, current?.travelled ?? 0);
		// Out towards the overtaking line, leaning into the lane change.
		const state = current?.state;
		const out = state ? state.shift * passOffset : 0;
		const lean = state ? Math.atan2(state.shiftRate * passOffset, Math.max(state.speed, 0.5)) : 0;
		const x = sample.position[0] + Math.sin(sample.heading) * out;
		const z = sample.position[1] + Math.cos(sample.heading) * out;
		outer.current.position.set(x, entity.elevation + sample.height, z);
		// Heading around Y, then nose up/down on slopes (vehicles face +X, so pitch is about Z).
		inner.current.rotation.set(0, sample.heading - lean + toRadians(entity.rotation), sample.pitch);
	});

	const editable = mode === "edit" && !entity.locked;

	/** Where a driving vehicle is on screen right now (the scene only knows where it started). */
	const currentPose = () => {
		const position = outer.current?.position;
		const heading = inner.current?.rotation.y;
		const tilt = inner.current?.rotation.z ?? 0;
		if (!position || heading === undefined) {
			return undefined;
		}
		return {
			position: [round(position.x), round(position.z)] as TVec2,
			elevation: round(position.y),
			rotation: round(normalizeDegrees(heading / DEG2RAD), 1),
			pitch: round(tilt / DEG2RAD, 1),
		};
	};

	// Let drags (and the G key) pick a driving vehicle up where it is.
	useEffect(() => {
		if (!following) {
			return;
		}
		livePoses.set(entity.id, currentPose);
		return () => {
			livePoses.delete(entity.id);
		};
	}, [following, entity.id]);

	const endDrag = (e: ThreeEvent<PointerEvent>) => {
		if (!drag.current) {
			return;
		}
		const { route, token } = drag.current;
		drag.current = null;
		(e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
		if (controls) {
			controls.enabled = true;
		}
		setDragging(false);
		route?.end(true, { coalesce: `drag:${token}`, gesture: true });
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
				dx: 0,
				dz: 0,
				token: `${entity.id}:${performance.now()}`,
				from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
				moving: false,
				route: null,
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
			const options = { coalesce: `drag:${state.token}`, gesture: true };
			if (!state.moving) {
				// Grab from here, not from the press: otherwise the distance already covered
				// snaps the object a cell over the moment the drag starts. A driving vehicle is
				// lifted off its route where it is right now.
				const from = (following ? currentPose()?.position : undefined) ?? entity.position;
				state.moving = true;
				state.dx = from[0] - hit.x;
				state.dz = from[1] - hit.z;
				state.route = createVehicleRouteDrag(entity.id);
				state.route?.start(options);
				return;
			}
			const target: TVec2 = [hit.x + state.dx, hit.z + state.dz];
			if (state.route?.move(e.ray, target, e.nativeEvent.altKey, options)) {
				return;
			}
			const free = e.nativeEvent.altKey || !useEditor.getState().snapping;
			const place = (v: number) => (free ? v : snap(v, SNAP_STEP));
			const x = clamp(place(hit.x + state.dx), -ground.width / 2, ground.width / 2);
			const z = clamp(place(hit.z + state.dz), -ground.depth / 2, ground.depth / 2);
			if (x === entity.position[0] && z === entity.position[1]) {
				return;
			}
			moveEntity(entity.id, [x, z], options);
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
		onContextMenu: openContextMenuOnClick({ kind: "entity", id: entity.id }),
	};

	if (entity.hidden) {
		return null;
	}
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
				// Heading, then nose up or down (vehicles face +X, so pitch turns about Z), as when driving.
				rotation={following ? undefined : [0, toRadians(entity.rotation), toRadians(entity.pitch)]}
				scale={entity.scale}
				{...handlers}
			>
				<Component
					props={props}
					color={color}
					accent={accent}
					palette={palette}
					playing={playing}
					data={data}
				/>

				{mode === "edit" && (selected || hovered || listHovered) && (
					<SelectionFrame size={footprint} color={palette.selection} dashed={!selected} />
				)}
			</group>

			{mode === "edit" && selected && !entity.locked && !drawing && <EntityGizmo entity={entity} />}

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
