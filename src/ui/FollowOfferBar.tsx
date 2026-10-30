import { useEditor } from "#/editor/store";
import { partNameOf } from "#/parts/registry";
import { ROAD_KIND_LABELS } from "#/scene/roads";
import type { TRoad } from "#/scene/schema";

import { Button } from "./Button";

import styles from "./DrawingBar.module.css";

export const roadName = (road: TRoad) => road.name || ROAD_KIND_LABELS[road.kind];

/**
 * While a vehicle is being moved by hand: the road it's snapped onto (if any),
 * and whether it was driving (then letting go off the roads parks it).
 */
export const useRouteHint = () => {
	const roadId = useEditor((s) => s.routePreview?.roadId ?? null);
	const rerouting = useEditor((s) => s.rerouting);
	const road = useEditor((s) =>
		roadId ? (s.scene.roads.find((r) => r.id === roadId) ?? null) : null,
	);
	return road || rerouting ? { road, rerouting } : null;
};

/** A hint while dragging: what letting go does. */
const DragHint = ({ title, keys }: { title: string; keys: string }) => (
	<div className={styles.bar} data-label-obstacle="" role="status">
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
	const roads = useEditor((s) => s.scene.roads);
	const entity = useEditor((s) =>
		offer ? (s.scene.entities.find((e) => e.id === offer.entityId) ?? null) : null,
	);
	const hint = useRouteHint();
	// A keyboard move (G) says this in its own bar.
	const transforming = useEditor((s) => s.transform !== null);

	if (hint) {
		if (transforming) {
			return null;
		}
		const { road, rerouting } = hint;
		if (!road) {
			return (
				<DragHint title="Drop it here to park it" keys="Or drop it on a road to keep it driving" />
			);
		}
		return (
			<DragHint
				title={`Drop it on “${roadName(road)}”`}
				keys={
					rerouting
						? "It drives on from here · Alt: park it"
						: "You can then make it drive along the road · Alt: place it freely"
				}
			/>
		);
	}
	const road = roads.find((r) => r.id === offer?.roadId);
	if (!road) {
		return null;
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
	const vehicle = entity.name || partNameOf(entity.kind)?.toLowerCase() || "vehicle";

	return (
		<div className={styles.bar} data-label-obstacle="" role="status">
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
