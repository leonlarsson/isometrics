import * as THREE from "three";

import type { TV3 } from "../primitives";

/**
 * One geometry for a whole building of many pieces (ADR-0143): boxes, roof
 * prisms and flat panes, each placed, turned about the vertical, sized and
 * coloured, merged into one flat-shaded geometry with a colour per vertex. A
 * row of old-town houses is then one mesh rather than a dozen per house,
 * drawn in one material (`vertexColors`, its colour white) and batched with
 * every other like it (ADR-0086). Plain three, no React: a part builds it once
 * per look and keeps it while its settings stay the same.
 */

/** A shape of size 1 as triangles: positions and normals, three numbers a corner. */
interface IUnitShape {
	positions: Float32Array;
	normals: Float32Array;
}

const unitOf = (geometry: THREE.BufferGeometry, keep: (normal: THREE.Vector3) => boolean) => {
	const flat = geometry.index ? geometry.toNonIndexed() : geometry;
	const position = flat.getAttribute("position");
	const normal = flat.getAttribute("normal");
	const positions: number[] = [];
	const normals: number[] = [];
	const n = new THREE.Vector3();
	for (let i = 0; i < position.count; i += 3) {
		n.fromBufferAttribute(normal, i);
		if (!keep(n)) {
			continue;
		}
		for (let k = i; k < i + 3; k++) {
			positions.push(position.getX(k), position.getY(k), position.getZ(k));
			normals.push(normal.getX(k), normal.getY(k), normal.getZ(k));
		}
	}
	return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
};

/** A box 1 across, centred on its position; without its bottom, which nobody sees. */
const UNIT_BOX = unitOf(new THREE.BoxGeometry(1, 1, 1), (normal) => normal.y > -0.5);

/** A roof prism, its ridge along X: a triangle 1 across (z) and 1 high, 1 long, standing on y = 0. */
const UNIT_PRISM = (() => {
	const shape = new THREE.Shape();
	shape.moveTo(-0.5, 0);
	shape.lineTo(0.5, 0);
	shape.lineTo(0, 1);
	shape.closePath();
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
	geometry.translate(0, 0, -0.5);
	geometry.rotateY(Math.PI / 2);
	geometry.computeVertexNormals();
	return unitOf(geometry, (normal) => normal.y > -0.5);
})();

/** A flat pane 1 across and 1 high, facing +Z, centred on its position. */
const UNIT_PANE = unitOf(new THREE.PlaneGeometry(1, 1), () => true);

export interface IPiece {
	/** Where it stands: a box's or a pane's middle, a prism's base. */
	at: TV3;
	size: TV3;
	color: string;
	/** Turned about the vertical, in radians (a prism's ridge along Z at a quarter turn). */
	turn?: number;
}

/** Collects pieces, then makes them one geometry. */
export const createPieces = () => {
	const positions: number[] = [];
	const normals: number[] = [];
	const colors: number[] = [];
	const matrix = new THREE.Matrix4();
	const normalMatrix = new THREE.Matrix3();
	const point = new THREE.Vector3();
	const direction = new THREE.Vector3();
	const tint = new THREE.Color();
	const turnAbout = new THREE.Quaternion();
	const up = new THREE.Vector3(0, 1, 0);

	const add = (unit: IUnitShape, { at, size, color, turn = 0 }: IPiece) => {
		turnAbout.setFromAxisAngle(up, turn);
		matrix.compose(point.set(...at), turnAbout, direction.set(...size));
		normalMatrix.getNormalMatrix(matrix);
		// The theme's colours are sRGB; vertex colours are in linear light, as materials' are.
		tint.set(color);
		for (let i = 0; i < unit.positions.length; i += 3) {
			point
				.set(unit.positions[i], unit.positions[i + 1], unit.positions[i + 2])
				.applyMatrix4(matrix);
			positions.push(point.x, point.y, point.z);
			direction
				.set(unit.normals[i], unit.normals[i + 1], unit.normals[i + 2])
				.applyMatrix3(normalMatrix)
				.normalize();
			normals.push(direction.x, direction.y, direction.z);
			colors.push(tint.r, tint.g, tint.b);
		}
	};

	return {
		box: (piece: IPiece) => add(UNIT_BOX, piece),
		prism: (piece: IPiece) => add(UNIT_PRISM, piece),
		pane: (piece: IPiece) => add(UNIT_PANE, piece),
		isEmpty: () => positions.length === 0,
		/** How many vertices the pieces so far take: where the next one starts. */
		vertexCount: () => positions.length / 3,
		/** The pieces as one geometry, with a colour per vertex. */
		geometry: () => {
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
			geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
			geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
			geometry.computeBoundingSphere();
			return geometry;
		},
	};
};
