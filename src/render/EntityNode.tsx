import { Line } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import type { TDrawnGraphics } from "#/editor/graphics";
import { groupStart, type IGroupStart } from "#/editor/groupTransform";
import { isToggleClick, SNAP_STEP, type TEditorMode, useEditor } from "#/editor/store";
import { clamp, DEG2RAD, normalizeDegrees, round, snap, toRadians } from "#/lib/math";
import { isClick, pastDragThreshold } from "#/lib/pointer";
import { resolveColors, resolveLabelColor, resolveTransparencies } from "#/parts/colorModel";
import { resolveLights } from "#/parts/lightModel";
import { getPart, resolveProps } from "#/parts/registry";
import { LIGHT_SHAPES_WITH_REACH } from "#/parts/types";
import { groundHeightAt } from "#/scene/areas";
import { laneOffset, resolveLeansInTurns, resolveTurnStyle, turnSmoothing } from "#/scene/roads";
import { createRouteSampler, turnLeanDegrees } from "#/scene/routes";
import type { TDataValue, TEntity, TRoad, TScene, TVec2, TVec3 } from "#/scene/schema";
import type { ISunPosition } from "#/scene/sun";
import type { IScenePalette } from "#/scene/theme";

import { BoatWake } from "./BoatWake";
import { openContextMenuOnClick } from "./contextMenu";
import { EntityGizmo } from "./EntityGizmo";
import { EntityLabel } from "./EntityLabel";
import { useInstancedPart } from "./InstancedParts";
import { RealLightSource } from "./RealLights";
import { forgetBounds, raycastWithinBounds } from "./raycastBounds";
import { createVehicleRouteDrag, type IVehicleRouteDrag, livePoses } from "./routeDrop";
import { drivingVehicles, type IDrivingVehicle } from "./traffic";
import { applyGroupDrag } from "./transforms";
import { surfaceHitOnRay } from "./useGroundDrag";
import { setViewCursor } from "./viewCursor";

const hit = new THREE.Vector3();

interface IDragState {
	/**
	 * How high above the ground it stood when the drag began: the pointer is
	 * followed on the ground as it stands lifted that much, so the object stays
	 * under it over raised land (ADR-0098).
	 */
	above: number;
	dx: number;
	dz: number;
	token: string;
	/** Where the press started (screen px); the object stays put until it passes the threshold. */
	from: { clientX: number; clientY: number };
	moving: boolean;
	/** Snaps a vehicle onto roads it's dragged over. */
	route: IVehicleRouteDrag | null;
	/** One of several selected things: the drag moves them all, from where they were (ADR-0064). */
	group: { start: IGroupStart; from: TVec2 } | null;
	/** Ctrl/Cmd held: the drag moves copies of the selection and leaves it where it was (ADR-0067). */
	copying: boolean;
}

/**
 * An object's matrices, kept up to date every frame (`still` false) or worked out now and then
 * left alone (`still`): three otherwise rebuilds every object's matrix every frame, which in a
 * world of thousands of objects standing still was most of a frame's time (ADR-0092).
 */
const settleMatrices = (root: THREE.Object3D, still: boolean) => {
	if (!still) {
		if (root.userData.settled) {
			root.userData.settled = false;
			root.traverse((object) => {
				object.matrixAutoUpdate = true;
			});
		}
		return;
	}
	root.userData.settled = true;
	root.traverse((object) => {
		object.updateMatrix();
		object.matrixAutoUpdate = false;
	});
	root.updateWorldMatrix(true, true);
};

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

/** What every object draws with that's the same for all of them, read once (render/Viewport). */
export interface IEntityWorld {
	mode: TEditorMode;
	/** A selection box being drawn takes things out of the selection. */
	unboxing: boolean;
	playing: boolean;
	ground: TScene["ground"];
	driving: TScene["traffic"]["drivingSide"];
	sceneTurns: TScene["traffic"]["turnStyle"];
	sceneLeans: TScene["traffic"]["leansInTurns"];
	drawing: boolean;
	palette: IScenePalette;
	graphics: TDrawnGraphics;
}

export interface IEntityNodeProps {
	entity: TEntity;
	world: IEntityWorld;
	/** The road it follows, if any. */
	road: TRoad | null;
	/** The world's data, for objects that show values or follow them; otherwise undefined. */
	data: readonly TDataValue[] | undefined;
	/** The world's hour, for objects with a light on a schedule or that follow the sun; otherwise null. */
	hour: number | null;
	/** Where the sun is now, for objects that follow it (a part's `followsTheSun`); otherwise undefined. */
	sun?: ISunPosition;
	/** Selected, alone or with other things; only a single selection gets its own gizmo (ADR-0064). */
	selected: boolean;
	alone: boolean;
	/** Inside a selection box being drawn: what letting go would add (dashed), or take out. */
	boxed: boolean;
	/** Hovered in a list (the outliner): highlighted like a hover in the scene. */
	listHovered: boolean;
}

/**
 * One object in the world. It reads nothing from the editor itself: what it needs comes in as
 * props, worked out once for every object (render/Viewport's Entities), so a change to the world
 * renders only the objects it concerns, not thousands of subscriptions (ADR-0092).
 */
export const EntityNode = memo(
	({
		entity,
		world,
		road,
		data,
		hour,
		sun,
		selected,
		alone,
		boxed,
		listHovered,
	}: IEntityNodeProps) => {
		const part = getPart(entity.kind);
		const {
			mode,
			unboxing,
			playing,
			ground,
			driving,
			sceneTurns,
			sceneLeans,
			drawing,
			palette,
			graphics,
		} = world;
		const drawsRealLights = graphics.realLightCount > 0;
		const drawsWakes = graphics.boatWakes !== "off";
		const makesWaves = graphics.boatWakes === "foamAndWaves" && graphics.showWaterReflections;
		const controls = useThree((s) => s.controls) as unknown as {
			enabled: boolean;
		} | null;

		const outer = useRef<THREE.Group>(null);
		const inner = useRef<THREE.Group>(null);
		const drag = useRef<IDragState | null>(null);
		// Its place in the traffic while it drives along a road (moved by TrafficStep).
		const vehicle = useRef<IDrivingVehicle | null>(null);
		const [hovered, setHovered] = useState(false);

		const props = useMemo(
			() => (part ? resolveProps(part, entity.props) : {}),
			[part, entity.props],
		);
		// Vehicles face +X, so their length is the footprint's X; smooth turns take about half of it.
		const vehicleLength = part ? part.footprint(props)[0] * entity.scale : 1;
		const turns = resolveTurnStyle(sceneTurns, road?.traffic.turnStyle, entity.follow?.turnStyle);
		const reverse = entity.follow?.drivesTheOtherWay ?? false;
		// How it leans in turns (ADR-0082), if its kind does and the settings let it.
		const turnLean = resolveLeansInTurns(
			sceneLeans,
			road?.traffic.leansInTurns,
			entity.follow?.leansInTurns,
		)
			? part?.turnLean
			: undefined;
		// The lean now, eased towards what the turn asks for.
		const leaning = useRef(0);
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
		const inTraffic = following && !entity.isHidden;
		useEffect(() => {
			if (!inTraffic || !sampler || !entity.follow) {
				return;
			}
			const entry: IDrivingVehicle = {
				roadId: entity.follow.roadId,
				sampler,
				offset: entity.follow.startDistance,
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

		useFrame((_, delta) => {
			if (!sampler || !entity.follow || !outer.current || !inner.current) {
				return;
			}
			const current = vehicle.current;
			if (current) {
				current.roadId = entity.follow.roadId;
				current.sampler = sampler;
				current.offset = entity.follow.startDistance;
				current.speed = entity.follow.speed;
				current.length = vehicleLength;
			}
			const sample = sampler.at(entity.follow.startDistance, current?.travelled ?? 0);
			// Out towards the overtaking line, leaning into the lane change.
			const state = current?.state;
			const out = state ? state.shift * passOffset : 0;
			const lean = state ? Math.atan2(state.shiftRate * passOffset, Math.max(state.speed, 0.5)) : 0;
			const x = sample.position[0] + Math.sin(sample.heading) * out;
			const z = sample.position[1] + Math.cos(sample.heading) * out;
			outer.current.position.set(x, entity.altitude + sample.height, z);
			// Heading around Y, then nose up/down on slopes (vehicles face +X, so pitch is about Z).
			// Leaning in a turn (ADR-0082), eased in and out.
			let roll = 0;
			if (turnLean) {
				const wanted = turnLeanDegrees(
					sampler,
					{
						offset: entity.follow.startDistance,
						travelled: current?.travelled ?? 0,
						length: vehicleLength,
						speed: playing ? (state?.speed ?? entity.follow.speed) : 0,
					},
					turnLean,
				);
				leaning.current += (wanted - leaning.current) * (1 - Math.exp(-Math.min(delta, 0.1) * 3));
				roll = toRadians(leaning.current);
			}
			// Heading, then the slope's pitch, then the lean about its own length (vehicles face +X).
			inner.current.rotation.order = "YZX";
			inner.current.rotation.set(
				roll,
				sample.heading - lean + toRadians(entity.rotation[1]),
				sample.pitch,
			);
		});

		// It may move between renders: driving, selected (dragged, turned by keys, moved with others),
		// or a part that moves pieces of itself every frame. Anything else stands still (ADR-0092).
		const moving =
			following || selected || boxed || Boolean(part?.movesOnItsOwn) || Boolean(part?.rendersAsync);

		// Its meshes drawn together with other objects' that look the same (ADR-0086).
		const partGroup = useRef<THREE.Group>(null);
		useInstancedPart(partGroup, moving);

		// Standing still, its matrices are worked out once per render, not every frame (ADR-0092), and
		// its bounds for the pointer when it first comes by (raycastWithinBounds).
		useLayoutEffect(() => {
			if (outer.current) {
				settleMatrices(outer.current, !moving);
			}
			forgetBounds(inner.current, moving);
		});

		const editable = mode === "edit" && !entity.isLocked;

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
				altitude: round(position.y),
				rotation: [
					entity.rotation[0],
					round(normalizeDegrees(heading / DEG2RAD), 1),
					round(tilt / DEG2RAD, 1),
				] as TVec3,
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
			useEditor.getState().setDragging(false);
			route?.end(true, { coalesce: `drag:${token}`, gesture: true });
		};

		const handlers = {
			onPointerDown: (e: ThreeEvent<PointerEvent>) => {
				// Only a selected object can be dragged. Pressing anything else leaves the press to the
				// camera (so panning across the scene never grabs a building); a click selects it.
				// While drawing a road, presses pass through to the ground too, and with Shift held the
				// press orbits the camera, as it does anywhere else. Ctrl or Cmd on a selected object
				// drags a copy (ADR-0067); a Ctrl-click without moving still takes it out (onClick).
				const { button, ctrlKey, metaKey, shiftKey } = e.nativeEvent;
				if (drawing || !selected || !editable || button !== 0 || shiftKey) {
					return;
				}
				const { areas } = useEditor.getState().scene;
				const above = entity.altitude - groundHeightAt(areas, entity.position);
				if (!surfaceHitOnRay(e.ray, areas, above)) {
					return;
				}
				e.stopPropagation();
				drag.current = {
					above,
					dx: 0,
					dz: 0,
					token: `${entity.id}:${performance.now()}`,
					from: { clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY },
					moving: false,
					route: null,
					group: null,
					copying: ctrlKey || metaKey,
				};
				(e.target as unknown as Element).setPointerCapture(e.pointerId);
				if (controls) {
					controls.enabled = false;
				}
				useEditor.getState().setDragging(true);
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
				// Where the pointer is on the ground as it stands (ADR-0098).
				const found = surfaceHitOnRay(e.ray, useEditor.getState().scene.areas, state.above);
				if (!found) {
					return;
				}
				hit.copy(found);
				const options = { coalesce: `drag:${state.token}`, gesture: true };
				if (!alone || state.copying) {
					// One of several selected things: they all move together, by the distance dragged. A
					// copying drag first copies them in place (the same undo step), then moves the copies.
					if (!state.moving) {
						if (state.copying) {
							useEditor.getState().duplicateSelected({ step: 0, coalesce: options.coalesce });
						}
						const start = groupStart();
						state.moving = true;
						state.group = start && { start, from: [hit.x, hit.z] };
						return;
					}
					if (state.group) {
						const { start, from } = state.group;
						applyGroupDrag(start, {
							handle: "xz",
							offset: [hit.x - from[0], hit.z - from[1]],
							lift: 0,
							turn: 0,
							ratio: 1,
							free: e.nativeEvent.altKey || !useEditor.getState().snapping,
							token: options.coalesce,
						});
					}
					return;
				}
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
				// Placed freely: on the ground as it stands there (ADR-0098).
				useEditor.getState().moveEntity(entity.id, [x, z], options, { followGround: true });
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
				if (mode === "edit" && isToggleClick(e.nativeEvent)) {
					useEditor.getState().toggleSelected({ kind: "entity", id: entity.id });
					return;
				}
				useEditor.getState().select(entity.id);
			},
			onPointerOver: (e: ThreeEvent<PointerEvent>) => {
				// No hover while drawing, or while a new part is dragged in from the palette.
				if (drawing || useEditor.getState().placingKind) {
					return;
				}
				e.stopPropagation();
				setHovered(true);
				setViewCursor(editable && selected ? "grab" : "pointer");
			},
			onPointerOut: () => {
				setHovered(false);
				setViewCursor("");
			},
			onContextMenu: openContextMenuOnClick({ kind: "entity", id: entity.id }),
		};

		if (entity.isHidden) {
			return null;
		}
		if (!part) {
			return (
				<group position={[entity.position[0], entity.altitude, entity.position[1]]} {...handlers}>
					<UnknownPart />
				</group>
			);
		}

		// Each of its colours as it is now: from data, as set, or the part's (ADR-0060).
		const colors = resolveColors(part, entity, palette, data);
		// Each of its lights as it is now: its settings, the dark, whether it drives, the data (ADR-0058).
		const lights = resolveLights(part, entity, { palette, driving: following, data, hour });
		const footprint = part.footprint(props);
		const anchorY = part.height(props) * entity.scale;
		const Component = part.Component;

		const wake = following && drawsWakes ? part.wake?.(props) : undefined;

		return (
			<>
				<group
					ref={outer}
					position={
						following ? undefined : [entity.position[0], entity.altitude, entity.position[1]]
					}
				>
					<group
						ref={inner}
						// Heading, then pitch about its own Z (a vehicle's nose up or down, as when driving), then
						// roll about its own X (ADR-0097).
						rotation={
							following
								? undefined
								: [
										toRadians(entity.rotation[0]),
										toRadians(entity.rotation[1]),
										toRadians(entity.rotation[2]),
										"YZX",
									]
						}
						scale={entity.scale}
						raycast={raycastWithinBounds}
						{...handlers}
					>
						<group ref={partGroup}>
							<Component
								props={props}
								colors={colors}
								transparency={resolveTransparencies(part, entity)}
								palette={palette}
								playing={playing}
								lights={lights}
								data={data}
								sun={sun}
							/>
						</group>

						{/* Its lights that light their surroundings, where they shine from (ADR-0072). */}
						{drawsRealLights &&
							part.lights?.flatMap((spec) => {
								const light = lights[spec.id];
								const found = spec.realLight?.(props);
								if (!found || !light) {
									return [];
								}
								const ownReach = LIGHT_SHAPES_WITH_REACH.includes(spec.shape);
								return [found]
									.flat()
									.map((source, i) => (
										<RealLightSource
											key={`${spec.id}@${source.at.join(",")}`}
											id={`${entity.id}:${spec.id}:${i}`}
											at={source.at}
											light={light}
											shape={spec.shape}
											reach={(ownReach ? light.reach : (source.reach ?? 1)) * entity.scale}
										/>
									));
							})}

						{mode === "edit" && (selected || hovered || listHovered || boxed) && (
							<SelectionFrame
								size={footprint}
								color={palette.selection}
								dashed={!selected || (boxed && unboxing)}
							/>
						)}
					</group>

					{mode === "edit" && alone && !entity.isLocked && !drawing && (
						<EntityGizmo entity={entity} />
					)}

					{entity.label.isShown && (
						<EntityLabel
							entity={entity}
							anchorY={anchorY}
							color={resolveLabelColor(part, entity, palette, data)}
						/>
					)}
				</group>

				{/* The foam it leaves on the water while it follows a route (ADR-0081). */}
				{wake && sampler && entity.follow && (
					<BoatWake
						sampler={sampler}
						offset={entity.follow.startDistance}
						vehicle={vehicle}
						width={wake.width * entity.scale}
						behind={wake.behind * entity.scale}
						length={vehicleLength}
						elevation={entity.altitude}
						makesWaves={makesWaves}
					/>
				)}
			</>
		);
	},
);
