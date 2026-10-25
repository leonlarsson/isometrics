import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

import { cameraMoved, rememberView, saveCameraNow } from "#/editor/cameraMemory";
import { openWorldId } from "#/editor/persistence";

import { currentView } from "./viewpoints";

interface IChangingControls {
	addEventListener: (type: "change", listener: () => void) => void;
	removeEventListener: (type: "change", listener: () => void) => void;
}

/** Stores where the camera is for the open world in this browser (editor/cameraMemory). */
const saveView = () => {
	const id = openWorldId();
	const pose = currentView.read?.();
	if (id && pose) {
		rememberView(id, pose);
	}
};

/**
 * Remembers where the camera is in the open world, once it has been still for
 * a moment and when the page closes, so reopening the world puts it back
 * there. See docs/adr/0062-camera-settings.md.
 */
export const CameraMemory = () => {
	const controls = useThree((s) => s.controls) as unknown as IChangingControls | null;

	useEffect(() => {
		if (!controls) {
			return;
		}
		const onChange = () => cameraMoved(saveView);
		controls.addEventListener("change", onChange);
		return () => controls.removeEventListener("change", onChange);
	}, [controls]);

	useEffect(() => {
		window.addEventListener("pagehide", saveCameraNow);
		return () => {
			window.removeEventListener("pagehide", saveCameraNow);
			saveCameraNow();
		};
	}, []);

	return null;
};
