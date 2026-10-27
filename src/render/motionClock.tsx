import { useFrame } from "@react-three/fiber";

import { useEditor } from "#/editor/store";
import { motionClock } from "#/lib/motionClock";

/** Moves the motion clock while motion plays. Mount once in the scene. */
export const MotionClockStep = () => {
	const playing = useEditor((s) => s.playing);
	// Before anything that reads it this frame.
	useFrame((_, delta) => {
		if (playing) {
			motionClock.seconds += Math.min(delta, 0.1);
		}
	}, -2);
	return null;
};
