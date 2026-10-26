import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { sceneHoursNow } from "#/editor/dayClock";
import { useEditor } from "#/editor/store";
import { skyLookAt } from "#/scene/sky";
import { skyLightAt } from "#/scene/sun";

/** Where the haze starts and where it's whole, as multiples of the camera's distance to its target. */
const HAZE_STARTS = 1.1;
const HAZE_WHOLE = 3.5;
/** Beyond everything: the haze is there but reaches nothing (in the diorama). */
const NOWHERE = 1e7;

const target = new THREE.Vector3();

/**
 * Distance haze (Graphics: Distance haze, ADR-0077): in perspective, things
 * far from the camera fade into the sky's colour at the horizon for the time
 * of day, which gives the view depth; thinner as it gets dark, so the town's
 * lights keep their light. The fog stays on the scene while the
 * setting is on and only moves out of reach in the diorama, where everything
 * is about as far away, so switching views never rebuilds the shaders.
 */
export const DistanceHaze = () => {
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

	useFrame(({ camera }) => {
		if (!(camera instanceof THREE.PerspectiveCamera)) {
			fog.near = NOWHERE;
			fog.far = NOWHERE;
			return;
		}
		const { lighting, sky } = useEditor.getState().scene;
		const hours = sceneHoursNow();
		fog.color.set(skyLookAt(lighting, sky, hours).colorAtHorizon);
		target.copy(controls?.target ?? target.set(0, 0, 0));
		const distance = camera.position.distanceTo(target);
		// Thinner as it gets dark, so lit windows and lamps keep their light (and their glow).
		const thinning = 1 + 12 * skyLightAt(lighting, hours).night;
		fog.near = distance * HAZE_STARTS * thinning;
		fog.far = distance * HAZE_WHOLE * thinning;
	});

	return null;
};
