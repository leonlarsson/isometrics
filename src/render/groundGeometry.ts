import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { groundOutlineOf } from "#/scene/groundShape";
import type { TGround } from "#/scene/schema";

/** How soft a slab's top edge is (the rectangle's rounding), at most. */
const SOFT_EDGE = 0.3;

/**
 * The slab of a shaped ground (ADR-0155): its outline extruded `thickness`
 * down from its top at y 0, its top edge softened as the rectangle's is.
 * Plain three. (Terrain later: its top would be a surface of heights.)
 */
export const groundSlabGeometry = (
	outline: readonly (readonly [number, number])[],
	thickness: number,
) => {
	const soft = Math.min(SOFT_EDGE, thickness / 2 - 0.01);
	// In the shape's plane, x across and −z up, so turning it flat puts each corner back at [x, z].
	const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
	const made = new THREE.ExtrudeGeometry(shape, {
		depth: thickness - soft * 2,
		bevelEnabled: true,
		bevelThickness: soft,
		bevelSize: soft,
		// The sides on the outline itself, the bevel rounding in from it.
		bevelOffset: -soft,
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
	ground: Pick<TGround, "width" | "depth" | "points" | "cornerRadius" | "thickness">,
) => {
	const outline = groundOutlineOf(ground);
	// The outline as a key: a new geometry only when the shape or thickness changes.
	const key = outline
		? `${ground.thickness}|${outline.map(([x, z]) => `${x},${z}`).join(";")}`
		: "";
	const geometry = useMemo(
		() => (outline ? groundSlabGeometry(outline, ground.thickness) : null),
		[key],
	);
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
