import * as THREE from "three";

import { Mat, shareGeometryAs, type TV3 } from "../primitives";

/**
 * The pieces building clusters are drawn with (`clusterKit` lays them out):
 * each a shape of size 1 scaled to the building, so every building of every
 * cluster shares a handful of geometries and they're drawn together
 * (ADR-0086). Boxes and cylinders are three's own; the roofs' prisms are built
 * once here and named by their shape. Prisms and pyramids are flat-shaded, so
 * scaling them unevenly keeps their faces' shading right.
 */

/** A prism with its ridge along X: a triangle 1 across (z) and 1 high, 1 long, on y = 0. */
const unitPrism = (() => {
	const shape = new THREE.Shape();
	shape.moveTo(-0.5, 0);
	shape.lineTo(0.5, 0);
	shape.lineTo(0, 1);
	shape.closePath();
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
	geometry.translate(0, 0, -0.5);
	geometry.rotateY(Math.PI / 2);
	geometry.computeVertexNormals();
	return shareGeometryAs(geometry, "clusterPrism:1");
})();

/**
 * One tooth of a sawtooth roof, its ridge along X: a right triangle 1 across
 * (z) and 1 high, rising to an upright face at +z (where its glazing goes), on y = 0.
 */
const unitTooth = (() => {
	const shape = new THREE.Shape();
	shape.moveTo(-0.5, 0);
	shape.lineTo(0.5, 0);
	shape.lineTo(0.5, 1);
	shape.closePath();
	const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
	geometry.translate(0, 0, -0.5);
	geometry.rotateY(Math.PI / 2);
	geometry.computeVertexNormals();
	return shareGeometryAs(geometry, "clusterTooth:1");
})();

interface IPieceProps {
	/** Where its base's centre is (prisms, teeth and pyramids) or its middle (boxes, cylinders). */
	position: TV3;
	size: TV3;
	rotation?: TV3;
	color: string;
	castShadow?: boolean;
	flat?: boolean;
	emissive?: string;
	emissiveIntensity?: number;
}

/** A box, centred on its position. */
export const Block = ({
	position,
	size,
	rotation,
	color,
	castShadow = true,
	...glow
}: IPieceProps) => (
	<mesh position={position} rotation={rotation} scale={size} castShadow={castShadow} receiveShadow>
		<boxGeometry />

		<Mat color={color} {...glow} />
	</mesh>
);

/** A roof prism, its ridge along X, standing on its position. */
export const Prism = ({
	position,
	size,
	rotation,
	color,
	castShadow = true,
	...glow
}: IPieceProps) => (
	<mesh
		geometry={unitPrism}
		position={position}
		rotation={rotation}
		scale={size}
		castShadow={castShadow}
		receiveShadow
	>
		<Mat color={color} flat {...glow} />
	</mesh>
);

/** A sawtooth roof's tooth, its ridge along X and its upright face at +z, standing on its position. */
export const Tooth = ({ position, size, rotation, color, castShadow = true }: IPieceProps) => (
	<mesh
		geometry={unitTooth}
		position={position}
		rotation={rotation}
		scale={size}
		castShadow={castShadow}
		receiveShadow
	>
		<Mat color={color} flat />
	</mesh>
);

/** A square pyramid (a tent, a spire), its sides facing ±x and ±z, standing on its position. */
export const Pyramid = ({
	position: [x, y, z],
	size,
	rotation,
	color,
	castShadow = true,
}: IPieceProps) => (
	<group position={[x, y, z]} rotation={rotation}>
		<mesh position={[0, size[1] / 2, 0]} scale={size} castShadow={castShadow} receiveShadow>
			{/* Four sides, turned by an eighth so they face the axes; corners at √½, so it's 1 across. */}
			<coneGeometry args={[Math.SQRT1_2, 1, 4, 1, false, Math.PI / 4]} />

			<Mat color={color} flat />
		</mesh>
	</group>
);

/** An upright cylinder (a silo, a chimney), centred on its position. */
export const Drum = ({ position, size, color, castShadow = true }: IPieceProps) => (
	<mesh position={position} scale={size} castShadow={castShadow} receiveShadow>
		<cylinderGeometry args={[0.5, 0.5, 1, 12]} />

		<Mat color={color} />
	</mesh>
);

/** A round cone (a silo's roof), standing on its position. */
export const Cone = ({
	position: [x, y, z],
	size,
	color,
	castShadow = true,
	...glow
}: IPieceProps) => (
	<mesh position={[x, y + size[1] / 2, z]} scale={size} castShadow={castShadow} receiveShadow>
		<coneGeometry args={[0.5, 1, 12]} />

		<Mat color={color} flat {...glow} />
	</mesh>
);

const mixing = new THREE.Color();
const toward = new THREE.Color();

/**
 * A colour a little lighter (amount above 0) or darker (below), so the
 * buildings of a cluster differ a touch while keeping its tint: `amount` is
 * how far towards white or black, −1 to 1.
 */
export const shadeOf = (color: string, amount: number) => {
	mixing.set(color);
	toward.set(amount > 0 ? "#ffffff" : "#000000");
	return `#${mixing.lerp(toward, Math.abs(amount)).getHexString()}`;
};

/**
 * Whether a building's window is lit: each window has its own fixed place in
 * the order windows light up (`score`, 0–1), and the light's `litPaneShare`
 * says how many are lit, so as it gets darker (comesOn "oneByOne") windows
 * come on one after another and never go off again before the rest.
 */
export const isWindowLit = (score: number, litPaneShare: number) => score < litPaneShare;
