import { useEditor } from "#/editor/store";
import { FENCE_STYLE_LABELS } from "#/fences/registry";
import { roadNameOf } from "#/scene/roads";

import { Button } from "./Button";

import styles from "./DrawingBar.module.css";

/**
 * Shown after a dragged road end snaps onto another road end, or a fence end
 * onto another fence end (ADR-0133): offers to join them.
 */
export const JoinOfferBar = () => {
	const offer = useEditor((s) => s.joinOffer);
	const roads = useEditor((s) => s.scene.roads);
	const fences = useEditor((s) => s.scene.fences);
	if (!offer) {
		return null;
	}
	const isFence = offer.target === "fence";
	// The two ends' things, by name.
	const nameOf = (id: string) => {
		if (isFence) {
			const fence = fences.find((f) => f.id === id);
			return fence ? fence.name || FENCE_STYLE_LABELS[fence.kind] : null;
		}
		const road = roads.find((r) => r.id === id);
		return road ? roadNameOf(road) : null;
	};
	const [a, b] = [nameOf(offer.aId), nameOf(offer.bId)];
	if (a === null || b === null) {
		return null;
	}
	const what = isFence ? "fence" : "road";
	const sameThing = offer.aId === offer.bId;

	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<div className={styles.text}>
				<strong>{`These ${what} ends touch`}</strong>

				<span>
					{sameThing
						? `Join the two ends of “${a}” into a loop?`
						: `Join “${a}” and “${b}” into one ${what}?`}
				</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={() => useEditor.getState().setJoinOffer(null)}>Keep separate</Button>

				<Button
					variant="primary"
					onClick={() => {
						const store = useEditor.getState();
						if (isFence) {
							store.joinFences(offer.aId, offer.aEnd, offer.bId, offer.bEnd);
						} else {
							store.joinRoads(offer.aId, offer.aEnd, offer.bId, offer.bEnd);
						}
					}}
				>
					Join
				</Button>
			</div>
		</div>
	);
};
