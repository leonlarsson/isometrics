import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { DEG2RAD, normalizeDegrees } from "#/lib/math";

import { liveCamera } from "./liveCamera";

const direction = new THREE.Vector3();

interface ITargetControls {
	target: THREE.Vector3;
}

/** Writes which way the camera looks into liveCamera every frame, for the overlays. */
export const CameraReadout = () => {
	useFrame(({ camera, controls }) => {
		if (!controls) {
			return;
		}
		direction.subVectors(camera.position, (controls as unknown as ITargetControls).target);
		direction.normalize();
		liveCamera.azimuth = normalizeDegrees(Math.atan2(-direction.z, direction.x) / DEG2RAD);
		liveCamera.elevation = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)) / DEG2RAD;
		liveCamera.fieldOfView = camera instanceof THREE.PerspectiveCamera ? camera.fov : null;
	});
	return null;
};
