import { useEffect, useState } from "react";

import { useCameraFeel } from "#/editor/cameraFeel";
import { flyingSpeed } from "#/editor/keyboardCamera";
import { useEditor } from "#/editor/store";
import { partNameOf } from "#/parts/registry";
import { liveCamera } from "#/render/liveCamera";
import { currentView, sameView } from "#/render/viewpoints";

import { viewpointName } from "./ViewpointsSection";

import styles from "./ViewLabel.module.css";

/** How often the label checks what the camera shows (ms). */
const CHECK_MS = 250;

/** What the camera shows, in a few words: its kind, field of view, and the viewpoint it's at. */
const describeView = () => {
	const { scene, cameraFollow, holdingRightButton } = useEditor.getState();
	const parts = [
		liveCamera.fieldOfView === null
			? "Diorama view"
			: `Perspective view · ${Math.round(liveCamera.fieldOfView)}°`,
	];
	if (cameraFollow) {
		const entity = scene.entities.find((e) => e.id === cameraFollow.entityId);
		const name = (entity && (entity.name || partNameOf(entity.kind))) || "a vehicle";
		parts.push(cameraFollow.ride ? `riding along with ${name}` : `following ${name}`);
	} else {
		const pose = currentView.read?.();
		const index = pose
			? scene.viewpoints.findIndex((v) => sameView(pose, v, scene.camera.fieldOfView))
			: -1;
		if (index >= 0) {
			parts.push(viewpointName(scene.viewpoints[index], index));
		}
	}
	// Flying: how fast, which scrolling changes.
	if (holdingRightButton) {
		parts.push(`flying at ${Math.round(flyingSpeed.factor * 100) / 100}× (scroll to change)`);
	}
	return parts.join(" · ");
};

/**
 * A quiet line in the bottom-left corner of the view in Edit mode saying what
 * the camera shows (ADR-0062), like Blender's "User Perspective": "Perspective
 * view · 40° · Downtown". It checks a few times a second rather than every
 * frame, and only re-renders when the words change.
 */
export const ViewLabel = () => {
	const shown = useCameraFeel().viewLabel;
	const editing = useEditor((s) => s.mode === "edit");
	const inset = useEditor((s) => s.viewInset);
	const [text, setText] = useState("");

	useEffect(() => {
		if (!shown || !editing) {
			return;
		}
		const check = () => setText(describeView());
		check();
		const timer = setInterval(check, CHECK_MS);
		return () => clearInterval(timer);
	}, [shown, editing]);

	if (!shown || !editing || !text) {
		return null;
	}
	return (
		<div className={styles.label} style={{ bottom: inset + 12 }} aria-live="off">
			{text}
		</div>
	);
};
