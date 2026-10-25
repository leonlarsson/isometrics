import { useEffect, useState } from "react";

import { flyingSpeed, runningCameraMoves } from "#/editor/keyboardCamera";
import { overlayShownIn, usePreferences } from "#/editor/preferences";
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
			? "Isometric diorama"
			: `Perspective · ${Math.round(liveCamera.fieldOfView)}°`,
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
 * A quiet line in the bottom-left corner of the view saying what the camera
 * shows (ADR-0062), like Blender's "User Perspective": "Perspective · 40°
 * · Downtown", and how fast you fly. Always in Edit mode; in View mode, which
 * is for looking, only while you move with the keys or fly, fading out a
 * moment after. It checks a few times a second rather than every frame, and
 * only re-renders when the words change.
 */
/** In View mode, how long the label stays after the keys last moved the camera (ms). */
const VIEW_MODE_LINGER_MS = 2000;

export const ViewLabel = () => {
	const place = usePreferences().viewLabel;
	const shown = place !== "off";
	const mode = useEditor((s) => s.mode);
	const inset = useEditor((s) => s.viewInset);
	const [text, setText] = useState("");
	// In View mode only while moving with the keys or flying, and a moment after.
	const [moving, setMoving] = useState(false);

	useEffect(() => {
		if (!shown) {
			return;
		}
		let lastMoved = 0;
		const check = () => {
			const now = performance.now();
			if (runningCameraMoves.size > 0 || useEditor.getState().holdingRightButton) {
				lastMoved = now;
			}
			setMoving(now - lastMoved < VIEW_MODE_LINGER_MS);
			setText(describeView());
		};
		check();
		const timer = setInterval(check, CHECK_MS);
		return () => clearInterval(timer);
	}, [shown]);

	// Where it's set to show, always; elsewhere (but not when off) while you move with the keys.
	const visible = overlayShownIn(place, mode) || moving;
	if (!shown || !text) {
		return null;
	}
	return (
		<div
			className={styles.label}
			style={{ bottom: inset + 12 }}
			data-hidden={!visible || undefined}
			aria-live="off"
		>
			{text}
		</div>
	);
};
