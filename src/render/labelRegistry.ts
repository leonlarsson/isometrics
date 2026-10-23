import type * as THREE from "three";

/**
 * Bridges 3D label anchors (inside the Canvas) and DOM label cards (outside
 * it). Both sides register by entity id; LabelProjector writes each card's
 * screen position every frame without re-rendering React.
 * See docs/adr/0008-dom-label-layer.md.
 */
export const labelAnchors = new Map<string, THREE.Object3D>();
export const labelElements = new Map<string, HTMLElement>();
/** The pin on top of each labelled object, where its leader line starts. */
export const labelPins = new Map<string, THREE.Object3D>();
/** Each card's leader line, drawn in screen space so it follows a card that moved aside. */
export const labelLeaders = new Map<string, SVGLineElement>();
/** Measured sizes (px) of each card and of its chip; kept from the last time each was shown. */
export const labelSizes = new Map<
	string,
	{ card?: { width: number; height: number }; chip?: { width: number; height: number } }
>();

/** Add `value` under `id`, or remove it when null: the shape every registration here takes. */
const register =
	<T>(map: Map<string, T>) =>
	(id: string, value: T | null) => {
		if (value) {
			map.set(id, value);
		} else {
			map.delete(id);
		}
	};

export const registerLabelPin = register(labelPins);
export const registerLabelLeader = register(labelLeaders);

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
 * Passes a press or wheel that starts on a label card on to the camera, set by
 * CameraControls while it's mounted. Cards sit over the canvas, so their events
 * never reach it: a drag, pinch or scroll on one would do nothing, or move the
 * page instead of the world.
 */
export const cardEventHandover: {
	current: ((event: PointerEvent | WheelEvent) => void) | null;
} = {
	current: null,
};
