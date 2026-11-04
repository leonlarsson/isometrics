import { useEditor } from "#/editor/store";
import { FENCE_STYLE_LABELS } from "#/fences/registry";
import { junctionIndexOf } from "#/scene/junctions";
import { roadNameOf } from "#/scene/roads";

import { Button } from "./Button";

import styles from "./DrawingBar.module.css";

/**
 * Shown after a dragged road end snaps onto another road end, or a fence end
 * onto another fence end (ADR-0133): offers to join them. Road ends can be
 * connected at a junction instead, and a road end dragged onto another road's
 * middle offers to connect there (ADR-0136).
 */
export const JoinOfferBar = () => {
	const offer = useEditor((s) => s.joinOffer);
	const roads = useEditor((s) => s.scene.roads);
	const fences = useEditor((s) => s.scene.fences);
	const junctions = useEditor((s) => s.scene.junctions);
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
	const middle = isFence ? undefined : offer.bMiddle;
	// The other end is already at a junction: it can only be connected into it.
	const atJunction = !isFence && !middle && junctionIndexOf(junctions, offer.bId, offer.bEnd) >= 0;
	const connect = () =>
		useEditor.getState().connectRoads(
			offer.aId,
			offer.aEnd,
			middle
				? {
						kind: "middle",
						roadId: offer.bId,
						segment: middle.segment,
						point: [middle.point[0], middle.point[1], 0],
					}
				: { kind: "end", roadId: offer.bId, end: offer.bEnd, point: [0, 0, 0] },
		);

	if (middle || atJunction) {
		return (
			<div className={styles.bar} data-label-obstacle="" role="status">
				<div className={styles.text}>
					<strong>{middle ? `Connect to “${b}” here?` : "Connect to the junction?"}</strong>

					<span>
						{middle
							? `“${b}” is cut in two at a junction, and vehicles drive on from one road to another.`
							: `“${a}” joins the junction, and vehicles drive on from one road to another.`}
					</span>
				</div>

				<div className={styles.actions}>
					<Button onClick={() => useEditor.getState().setJoinOffer(null)}>Keep separate</Button>

					<Button variant="primary" onClick={connect}>
						Connect
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
			<div className={styles.text}>
				<strong>{`These ${what} ends touch`}</strong>

				<span>
					{sameThing
						? `Join the two ends of “${a}” into a loop?`
						: isFence
							? `Join “${a}” and “${b}” into one ${what}?`
							: `Join “${a}” and “${b}” into one road, or connect them at a junction?`}
				</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={() => useEditor.getState().setJoinOffer(null)}>Keep separate</Button>

				{!isFence && !sameThing && <Button onClick={connect}>Connect</Button>}

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
