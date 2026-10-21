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
