import * as THREE from "three";

import { shareGeometryAs } from "../primitives";

/**
 * Pieces the boats share (ADR-0050's kits): a hull seen from above with a square
 * stern and a pointed bow towards +X, `height` deep, standing on the water.
 */
export const boatHullGeometry = (length: number, width: number, height: number) => {
	const shape = new THREE.Shape();
	shape.moveTo(-length / 2, -width / 2);
	shape.lineTo(length * 0.2, -width / 2);
	shape.quadraticCurveTo(length * 0.45, -width / 2, length / 2, 0);
	shape.quadraticCurveTo(length * 0.45, width / 2, length * 0.2, width / 2);
	shape.lineTo(-length / 2, width / 2);
	shape.closePath();
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
	// Extruded along +Z; turn it so the extrusion goes up and the outline lies on the ground.
	geometry.rotateX(-Math.PI / 2);
	geometry.computeVertexNormals();
	return shareGeometryAs(geometry, `boatHull:${length},${width},${height}`);
};
