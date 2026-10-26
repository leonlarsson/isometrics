import { useFrame } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { IRouteSampler } from "#/scene/routes";

import type { IDrivingVehicle } from "./traffic";

/** Steps along the wake, from the stern to where it has faded. */
const SEGMENTS = 32;
/**
 * Across the wake, as parts of its half-width: soft outer edges, a band of
 * foam a little inside each (the V of a wake), and the churned water down the
 * middle, which fades sooner.
 */
const ACROSS = [-1, -0.82, -0.68, -0.4, 0, 0.4, 0.68, 0.82, 1];
const FOAM_ACROSS = [0, 1, 1, 0.15, 0.1, 0.15, 1, 1, 0];
const CHURN_ACROSS = [0, 0, 0, 0.6, 1, 0.6, 0, 0, 0];
/** At most this part of a turn's radius each side, so the wake never folds over itself inside a turn. */
const IN_TURN = 0.85;

/** An angle brought into -π…π. */
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Above the water, below anything standing in it. */
const LIFT = 0.012;
const FOAM_COLOR = new THREE.Color("#f4f8fb");

interface IBoatWakeProps {
	sampler: IRouteSampler;
	/** Where along the route the boat starts. */
	offset: number;
	/** The boat in the traffic: how far it has travelled and how fast it goes now. */
	vehicle: RefObject<IDrivingVehicle | null>;
	/** The wake's width where it starts, and how far behind the boat's centre that is. */
	width: number;
	behind: number;
	/** The boat's length: the wake grows with it, and with the speed. */
	length: number;
	elevation: number;
}

/**
 * The foam a boat leaves behind it on a route (Graphics: Boat wakes, ADR-0081):
 * a ribbon along the stretch of route behind the boat, widening and fading
 * towards its end, longer the faster the boat goes. Made from where the route
 * goes, not from where the boat has been, so it's the same every time and
 * costs one small mesh. Lit like the world, so it doesn't glow at night.
 */
export const BoatWake = ({
	sampler,
	offset,
	vehicle,
	width,
	behind,
	length,
	elevation,
}: IBoatWakeProps) => {
	const mesh = useRef<THREE.Mesh>(null);
	const geometry = useMemo(() => {
		const rows = SEGMENTS + 1;
		const columns = ACROSS.length;
		const made = new THREE.BufferGeometry();
		made.setAttribute(
			"position",
			new THREE.BufferAttribute(new Float32Array(rows * columns * 3), 3),
		);
		made.setAttribute("color", new THREE.BufferAttribute(new Float32Array(rows * columns * 4), 4));
		const indices: number[] = [];
		for (let row = 0; row < SEGMENTS; row++) {
			for (let column = 0; column < columns - 1; column++) {
				const a = row * columns + column;
				const b = a + columns;
				indices.push(a, b, a + 1, a + 1, b, b + 1);
			}
		}
		made.setIndex(indices);
		// Facing up whichever way the route turns.
		const normals = new Float32Array(rows * columns * 3);
		for (let i = 0; i < rows * columns; i++) {
			normals[i * 3 + 1] = 1;
		}
		made.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
		return made;
	}, []);
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);

	useFrame(({ clock }) => {
		const boat = vehicle.current;
		const shape = mesh.current;
		if (!shape) {
			return;
		}
		const speed = boat ? (boat.state?.speed ?? boat.speed) : 0;
		const travelled = boat?.travelled ?? 0;
		// Grows from nothing as it sets off; none when it stands still.
		const full = Math.min(length * (1.2 + speed), length * 5);
		const shown = Math.min(full, Math.max(0, travelled));
		shape.visible = shown > 0.05 && speed > 0.01;
		if (!shape.visible) {
			return;
		}
		const t = clock.elapsedTime;
		const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
		const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
		const step = shown / SEGMENTS;
		// The boat as it's drawn: straight, pointing along the route where its centre is (+X forward).
		const boatAt = sampler.at(offset, travelled);
		const forwardX = Math.cos(boatAt.heading);
		const forwardZ = -Math.sin(boatAt.heading);
		const samples = Array.from({ length: SEGMENTS + 1 }, (_, row) => {
			const back = behind + row * step;
			const onRoute = sampler.at(offset, travelled - back);
			// From its stern straight back, then onto the route within a boat length: in a turn the
			// stern swings out of the route.
			const straight = Math.max(0, 1 - (row * step) / length) ** 2;
			return {
				position: [
					onRoute.position[0] +
						(boatAt.position[0] - forwardX * back - onRoute.position[0]) * straight,
					onRoute.position[1] +
						(boatAt.position[1] - forwardZ * back - onRoute.position[1]) * straight,
				],
				heading: onRoute.heading + wrapAngle(boatAt.heading - onRoute.heading) * straight,
				height: onRoute.height,
			};
		});
		// How sharply the route turns at each row, as the radius of the turn.
		const radii = samples.map((_, row) => {
			const before = samples[Math.max(row - 1, 0)];
			const after = samples[Math.min(row + 1, SEGMENTS)];
			const turned = Math.abs(wrapAngle(after.heading - before.heading));
			const distance = step * (Math.min(row + 1, SEGMENTS) - Math.max(row - 1, 0));
			return turned < 1e-4 ? Number.POSITIVE_INFINITY : distance / turned;
		});
		for (let row = 0; row <= SEGMENTS; row++) {
			const along = row / SEGMENTS;
			const back = behind + along * shown;
			const sample = samples[row];
			const [x, z] = sample.position;
			const y = elevation + sample.height + LIFT;
			// Right of travel (as for overtaking); the V opens out behind the boat.
			const sideX = Math.sin(sample.heading);
			const sideZ = Math.cos(sample.heading);
			// Narrower in a tight turn (its neighbours' turns too, so it narrows smoothly).
			const radius = Math.min(
				radii[row],
				radii[Math.max(row - 1, 0)],
				radii[Math.min(row + 1, SEGMENTS)],
			);
			const half = Math.min((width / 2) * (0.9 + 3.2 * along), radius * IN_TURN);
			// Fades out along it, the churn sooner; a shimmer that drifts back along it.
			const fade = (1 - along) ** 1.6 * (shown / full) ** 0.5;
			const churn = (1 - along) ** 3;
			for (let column = 0; column < ACROSS.length; column++) {
				const i = row * ACROSS.length + column;
				const out = ACROSS[column] * half;
				positions.setXYZ(i, x + sideX * out, y, z + sideZ * out);
				const shimmer = 0.85 + 0.15 * Math.sin(back * 2.3 - t * 3 + column * 1.7);
				const alpha = (FOAM_ACROSS[column] * fade + CHURN_ACROSS[column] * churn) * shimmer;
				colors.setXYZW(i, FOAM_COLOR.r, FOAM_COLOR.g, FOAM_COLOR.b, alpha);
			}
		}
		positions.needsUpdate = true;
		colors.needsUpdate = true;
	});

	return (
		<mesh
			ref={mesh}
			geometry={geometry}
			receiveShadow
			// It moves every frame, so a bounding sphere would always be stale.
			frustumCulled={false}
			// Clicks go through it to the water and the boat.
			raycast={() => null}
		>
			<meshStandardMaterial
				vertexColors
				transparent
				// Both faces, so no part of it can be left out where it twists.
				side={THREE.DoubleSide}
				depthWrite={false}
				roughness={1}
				polygonOffset
				polygonOffsetFactor={-2}
			/>
		</mesh>
	);
};
