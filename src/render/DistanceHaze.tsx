import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { sceneHoursNow } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { weatherNowInWorld } from "#/editor/weather";
import { mixColor } from "#/lib/color";
import { skyLookAt } from "#/scene/sky";
import { skyLightAt } from "#/scene/sun";

import { pixelsPerUnitAt } from "./cameraMath";

/** Where the haze starts and where it's whole, as multiples of the camera's distance to its target. */
const HAZE_STARTS = 1.1;
const HAZE_WHOLE = 3.5;
/** Beyond everything: the haze is there but reaches nothing (in the diorama). */
const NOWHERE = 1e7;

const target = new THREE.Vector3();

/** The weather's fog: grey-white, darkening with the night. */
const FOG_DAY = "#cdd3d9";
const FOG_NIGHT = "#252a33";

/**
 * Distance haze (Graphics: Distance haze, ADR-0077) and the weather's fog and
 * haze (ADR-0102), as the scene's one fog. The viewer's haze: in perspective,
 * things far from the camera fade into the sky's colour at the horizon,
 * thinner as it gets dark so the town's lights keep their light. The
 * weather's, in both views, measured from the camera's target across the
 * world (so the diorama fogs from its far side): haze far and pale, fog
 * nearer and thicker as it grows, grey. Whichever reaches nearest wins. The
 * fog stays on the scene while any of them is on and only moves out of reach
 * otherwise, so switching views never rebuilds the shaders.
 */
export const DistanceHaze = ({ viewerHaze }: { viewerHaze: boolean }) => {
	const scene = useThree((s) => s.scene);
	const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
	const fog = useMemo(() => new THREE.Fog("#ffffff", NOWHERE, NOWHERE), []);

	useEffect(() => {
		scene.fog = fog;
		return () => {
			if (scene.fog === fog) {
				scene.fog = null;
			}
		};
	}, [scene, fog]);

	useFrame(({ camera, size }) => {
		const { lighting, sky } = useEditor.getState().scene;
		const hours = sceneHoursNow();
		const weather = weatherNowInWorld();
		const look = skyLookAt(lighting, sky, hours, weather.overcast);
		const night = skyLightAt(lighting, hours).night;
		target.copy(controls?.target ?? target.set(0, 0, 0));
		const distance = camera.position.distanceTo(target);
		const perspective = camera instanceof THREE.PerspectiveCamera;
		// How deep the world in view is: the distance in perspective, what the screen covers in the diorama.
		const across = perspective
			? distance
			: size.height / Math.max(1, pixelsPerUnitAt(camera, target, size.height));
		let near = NOWHERE;
		let far = NOWHERE;
		let color = look.colorAtHorizon;
		if (viewerHaze && perspective) {
			// Thinner as it gets dark, so lit windows and lamps keep their light (and their glow).
			const thinning = 1 + 12 * night;
			near = distance * HAZE_STARTS * thinning;
			far = distance * HAZE_WHOLE * thinning;
		}
		if (weather.haze > 0) {
			const hazeNear = distance + across * (0.6 - 1.0 * weather.haze);
			if (hazeNear < near) {
				near = hazeNear;
				far = distance + across * (2.0 - 1.3 * weather.haze);
				color = mixColor(look.colorAtHorizon, "#f4ecdc", 0.5);
			}
		}
		if (weather.fog > 0) {
			const fogNear = distance + across * (0.3 - 1.7 * weather.fog);
			if (fogNear < near) {
				near = Math.max(0.1, fogNear);
				far = distance + across * (1.6 - 1.4 * weather.fog);
				color = mixColor(mixColor(FOG_DAY, FOG_NIGHT, night), look.colorAtHorizon, 0.25);
			}
		}
		fog.near = near;
		fog.far = Math.max(far, near + 0.5);
		fog.color.set(color);
	});

	return null;
};
