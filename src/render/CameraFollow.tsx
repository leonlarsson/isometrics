import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { DEG2RAD } from "#/lib/math";
import { getPart, resolveProps } from "#/parts/registry";

import { livePoses } from "./routeDrop";
import { resetViewShift } from "./viewShift";

/** How quickly the camera catches up (per second): higher is tighter, lower is smoother. */
const FOLLOW_RATE = 8;
const RIDE_RATE = 4;

const at = new THREE.Vector3();
const goal = new THREE.Vector3();
const shift = new THREE.Vector3();
const forward = new THREE.Vector3();

/**
 * Keeps the camera on a vehicle (`cameraFollow` in the store). Following
 * keeps the angle and distance you chose and moves with the vehicle (orbit
 * and zoom still work); riding along sits behind and a little above it in
 * perspective, looking where it's going. Panning the view, or any press while
 * riding, hands the camera back. See docs/adr/0040-follow-and-ride-along.md.
 */
export const CameraFollow = () => {
	const follow = useEditor((s) => s.cameraFollow);
	const entity = useEditor((s) =>
		follow ? (s.scene.entities.find((e) => e.id === follow.entityId) ?? null) : null,
	);
	const get = useThree((s) => s.get);
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);

	// Ride-along distances scale with the vehicle: a race car sits lower and closer than a truck.
	const length = useMemo(() => {
		const part = entity ? getPart(entity.kind) : undefined;
		return part
			? part.footprint(resolveProps(part, entity?.props ?? {}))[0] * (entity?.scale ?? 1)
			: 1.5;
	}, [entity?.kind, entity?.props, entity?.scale]);

	// Following moves the camera anyway: the vehicle goes in the middle of the canvas.
	useEffect(() => {
		if (follow) {
			resetViewShift();
		}
	}, [follow?.entityId, follow?.ride]);

	// Taking the camera back: a pan (plain left-drag) stops following; while riding, any press or
	// scroll does.
	useEffect(() => {
		if (!follow) {
			return;
		}
		const onDown = (event: PointerEvent) => {
			const plain = event.button === 0 && !(event.ctrlKey || event.metaKey || event.shiftKey);
			if (follow.ride || plain) {
				useEditor.getState().stopFollowing();
			}
		};
		const onWheel = () => {
			if (follow.ride) {
				useEditor.getState().stopFollowing();
			}
		};
		element.addEventListener("pointerdown", onDown);
		element.addEventListener("wheel", onWheel, { passive: true });
		return () => {
			element.removeEventListener("pointerdown", onDown);
			element.removeEventListener("wheel", onWheel);
		};
	}, [follow, element]);

	useFrame((_, delta) => {
		if (!follow || !entity) {
			return;
		}
		const { camera } = get();
		const controls = get().controls as unknown as {
			target: THREE.Vector3;
			update: () => void;
		} | null;
		if (!controls) {
			return;
		}
		// Where it is right now: driving vehicles move every frame, parked ones stand still.
		const pose = livePoses.get(entity.id)?.() ?? {
			position: entity.position,
			elevation: entity.elevation,
			rotation: entity.rotation,
		};
		at.set(pose.position[0], pose.elevation, pose.position[1]);
		const step = Math.min(delta, 0.1);

		if (!follow.ride) {
			// Glide the view's centre onto the vehicle and keep it there, camera moving along.
			const k = 1 - Math.exp(-FOLLOW_RATE * step);
			goal.copy(at).sub(controls.target).multiplyScalar(k);
			camera.position.add(goal);
			controls.target.add(goal);
			controls.update();
			return;
		}

		// Behind and above, looking ahead along its heading (vehicles face +X when unturned).
		const heading = pose.rotation * DEG2RAD;
		forward.set(Math.cos(heading), 0, -Math.sin(heading));
		const back = Math.max(2.8, length * 2.6);
		goal
			.copy(at)
			.addScaledVector(forward, -back)
			.add(shift.set(0, Math.max(1.5, length * 1.2), 0));
		const k = 1 - Math.exp(-RIDE_RATE * step);
		camera.position.lerp(goal, k);
		goal
			.copy(at)
			.addScaledVector(forward, back * 2)
			.add(shift.set(0, length * 0.3, 0));
		controls.target.lerp(goal, k);
		controls.update();
	});

	// The vehicle was deleted: stop.
	useEffect(() => {
		if (follow && !entity) {
			useEditor.getState().stopFollowing();
		}
	}, [follow, entity]);

	return null;
};
