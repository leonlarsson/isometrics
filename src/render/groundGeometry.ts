import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { groundOutlineOf } from "#/scene/groundShape";
import type { TGround } from "#/scene/schema";

/** The slab's thickness under the ground's top, and how soft its top edge is (the rectangle's rounding). */
const THICKNESS = 1;
const SOFT_EDGE = 0.3;

/**
 * The slab of a shaped ground (ADR-0155): its outline extruded down from the
 * top at y 0, its top edge softened as the rectangle's is. Plain three.
 */
export const groundSlabGeometry = (outline: readonly (readonly [number, number])[]) => {
	// In the shape's plane, x across and −z up, so turning it flat puts each corner back at [x, z].
	const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
	const made = new THREE.ExtrudeGeometry(shape, {
		depth: THICKNESS - SOFT_EDGE * 2,
		bevelEnabled: true,
		bevelThickness: SOFT_EDGE,
		bevelSize: SOFT_EDGE,
		// The sides on the outline itself, the bevel rounding in from it.
		bevelOffset: -SOFT_EDGE,
		bevelSegments: 3,
		curveSegments: 1,
	});
	made.rotateX(-Math.PI / 2);
	made.computeBoundingBox();
	made.translate(0, -(made.boundingBox?.max.y ?? 0), 0);
	return made;
};

/**
 * The geometry a ground's slab is drawn with: null for the plain rectangle,
 * which keeps its rounded box exactly as it always was.
 */
export const useGroundSlab = (
	ground: Pick<TGround, "width" | "depth" | "points" | "cornerRadius">,
) => {
	const outline = groundOutlineOf(ground);
	// The outline as a key: a new geometry only when the shape changes.
	const key = outline ? outline.map(([x, z]) => `${x},${z}`).join(";") : "";
	const geometry = useMemo(() => (outline ? groundSlabGeometry(outline) : null), [key]);
	useEffect(() => () => geometry?.dispose(), [geometry]);
	return geometry;
};

/**
 * The grid's own geometry on a shaped ground: its outline, flat, in the plane
 * drei's Grid draws from (x across, its y becoming the world's z), so the grid
 * covers the ground and not the empty corners of the rectangle round it. Null
 * for the plain rectangle, whose grid is the Grid's own plane as always.
 */
export const useGroundGridGeometry = (
	ground: Pick<TGround, "width" | "depth" | "points" | "cornerRadius">,
) => {
	const outline = groundOutlineOf(ground);
	const key = outline ? outline.map(([x, z]) => `${x},${z}`).join(";") : "";
	const geometry = useMemo(
		() =>
			outline
				? new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z))))
				: null,
		[key],
	);
	useEffect(() => () => geometry?.dispose(), [geometry]);
	return geometry;
};
