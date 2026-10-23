import type * as THREE from "three";

/**
 * Bridges 3D label anchors (inside the Canvas) and DOM label cards (outside
 * it). Both sides register by entity id; LabelProjector writes each card's
 * screen position every frame without re-rendering React.
 * See docs/adr/0008-dom-label-layer.md.
 */
export const labelAnchors = new Map<string, THREE.Object3D>();
export const labelElements = new Map<string, HTMLElement>();

export const registerLabelAnchor = (id: string, object: THREE.Object3D | null) => {
	if (object) {
		labelAnchors.set(id, object);
	} else {
		labelAnchors.delete(id);
	}
};

export const registerLabelElement = (id: string, element: HTMLElement | null) => {
	if (element) {
		labelElements.set(id, element);
	} else {
		labelElements.delete(id);
	}
};

/**
 * Screen area (canvas pixels) covered by the transform gizmo, written by the
 * gizmo every frame. Label cards over it fade and let the pointer through, so
 * a card never hides the handle underneath it.
 */
export const gizmoArea = { active: false, left: 0, top: 0, right: 0, bottom: 0 };

/**
 * Passes a touch that starts on a label card on to the camera, set by
 * CameraControls while it's mounted. Cards sit over the canvas, so their
 * touches never reach it: a pinch or drag on one would zoom or scroll the
 * page instead of the world.
 */
export const cardTouchHandover: { current: ((event: PointerEvent) => void) | null } = {
	current: null,
};
