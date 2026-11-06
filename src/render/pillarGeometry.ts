import * as THREE from "three";

import type { IPillar } from "#/scene/pillars";
import { DECK_THICKNESS } from "#/scene/roads";
import type { TPillarKind } from "#/scene/schema";

/**
 * A road's pillars as one geometry (ADR-0148): every pillar's pieces in the deck's colour, so a
 * viaduct of dozens of pillars is one draw, not one a pillar. The post is exactly the square post
 * pillars always were; the other kinds turn with the road.
 */

/** The square post's side, as it always was. */
export const POST_SIZE = 0.45;

const unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const unitColumn = new THREE.CylinderGeometry(1, 1, 1, 16, 1).toNonIndexed();

/** Every pillar of a road, standing on the ground at `y` (its layer), as one geometry. */
export const pillarGeometry = (pillars: readonly IPillar[], kind: TPillarKind, y: number) => {
	const positions: number[] = [];
	const normals: number[] = [];
	const matrix = new THREE.Matrix4();
	const turn = new THREE.Quaternion();
	const up = new THREE.Vector3(0, 1, 0);
	const position = new THREE.Vector3();
	const size = new THREE.Vector3();
	const normalMatrix = new THREE.Matrix3();
	const vertex = new THREE.Vector3();
	/** A piece: the unit shape, scaled to [along, height, across], centred at along/across/up from the pillar, turned with it. */
	const piece = (
		shape: THREE.BufferGeometry,
		pillar: IPillar,
		turns: boolean,
		[along, height, across]: [number, number, number],
		[forward, middle, side]: [number, number, number],
	) => {
		const heading = turns ? pillar.heading : 0;
		const cos = Math.cos(heading);
		const sin = Math.sin(heading);
		turn.setFromAxisAngle(up, -heading);
		position.set(
			pillar.x + cos * forward - sin * side,
			y + middle,
			pillar.z + sin * forward + cos * side,
		);
		size.set(along, height, across);
		matrix.compose(position, turn, size);
		normalMatrix.getNormalMatrix(matrix);
		const shapePositions = shape.attributes.position;
		const shapeNormals = shape.attributes.normal;
		for (let i = 0; i < shapePositions.count; i++) {
			vertex.fromBufferAttribute(shapePositions, i).applyMatrix4(matrix);
			positions.push(vertex.x, vertex.y, vertex.z);
			vertex.fromBufferAttribute(shapeNormals, i).applyMatrix3(normalMatrix).normalize();
			normals.push(vertex.x, vertex.y, vertex.z);
		}
	};
	for (const pillar of pillars) {
		// From the ground to the deck's underside.
		const top = Math.max(0.1, pillar.height - DECK_THICKNESS);
		const across = pillar.halfWidth * 2;
		switch (kind) {
			case "column_01":
				piece(unitColumn, pillar, true, [0.28, top, 0.28], [0, top / 2, 0]);
				break;
			case "hammerhead_01": {
				const cap = Math.min(0.45, top * 0.35);
				piece(unitColumn, pillar, true, [0.34, top - cap, 0.34], [0, (top - cap) / 2, 0]);
				piece(unitBox, pillar, true, [0.6, cap, across * 0.86], [0, top - cap / 2, 0]);
				break;
			}
			case "pair_01": {
				const cap = Math.min(0.32, top * 0.3);
				const post = top - cap;
				for (const side of [-1, 1]) {
					piece(
						unitBox,
						pillar,
						true,
						[0.42, post, 0.42],
						[0, post / 2, side * pillar.halfWidth * 0.62],
					);
				}
				piece(unitBox, pillar, true, [0.48, cap, across * 0.62 + 0.5], [0, top - cap / 2, 0]);
				break;
			}
			case "wall_01":
				piece(unitBox, pillar, true, [0.34, top, across * 0.8], [0, top / 2, 0]);
				break;
			default:
				// The square post, square to the world as it always stood.
				piece(unitBox, pillar, false, [POST_SIZE, top, POST_SIZE], [0, top / 2, 0]);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	return geometry;
};
