import { useEditor } from "#/editor/store";
import { getPart } from "#/parts/registry";
import { ROAD_STYLE_LABELS } from "#/scene/roads";
import type { TRoad } from "#/scene/schema";

import { Button } from "./Button";

import styles from "./DrawingBar.module.css";

const roadName = (road: TRoad) => road.name || ROAD_STYLE_LABELS[road.style];

/** A hint while dragging: what letting go does. */
const DragHint = ({ title, keys }: { title: string; keys: string }) => (
	<div className={styles.bar} role="status">
		<div className={styles.text}>
			<strong>{title}</strong>

			<span className={styles.keys}>{keys}</span>
		</div>
	</div>
);

/**
 * While a vehicle is dragged: says what dropping it does. Once a parked one is
 * dropped on a road: asks whether it should drive along it. (A vehicle that was
 * already driving drives on along the road it's dropped on, without asking.)
 */
export const FollowOfferBar = () => {
	const offer = useEditor((s) => s.followOffer);
	const preview = useEditor((s) => s.routePreview);
	const rerouting = useEditor((s) => s.rerouting);
	const roads = useEditor((s) => s.scene.roads);
	const entity = useEditor((s) =>
		offer ? (s.scene.entities.find((e) => e.id === offer.entityId) ?? null) : null,
	);

	const road = roads.find((r) => r.id === (preview ?? offer)?.roadId);
	if (rerouting) {
		return road ? (
			<DragHint
				title={`Drop it on “${roadName(road)}”`}
				keys="It drives on from here · Alt: park it"
			/>
		) : (
			<DragHint title="Drop it here to park it" keys="Or drop it on a road to keep it driving" />
		);
	}
	if (!road) {
		return null;
	}
	if (preview) {
		return (
			<DragHint
				title={`Drop it on “${roadName(road)}”`}
				keys="You can then make it drive along the road · Alt: place it freely"
			/>
		);
	}

	// The offer lapses once the vehicle is gone, already driving, or moved elsewhere.
	if (
		!offer ||
		!entity ||
		entity.follow ||
		entity.position[0] !== offer.position[0] ||
		entity.position[1] !== offer.position[1]
	) {
		return null;
	}
	const vehicle = entity.name || getPart(entity.kind)?.name.toLowerCase() || "vehicle";

	return (
		<div className={styles.bar} role="status">
			<div className={styles.text}>
				<strong>Drive along “{roadName(road)}”?</strong>

				<span>The {vehicle} will follow the road’s route from here, the way the arrows point.</span>
			</div>

			<div className={styles.actions}>
				<Button onClick={() => useEditor.getState().setFollowOffer(null)}>Keep parked</Button>

				<Button variant="primary" onClick={() => useEditor.getState().acceptFollowOffer()}>
					Drive along
				</Button>
			</div>
		</div>
	);
};
