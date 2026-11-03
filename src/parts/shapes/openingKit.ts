import * as THREE from "three";
import { z } from "zod";

/**
 * A flat outline seen from the front with an opening through it (a door, a
 * window, an arch), made solid by its thickness: the Panel and the Arch.
 */

export const OPENINGS = [
	{ value: "none", label: "None" },
	{ value: "door", label: "Door" },
	{ value: "window", label: "Window" },
	{ value: "roundWindow", label: "Round window" },
	{ value: "arch", label: "Arch" },
] as const;

export type TOpening = (typeof OPENINGS)[number]["value"];

export const OpeningSchema = z
	.enum(OPENINGS.map((o) => o.value) as [TOpening, ...TOpening[]])
	.default("none");

export interface IOpeningOutline {
	width: number;
	height: number;
	opening: TOpening;
	openingWidth: number;
	openingHeight: number;
}

/** The edge kept round an opening at least, so it holds together. */
const MARGIN = 0.05;

/** The outline from the front, its opening cut out (a door or an arch from the ground up). */
const outlineWithOpening = (p: IOpeningOutline) => {
	const half = p.width / 2;
	const openWidth = Math.min(p.openingWidth, p.width - 2 * MARGIN);
	const open = openWidth / 2;
	const reachesGround = p.opening === "door" || p.opening === "arch";
	const openHeight = Math.min(p.openingHeight, p.height - (reachesGround ? MARGIN : 2 * MARGIN));
	const shape = new THREE.Shape();
	shape.moveTo(-half, 0);
	if (reachesGround) {
		shape.lineTo(-open, 0);
		if (p.opening === "arch") {
			// Straight sides up to where the round top begins (at least at the ground).
			const spring = Math.max(0, openHeight - open);
			const rise = openHeight - spring;
			shape.lineTo(-open, spring);
			shape.absellipse(0, spring, open, rise, Math.PI, 0, true, 0);
		} else {
			shape.lineTo(-open, openHeight);
			shape.lineTo(open, openHeight);
		}
		shape.lineTo(open, 0);
	}
	shape.lineTo(half, 0);
	shape.lineTo(half, p.height);
	shape.lineTo(-half, p.height);
	shape.closePath();
	// A window sits in the middle of the height.
	const middle = p.height / 2;
	if (p.opening === "window") {
		const hole = new THREE.Path();
		hole.moveTo(-open, middle - openHeight / 2);
		hole.lineTo(open, middle - openHeight / 2);
		hole.lineTo(open, middle + openHeight / 2);
		hole.lineTo(-open, middle + openHeight / 2);
		hole.closePath();
		shape.holes.push(hole);
	} else if (p.opening === "roundWindow") {
		const hole = new THREE.Path();
		hole.absellipse(0, middle, open, openHeight / 2, 0, Math.PI * 2, false, 0);
		shape.holes.push(hole);
	}
	return shape;
};

/** The outline made solid, `thickness` deep and centred front to back; curves in `curveSides` pieces. */
export const openingGeometry = (p: IOpeningOutline, thickness: number, curveSides = 16) => {
	const geometry = new THREE.ExtrudeGeometry(outlineWithOpening(p), {
		depth: thickness,
		bevelEnabled: false,
		curveSegments: curveSides,
	});
	geometry.translate(0, 0, -thickness / 2);
	geometry.computeVertexNormals();
	return geometry;
};

/** A key for such a geometry from everything it depends on. */
export const openingKey = (name: string, p: IOpeningOutline, thickness: number, curveSides = 16) =>
	`shape:${name}:${p.width},${p.height},${thickness},${p.opening},${p.openingWidth},${p.openingHeight},${curveSides}`;
