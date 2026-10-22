import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useEditor } from "#/editor/store";
import { usePalette } from "#/editor/useTheme";
import { getPart, resolveColors, resolveProps } from "#/parts/registry";
import type { TVec2 } from "#/scene/schema";

import { SelectionFrame } from "./EntityNode";
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

const Ghost = ({ kind, point }: { kind: string; point: TVec2 }) => {
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
		<group position={[point[0], 0, point[1]]}>
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
 * outside the viewport, Esc or leaving the window cancels.
 */
export const PlacementPreview = () => {
	const kind = useEditor((s) => s.placingKind);
	const camera = useThree((s) => s.camera);
	const canvas = useThree((s) => s.gl.domElement);
	const [point, setPoint] = useState<TVec2 | null>(null);

	useEffect(() => {
		if (!kind) {
			return;
		}
		const { stopPlacing } = useEditor.getState();

		const pointAt = (event: PointerEvent): TVec2 | null => {
			const rect = canvas.getBoundingClientRect();
			const x = (event.clientX - rect.left) / rect.width;
			const y = (event.clientY - rect.top) / rect.height;
			if (x < 0 || x > 1 || y < 0 || y > 1) {
				return null;
			}
			pointer.set(x * 2 - 1, -(y * 2 - 1));
			raycaster.setFromCamera(pointer, camera);
			return groundPointOnRay(raycaster.ray, event.altKey);
		};

		const onMove = (event: PointerEvent) => {
			// The button was released outside the window, so no pointerup arrived.
			if (event.buttons === 0) {
				stopPlacing();
				return;
			}
			const next = pointAt(event);
			setPoint((prev) =>
				prev && next && prev[0] === next[0] && prev[1] === next[1] ? prev : next,
			);
		};

		const onUp = (event: PointerEvent) => {
			const at = pointAt(event);
			stopPlacing();
			if (at) {
				useEditor.getState().addEntity({ kind, name: "", position: at });
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
			setPoint(null);
		};
	}, [kind, camera, canvas]);

	if (!kind || !point) {
		return null;
	}
	return <Ghost key={kind} kind={kind} point={point} />;
};
