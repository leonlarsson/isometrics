import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { IRouteSampler } from "#/scene/routes";

import type { IDrivingVehicle } from "./traffic";
import { makeWaveMaterial, wakeField } from "./WakeField";

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

/** Steps along the waves' V, and across it (its middle and its two arms). */
const WAVE_SEGMENTS = 48;
const WAVE_ACROSS = [-1, -0.5, 0, 0.5, 1];
/** How fast the V opens: each arm 19.5° off the track, as behind any boat (Kelvin's angle). */
const KELVIN_SPREAD = Math.tan((19.5 * Math.PI) / 180);

/** An angle brought into -π…π. */
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Above the water, below anything standing in it. */
const LIFT = 0.012;
const FOAM_COLOR = new THREE.Color("#f4f8fb");

/** A ribbon of `rows` × `columns` points, facing up, with `attributes` of their sizes. */
const makeRibbon = (rows: number, columns: number, attributes: Record<string, number>) => {
	const made = new THREE.BufferGeometry();
	made.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rows * columns * 3), 3));
	for (const [name, size] of Object.entries(attributes)) {
		made.setAttribute(
			name,
			new THREE.BufferAttribute(new Float32Array(rows * columns * size), size),
		);
	}
	const indices: number[] = [];
	for (let row = 0; row < rows - 1; row++) {
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
};

/** Where the wake runs at a row: its middle, the route's heading there, its height. */
interface IWakeRow {
	position: [number, number];
	heading: number;
	height: number;
}

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
	/** Whether it also makes waves in the water (Foam and waves), drawn into the wave field. */
	makesWaves: boolean;
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
	makesWaves,
}: IBoatWakeProps) => {
	const mesh = useRef<THREE.Mesh>(null);
	const waves = useRef<{ mesh: THREE.Mesh; material: THREE.ShaderMaterial } | null>(null);
	const geometry = useMemo(() => makeRibbon(SEGMENTS + 1, ACROSS.length, { color: 4 }), []);
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);
	// The waves' V, longer and wider than the foam: across (-1 to 1), its half-width there, how far
	// along (0 to 1), heading.
	const waveGeometry = useMemo(
		() => makeRibbon(WAVE_SEGMENTS + 1, WAVE_ACROSS.length, { wakeShape: 4 }),
		[],
	);
	useLayoutEffect(() => () => waveGeometry.dispose(), [waveGeometry]);

	// Drawn into the wave field (WakeField.tsx), which the reflective water reads.
	useEffect(() => {
		if (!makesWaves) {
			return;
		}
		const material = makeWaveMaterial();
		const made = new THREE.Mesh(waveGeometry, material);
		made.frustumCulled = false;
		wakeField.scene.add(made);
		waves.current = { mesh: made, material };
		return () => {
			wakeField.scene.remove(made);
			material.dispose();
			waves.current = null;
		};
	}, [makesWaves, waveGeometry]);

	useFrame(({ clock }) => {
		const boat = vehicle.current;
		const shape = mesh.current;
		if (!shape) {
			return;
		}
		const speed = boat ? (boat.state?.speed ?? boat.speed) : 0;
		const travelled = boat?.travelled ?? 0;
		const moving = speed > 0.01 && travelled > 0.05;
		// The boat as it's drawn: straight, pointing along the route where its centre is (+X forward).
		const boatAt = sampler.at(offset, travelled);
		const forwardX = Math.cos(boatAt.heading);
		const forwardZ = -Math.sin(boatAt.heading);
		/**
		 * `count + 1` rows, `step` apart, from `start` behind the boat's centre (ahead of it when
		 * negative), and how sharply the wake turns at each. The first `rigid` of it moves with the
		 * boat (alongside the hull) and the next `swing` straight back from there, before it joins the
		 * route: in a turn the boat, drawn straight, swings out of it.
		 */
		const rowsBehind = (
			count: number,
			step: number,
			start: number,
			rigid: number,
			swing: number,
		) => {
			const rows = Array.from({ length: count + 1 }, (_, row): IWakeRow => {
				const back = start + row * step;
				const onRoute = sampler.at(offset, travelled - back);
				const past = row * step - rigid;
				const straight = past <= 0 ? 1 : Math.max(0, 1 - past / swing) ** 2;
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
			// As the radius of the turn, the smallest of its neighbours' too, so it narrows smoothly.
			const turns = rows.map((_, row) => {
				const before = rows[Math.max(row - 1, 0)];
				const after = rows[Math.min(row + 1, count)];
				const turned = Math.abs(wrapAngle(after.heading - before.heading));
				const distance = step * (Math.min(row + 1, count) - Math.max(row - 1, 0));
				return turned < 1e-4 ? Number.POSITIVE_INFINITY : distance / turned;
			});
			const radii = turns.map((_, row) =>
				Math.min(turns[row], turns[Math.max(row - 1, 0)], turns[Math.min(row + 1, count)]),
			);
			return { rows, radii };
		};

		// The waves: a long V from the bow whose arms open at Kelvin's angle, growing as it sets off.
		if (waves.current) {
			const waveFull = Math.min(length * (2.5 + speed * 1.5), length * 6);
			const waveShown = Math.min(waveFull, Math.max(0, travelled));
			waves.current.mesh.visible = moving;
			waves.current.material.uniforms.strength.value =
				(waveShown / waveFull) ** 0.5 * Math.min(1, 0.4 + speed * 0.4);
			if (moving) {
				const step = waveShown / WAVE_SEGMENTS;
				// From the bow, moving with the boat alongside its hull; only half a boat length behind the
				// stern swings with it: waves already made stay where they are.
				const bow = length - behind;
				const { rows } = rowsBehind(WAVE_SEGMENTS, step, -bow, length, length * 0.5);
				const positions = waveGeometry.getAttribute("position") as THREE.BufferAttribute;
				const shapes = waveGeometry.getAttribute("wakeShape") as THREE.BufferAttribute;
				// Opening at Kelvin's angle from where each part was made, whatever came after it: inside a
				// turn the crests cross, as real ones do.
				rows.forEach((row, index) => {
					const half = width * 0.1 + index * step * KELVIN_SPREAD;
					const sideX = Math.sin(row.heading);
					const sideZ = Math.cos(row.heading);
					for (let column = 0; column < WAVE_ACROSS.length; column++) {
						const i = index * WAVE_ACROSS.length + column;
						const out = WAVE_ACROSS[column] * half;
						positions.setXYZ(i, row.position[0] + sideX * out, 0, row.position[1] + sideZ * out);
						shapes.setXYZW(i, WAVE_ACROSS[column], half, index / WAVE_SEGMENTS, row.heading);
					}
				});
				positions.needsUpdate = true;
				shapes.needsUpdate = true;
			}
		}

		// The foam: with waves only the short stretch at the stern, as on real water; on its own longer.
		const full = makesWaves
			? Math.min(length * (0.8 + speed * 0.5), length * 2.5)
			: Math.min(length * (1.2 + speed), length * 5);
		const shown = Math.min(full, Math.max(0, travelled));
		shape.visible = moving;
		if (!shape.visible) {
			return;
		}
		const t = clock.elapsedTime;
		const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
		const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
		const { rows: samples, radii } = rowsBehind(SEGMENTS, shown / SEGMENTS, behind, 0, length);
		for (let row = 0; row <= SEGMENTS; row++) {
			const along = row / SEGMENTS;
			const back = behind + along * shown;
			const sample = samples[row];
			const [x, z] = sample.position;
			const y = elevation + sample.height + LIFT;
			// Right of travel (as for overtaking); the V opens out behind the boat.
			const sideX = Math.sin(sample.heading);
			const sideZ = Math.cos(sample.heading);
			// Narrower in a tight turn; with waves it hardly widens, the waves' V does that.
			const widening = makesWaves ? 1.2 : 3.2;
			const half = Math.min((width / 2) * (0.9 + widening * along), radii[row] * IN_TURN);
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
