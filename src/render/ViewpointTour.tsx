import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

import { runningCameraMoves } from "#/editor/keyboardCamera";
import { readPreferences } from "#/editor/preferences";
import { useEditor } from "#/editor/store";
import { type ITourClock, startTourClock, tickTour } from "#/editor/viewpointTour";

/** What the camera was last asked to do, so a request that isn't the tour's own stops it. */
interface ICameraRequests {
	flight: number;
	view: number;
}

const requestsNow = (): ICameraRequests => {
	const { flight, viewNonce } = useEditor.getState();
	return { flight: flight?.nonce ?? 0, view: viewNonce };
};

/**
 * The tour (`runningTour` in the store, ADR-0139): in View mode it glides to
 * each viewpoint in turn with goToViewpoint (so a viewpoint's mood comes too),
 * holds there for the world's `camera.tour.holdSeconds` and moves on, round and
 * round. Any camera input stops it: a press or scroll on the view, a camera
 * key, following a vehicle, or any other move of the camera (a viewpoint gone
 * to by hand, re-centring), which shows as a request it didn't make.
 */
export const ViewpointTour = () => {
	const element = useThree(
		(s) => (s.events.connected as HTMLElement | undefined) ?? s.gl.domElement,
	);
	const running = useEditor((s) => s.runningTour);
	const clock = useRef<ITourClock | null>(null);
	const ownRequests = useRef<ICameraRequests>({ flight: 0, view: 0 });

	useEffect(() => {
		clock.current = null;
		if (!running) {
			return;
		}
		const stop = () => useEditor.getState().stopTour();
		element.addEventListener("pointerdown", stop);
		element.addEventListener("wheel", stop, { passive: true });
		return () => {
			element.removeEventListener("pointerdown", stop);
			element.removeEventListener("wheel", stop);
		};
	}, [running, element]);

	useFrame(() => {
		if (!running) {
			return;
		}
		const state = useEditor.getState();
		// Not before the world is on screen: its opening view is the first stop's hold.
		if (state.openingWorld !== null) {
			return;
		}
		const { viewpoints } = state.scene;
		const requests = requestsNow();
		if (
			state.mode !== "view" ||
			viewpoints.length < 2 ||
			state.cameraFollow !== null ||
			runningCameraMoves.size > 0 ||
			(clock.current &&
				(requests.flight !== ownRequests.current.flight ||
					requests.view !== ownRequests.current.view))
		) {
			state.stopTour();
			return;
		}
		const now = performance.now() / 1000;
		const { holdSeconds } = state.scene.camera.tour;
		const index = viewpoints.findIndex((v) => v.id === state.activeViewpointId);
		clock.current ??= startTourClock(index, now, { holdsFirst: running.holdsFirst, holdSeconds });
		const tick = tickTour(clock.current, now, {
			count: viewpoints.length,
			glideSeconds: readPreferences().glideSeconds,
			holdSeconds,
		});
		clock.current = tick.clock;
		if (tick.goesTo !== null) {
			state.goToViewpoint(viewpoints[tick.goesTo].id);
		}
		ownRequests.current = requestsNow();
	});

	return null;
};
