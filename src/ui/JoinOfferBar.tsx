import { useEditor } from "#/editor/store";
import { roadNameOf } from "#/scene/roads";

import { Button } from "./Button";

import styles from "./DrawingBar.module.css";

/** Shown after a dragged road end snaps onto another road end: offers to join them. */
export const JoinOfferBar = () => {
	const offer = useEditor((s) => s.joinOffer);
	const roads = useEditor((s) => s.scene.roads);
	if (!offer) {
		return null;
	}
	const a = roads.find((r) => r.id === offer.aId);
	const b = roads.find((r) => r.id === offer.bId);
	if (!a || !b) {
		return null;
	}
	const sameRoad = a.id === b.id;

	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<div className={styles.text}>
				<strong>These road ends touch</strong>

				<span>
					{sameRoad
						? `Join the two ends of “${roadNameOf(a)}” into a loop?`
						: `Join “${roadNameOf(a)}” and “${roadNameOf(b)}” into one road?`}
				</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={() => useEditor.getState().setJoinOffer(null)}>Keep separate</Button>

				<Button
					variant="primary"
					onClick={() =>
						useEditor.getState().joinRoads(offer.aId, offer.aEnd, offer.bId, offer.bEnd)
					}
				>
					Join
				</Button>
			</div>
		</div>
	);
};
