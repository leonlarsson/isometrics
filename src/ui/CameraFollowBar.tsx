import { useEditor } from "#/editor/store";
import { partNameOf } from "#/parts/registry";

import { Button } from "./Button";
import { Kbd } from "./fields";

import styles from "./DrawingBar.module.css";

/** While the camera follows or rides along with a vehicle: says which, and how to stop. */
export const CameraFollowBar = () => {
	const follow = useEditor((s) => s.cameraFollow);
	const entity = useEditor((s) =>
		follow ? (s.scene.entities.find((e) => e.id === follow.entityId) ?? null) : null,
	);
	if (!follow || !entity) {
		return null;
	}
	const name = entity.name || partNameOf(entity.kind) || "vehicle";
	const store = () => useEditor.getState();

	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<div className={styles.text}>
				<strong>{follow.ride ? `Riding along with “${name}”` : `Following “${name}”`}</strong>

				<span className={styles.keys}>
					{follow.ride ? "Any click or scroll hands the camera back" : "Drag to pan hands it back"}{" "}
					· <Kbd>Esc</Kbd> stops
				</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={() => store().followWithCamera(entity.id, !follow.ride)}>
					{follow.ride ? "Follow from here" : "Ride along"}
				</Button>

				<Button variant="primary" onClick={() => store().stopFollowing()}>
					Stop
				</Button>
			</div>
		</div>
	);
};

/** Buttons that start following a vehicle with the camera (inspector and View mode's details). */
export const CameraFollowButtons = ({ entityId }: { entityId: string }) => {
	const store = () => useEditor.getState();
	return (
		<>
			<Button size="sm" icon="focus" onClick={() => store().followWithCamera(entityId, false)}>
				Follow with the camera
			</Button>

			<Button size="sm" icon="perspective" onClick={() => store().followWithCamera(entityId, true)}>
				Ride along
			</Button>
		</>
	);
};
