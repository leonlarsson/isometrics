import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { toRadians } from "#/lib/math";
import { getPart, resolveColors, resolveProps } from "#/parts/registry";
import type { TVec2 } from "#/scene/schema";

import { SelectionFrame } from "./EntityNode";
import { findRouteDrop } from "./routeDrop";
import { groundPointOnRay } from "./useGroundDrag";

const GHOST_OPACITY = 0.6;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/** Fade every material under `group` so the preview reads as "not placed yet". */
const makeTranslucent = (group: THREE.Object3D) => {
	group.traverse((object) => {
		if (!(object instanceof THREE.Mesh)) {
			return;
		}
		object.castShadow = false;
		const materials: THREE.Material[] = Array.isArray(object.material)
			? object.material
			: [object.material];
		for (const material of materials) {
			material.transparent = true;
			material.opacity *= GHOST_OPACITY;
			material.needsUpdate = true;
		}
	});
};

/** Where the dragged part would land: on the ground, or parked on a road (vehicles). */
interface IPlacement {
	point: TVec2;
	elevation: number;
	rotation: number;
}

const samePlacement = (a: IPlacement | null, b: IPlacement | null) =>
	a === b ||
	(a !== null &&
		b !== null &&
		a.point[0] === b.point[0] &&
		a.point[1] === b.point[1] &&
		a.elevation === b.elevation &&
		a.rotation === b.rotation);

const Ghost = ({ kind, placement }: { kind: string; placement: IPlacement }) => {
	const palette = usePalette();
	const group = useRef<THREE.Group>(null);
	const part = getPart(kind);

	useLayoutEffect(() => {
		if (group.current) {
			makeTranslucent(group.current);
		}
	}, [kind]);

	if (!part) {
		return null;
	}
	const props = resolveProps(part, {});
	const { color, accent } = resolveColors(part, { color: null, accent: null }, palette);
	const Component = part.Component;

	return (
		<group
			position={[placement.point[0], placement.elevation, placement.point[1]]}
			rotation={[0, toRadians(placement.rotation), 0]}
		>
			<group ref={group}>
				<Component props={props} color={color} accent={accent} palette={palette} playing={false} />
			</group>

			<SelectionFrame size={part.footprint(props)} color={palette.selection} dashed />
		</group>
	);
};

/**
 * While a part is dragged from the palette (`placingKind`), shows it under the
 * cursor, snapped to the grid, and adds it where it's dropped. Releasing
 * outside the viewport, Esc or leaving the window cancels. A vehicle over a
 * road parks in its lane, facing the way it would drive, and once dropped the
 * editor asks whether it should drive along the road (Alt places it freely).
 */
export const PlacementPreview = () => {
	const kind = useEditor((s) => s.placingKind);
	const camera = useThree((s) => s.camera);
	const canvas = useThree((s) => s.gl.domElement);
	const [placement, setPlacement] = useState<IPlacement | null>(null);

	useEffect(() => {
		if (!kind) {
			return;
		}
		const { stopPlacing, setRoutePreview } = useEditor.getState();
		const part = getPart(kind);
		const vehicleLength = part?.canFollowPath ? part.footprint(resolveProps(part, {}))[0] : 0;

		const placeAt = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			const x = (event.clientX - rect.left) / rect.width;
			const y = (event.clientY - rect.top) / rect.height;
			if (x < 0 || x > 1 || y < 0 || y > 1) {
				return null;
			}
			pointer.set(x * 2 - 1, -(y * 2 - 1));
			raycaster.setFromCamera(pointer, camera);
			const drop =
				part?.canFollowPath && !event.altKey
					? findRouteDrop(raycaster.ray, { vehicleLength })
					: null;
			if (drop) {
				const placement: IPlacement = {
					point: drop.position,
					elevation: drop.height,
					rotation: drop.rotation,
				};
				return { placement, drop };
			}
			const point = groundPointOnRay(raycaster.ray, event.altKey);
			return point ? { placement: { point, elevation: 0, rotation: 0 }, drop: null } : null;
		};

		const onMove = (event: PointerEvent) => {
			// The button was released outside the window, so no pointerup arrived.
			if (event.buttons === 0) {
				stopPlacing();
				return;
			}
			const next = placeAt(event);
			setPlacement((prev) =>
				samePlacement(prev, next?.placement ?? null) ? prev : (next?.placement ?? null),
			);
			const preview = useEditor.getState().routePreview;
			const drop = next?.drop ?? null;
			if (preview?.roadId !== drop?.roadId || preview?.reverse !== drop?.reverse) {
				setRoutePreview(drop && { roadId: drop.roadId, reverse: drop.reverse });
			}
		};

		const onUp = (event: PointerEvent) => {
			const at = placeAt(event);
			stopPlacing();
			if (!at) {
				return;
			}
			const { point, elevation, rotation } = at.placement;
			const state = useEditor.getState();
			const id = state.addEntity({ kind, name: "", position: point, elevation, rotation });
			if (at.drop) {
				const { roadId, offset, reverse } = at.drop;
				state.setFollowOffer({ entityId: id, roadId, offset, reverse, position: point });
			}
		};

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("blur", stopPlacing);
		document.body.style.cursor = "grabbing";
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("blur", stopPlacing);
			document.body.style.cursor = "";
			setRoutePreview(null);
			setPlacement(null);
		};
	}, [kind, camera, canvas]);

	if (!kind || !placement) {
		return null;
	}
	return <Ghost key={kind} kind={kind} placement={placement} />;
};
