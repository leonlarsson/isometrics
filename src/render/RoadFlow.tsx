import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { flowDirection, flowOffsets, vehiclesOnStream } from "#/editor/roadFlows";
import { useEditor } from "#/editor/store";
import { resolvePartColors, resolvePartTransparencies } from "#/parts/colorModel";
import { resolveLights } from "#/parts/lightModel";
import { shareGeometryAs } from "#/parts/primitives";
import { getPart, resolveProps } from "#/parts/registry";
import { createFlowTrip, flowDrivesOn, flowVehicleLength, flowVehicleSize } from "#/scene/flows";
import { type IRoadNetwork, roadNetworkOf } from "#/scene/junctions";
import { isHiddenRoute, polylineLength } from "#/scene/roads";
import { centerlineOf, createOneWaySampler } from "#/scene/routes";
import type { TDataValue, TDrivingSide, TRoad } from "#/scene/schema";
import type { IScenePalette } from "#/scene/theme";

import { useInstancedPart } from "./InstancedParts";

/**
 * A road's flow (ADR-0112): its vehicles, evenly spaced on one-way streams
 * from its first point to its last and back, and arrows on it pointing the way
 * the bigger flow goes. They're drawn by the road, not objects of the world,
 * and moved by one frame callback per road. A flow that drives on through
 * junctions (ADR-0147) is background traffic instead: each vehicle starts where
 * it would, then drives a trip of its own across the network, with no arrows.
 */

/** Grid units between arrows on the road. */
const ARROW_SPACING = 5;

const NO_LIGHT_SETTINGS = { lights: {} };

/** A chevron lying flat, pointing +X. */
const makeChevron = () => {
	const shape = new THREE.Shape();
	shape.moveTo(0.35, 0);
	shape.lineTo(-0.15, 0.35);
	shape.lineTo(-0.35, 0.35);
	shape.lineTo(0.12, 0);
	shape.lineTo(-0.35, -0.35);
	shape.lineTo(-0.15, -0.35);
	shape.closePath();
	const geometry = new THREE.ShapeGeometry(shape);
	geometry.rotateX(-Math.PI / 2);
	return shareGeometryAs(geometry, "flowChevron");
};

/** The chevron, made once and shared by every road's arrows (so none is left undisposed). */
let chevron: THREE.BufferGeometry | null = null;
const chevronGeometry = () => {
	chevron ??= makeChevron();
	return chevron;
};

/** One vehicle of a flow: its part drawn as an object would be, batched with others like it. */
const FlowVehicle = ({
	kind,
	palette,
	data,
	register,
}: {
	kind: string;
	palette: IScenePalette;
	data: readonly TDataValue[];
	register: (group: THREE.Group | null) => void;
}) => {
	const part = getPart(kind);
	const group = useRef<THREE.Group>(null);
	useInstancedPart(group, true);
	if (!part) {
		return null;
	}
	const Component = part.Component;
	return (
		<group
			ref={(element) => {
				group.current = element;
				register(element);
			}}
		>
			<Component
				props={resolveProps(part, {})}
				colors={resolvePartColors(part, palette)}
				transparency={resolvePartTransparencies(part)}
				palette={palette}
				playing
				lights={resolveLights(part, NO_LIGHT_SETTINGS, { palette, driving: true, data })}
			/>
		</group>
	);
};

/** A stream of vehicles one way along a road. */
const Stream = ({
	road,
	driving,
	reverse,
	count,
	palette,
	data,
	altitude,
}: {
	road: TRoad;
	driving: TDrivingSide;
	reverse: boolean;
	count: number;
	palette: IScenePalette;
	data: readonly TDataValue[];
	altitude: number;
}) => {
	const playing = useEditor((s) => s.playing);
	const part = getPart(road.flow.vehicleKind);
	// Its vehicles at their size on this road (ADR-0135): spaced and turning by that length.
	const length = flowVehicleLength(road.flow, part ? part.footprint(resolveProps(part, {}))[0] : 1);
	// A flow that goes one way only drives down the middle, so no lane of the road stays empty.
	const oneWay = road.flow.vehicleCountAlong === 0 || road.flow.vehicleCountAgainst === 0;
	const sampler = useMemo(
		() =>
			createOneWaySampler(
				oneWay ? { ...road, traffic: { ...road.traffic, drivingLane: "centre" } } : road,
				driving,
				{ reverse, smoothing: length / 2 },
			),
		[road, driving, reverse, length, oneWay],
	);
	// Its count, or with a density that many per 10 units, never closer than a vehicle and a half
	// apart, or a long road of trucks reads as one train (ADR-0112).
	const offsets = flowOffsets(
		vehiclesOnStream(road.flow, count, sampler.length, length),
		sampler.length,
		reverse,
	);
	const groups = useRef<(THREE.Group | null)[]>([]);
	const travelled = useRef(0);
	// Paused, the vehicles stand still: placed once for what they're placed by, not every frame.
	const placed = useRef<{
		offsets: number[];
		sampler: typeof sampler;
		altitude: number;
		groups: (THREE.Group | null)[];
	} | null>(null);

	useFrame((_, delta) => {
		const was = placed.current;
		if (playing) {
			travelled.current += road.flow.speed * Math.min(delta, 0.1);
		} else if (
			was?.offsets === offsets &&
			was.sampler === sampler &&
			was.altitude === altitude &&
			was.groups.every((group, i) => group === groups.current[i])
		) {
			return;
		}
		let placedAll = true;
		for (let i = 0; i < offsets.length; i++) {
			const group = groups.current[i];
			if (!group) {
				placedAll = false;
				continue;
			}
			const distance = offsets[i] + travelled.current;
			const sample = sampler.at(distance);
			// Grows in at the start and shrinks out at the end, so the jump back isn't seen.
			const ease = flowVehicleSize(distance, sampler.length, false);
			group.position.set(sample.position[0], altitude + sample.height, sample.position[1]);
			group.rotation.set(0, sample.heading, sample.pitch, "YZX");
			group.scale.setScalar(Math.max(0.001, ease) * road.flow.vehicleScale);
		}
		placed.current =
			placedAll && !playing
				? { offsets, sampler, altitude, groups: groups.current.slice(0, offsets.length) }
				: null;
	});

	return (
		<>
			{offsets.map((_, index) => (
				<FlowVehicle
					// biome-ignore lint/suspicious/noArrayIndexKey: vehicles of a stream are alike, by place
					key={index}
					kind={road.flow.vehicleKind}
					palette={palette}
					data={data}
					register={(group) => {
						groups.current[index] = group;
					}}
				/>
			))}
		</>
	);
};

/**
 * A stream of a flow that drives on through junctions (ADR-0147): its vehicles start spread along
 * the road as a stream's do, then each drives its own trip across the network, picking ways at
 * junctions and turning round at dead ends; it grows in once, at the start, and never shrinks.
 */
const DrivingOnStream = ({
	road,
	network,
	driving,
	reverse,
	count,
	palette,
	data,
}: {
	road: TRoad;
	network: IRoadNetwork;
	driving: TDrivingSide;
	reverse: boolean;
	count: number;
	palette: IScenePalette;
	data: readonly TDataValue[];
}) => {
	const playing = useEditor((s) => s.playing);
	const part = getPart(road.flow.vehicleKind);
	const length = flowVehicleLength(road.flow, part ? part.footprint(resolveProps(part, {}))[0] : 1);
	// The road as the network has it, which its trips drive.
	const roadLength = polylineLength(centerlineOf(network.roadById(road.id) ?? road), false);
	const vehicles = vehiclesOnStream(road.flow, count, roadLength, length);
	const trips = useMemo(
		() =>
			flowOffsets(vehicles, roadLength, reverse).map((offset, index) => ({
				offset,
				trip: createFlowTrip(network, road.id, {
					driving,
					smoothing: length / 2,
					reverse,
					offset,
					length: roadLength,
					index,
				}),
			})),
		[network, road.id, driving, reverse, length, roadLength, vehicles],
	);
	const groups = useRef<(THREE.Group | null)[]>([]);
	const travelled = useRef(0);
	// Paused, the vehicles stand still: placed once for what they're placed by, not every frame.
	const placed = useRef<{ trips: typeof trips; groups: (THREE.Group | null)[] } | null>(null);
	// New trips (a road or junction changed) start again from where the vehicles start: a trip
	// replays its way from there, so carrying on from far along would cost a frame dearly.
	const tripsDriven = useRef(trips);

	useFrame((_, delta) => {
		if (tripsDriven.current !== trips) {
			tripsDriven.current = trips;
			travelled.current = 0;
		}
		const was = placed.current;
		if (playing) {
			travelled.current += road.flow.speed * Math.min(delta, 0.1);
		} else if (
			was?.trips === trips &&
			was.groups.every((group, i) => group === groups.current[i])
		) {
			return;
		}
		let placedAll = true;
		for (let i = 0; i < trips.length; i++) {
			const group = groups.current[i];
			if (!group) {
				placedAll = false;
				continue;
			}
			const { offset, trip } = trips[i];
			const sample = trip.at(0, travelled.current);
			const size = flowVehicleSize(offset + travelled.current, roadLength, true);
			group.position.set(sample.position[0], sample.height, sample.position[1]);
			group.rotation.set(0, sample.heading, sample.pitch, "YZX");
			group.scale.setScalar(Math.max(0.001, size) * road.flow.vehicleScale);
		}
		placed.current =
			placedAll && !playing ? { trips, groups: groups.current.slice(0, trips.length) } : null;
	});

	return (
		<>
			{trips.map((_, index) => (
				<FlowVehicle
					// biome-ignore lint/suspicious/noArrayIndexKey: vehicles of a stream are alike, by place
					key={index}
					kind={road.flow.vehicleKind}
					palette={palette}
					data={data}
					register={(group) => {
						groups.current[index] = group;
					}}
				/>
			))}
		</>
	);
};

/** Arrows lying on the road every few units, pointing the way its bigger flow goes. */
const FlowArrows = ({ road, color, y }: { road: TRoad; color: string; y: number }) => {
	const direction = flowDirection(road.flow);
	const arrows = useMemo(() => {
		if (direction === 0) {
			return [];
		}
		const centre = { ...road, traffic: { ...road.traffic, drivingLane: "centre" as const } };
		const sampler = createOneWaySampler(centre, "right", { reverse: direction < 0 });
		const count = Math.floor(sampler.length / ARROW_SPACING);
		return Array.from({ length: count }, (_, index) => {
			const sample = sampler.at((index + 0.5) * ARROW_SPACING);
			return { position: sample.position, height: sample.height, heading: sample.heading };
		});
	}, [road, direction]);
	const geometry = chevronGeometry();
	const scale = Math.min(1.6, road.width * 0.45);
	return (
		<>
			{arrows.map((arrow) => (
				<mesh
					key={`${arrow.position[0]},${arrow.position[1]}`}
					geometry={geometry}
					position={[arrow.position[0], y + arrow.height, arrow.position[1]]}
					rotation={[0, arrow.heading, 0]}
					scale={scale}
				>
					<meshStandardMaterial color={color} />
				</mesh>
			))}
		</>
	);
};

/**
 * The arrows' colour on a road's surface: much darker on a light road, much lighter on a dark one,
 * so they read on any road in either theme (the road's own markings are white, lost on light roads).
 */
export const arrowColorOn = (surface: string) => {
	const color = new THREE.Color(surface);
	const { l } = color.getHSL({ h: 0, s: 0, l: 0 });
	return `#${color.lerp(new THREE.Color(l > 0.5 ? "#000000" : "#ffffff"), 0.55).getHexString()}`;
};

/** A road's flow: its streams of vehicles each way, and its arrows. */
export const RoadFlow = ({
	road,
	palette,
	data,
	surfaceY,
	surfaceColor,
}: {
	road: TRoad;
	/** The road's surface colour as drawn, for arrows that stand out on it. */
	surfaceColor: string;
	palette: IScenePalette;
	data: readonly TDataValue[];
	/** The road surface's height above the ground (its layer). */
	surfaceY: number;
}) => {
	const driving = useEditor((s) => s.scene.traffic.drivingSide);
	// The network only for a flow that may drive on, so other flows don't draw again for every road.
	const network = useEditor((s) =>
		road.flow.enabled && road.flow.drivesThroughJunctions
			? roadNetworkOf(s.scene.roads, s.scene.junctions)
			: null,
	);
	if (!road.flow.enabled) {
		return null;
	}
	if (network && flowDrivesOn(network, road)) {
		return (
			<>
				<DrivingOnStream
					road={road}
					network={network}
					driving={driving}
					reverse={false}
					count={road.flow.vehicleCountAlong}
					palette={palette}
					data={data}
				/>

				<DrivingOnStream
					road={road}
					network={network}
					driving={driving}
					reverse
					count={road.flow.vehicleCountAgainst}
					palette={palette}
					data={data}
				/>
			</>
		);
	}
	return (
		<>
			<Stream
				road={road}
				driving={driving}
				reverse={false}
				count={road.flow.vehicleCountAlong}
				palette={palette}
				data={data}
				altitude={0}
			/>

			<Stream
				road={road}
				driving={driving}
				reverse
				count={road.flow.vehicleCountAgainst}
				palette={palette}
				data={data}
				altitude={0}
			/>

			{road.flow.showsArrows && !isHiddenRoute(road.kind) && (
				<FlowArrows road={road} color={arrowColorOn(surfaceColor)} y={surfaceY + 0.01} />
			)}
		</>
	);
};
