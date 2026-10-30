import { RoundedBox } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type TV3 = [number, number, number];

/**
 * Names a geometry built by hand by its shape (`userData.shareKey`), so objects
 * with the same one are drawn together (ADR-0086): three's own shapes (a box,
 * a cylinder) are known by their parameters, but a hand-built one is only
 * itself otherwise. The key must say everything the shape depends on.
 */
export const shareGeometryAs = <G extends THREE.BufferGeometry>(geometry: G, key: string): G => {
	geometry.userData.shareKey = key;
	return geometry;
};

interface IBoxProps {
	size: TV3;
	position?: TV3;
	rotation?: TV3;
	color: string;
	castShadow?: boolean;
	roughness?: number;
	/** A colour it glows with (lit windows at night), and how brightly. */
	emissive?: string;
	emissiveIntensity?: number;
}

export const Mat = ({
	color,
	roughness = 0.85,
	flat = false,
	emissive,
	emissiveIntensity = 0.8,
}: {
	color: string;
	roughness?: number;
	flat?: boolean;
	emissive?: string;
	emissiveIntensity?: number;
}) => {
	return (
		<meshStandardMaterial
			color={color}
			roughness={roughness}
			metalness={0}
			flatShading={flat}
			emissive={emissive ?? "#000000"}
			emissiveIntensity={emissive ? emissiveIntensity : 0}
		/>
	);
};

export const Box = ({
	size,
	position,
	rotation,
	color,
	castShadow = true,
	roughness,
	emissive,
	emissiveIntensity,
}: IBoxProps) => {
	return (
		<mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow>
			<boxGeometry args={size} />

			<Mat
				color={color}
				roughness={roughness}
				emissive={emissive}
				emissiveIntensity={emissiveIntensity}
			/>
		</mesh>
	);
};

export const RBox = ({ size, position, color, radius = 0.1 }: IBoxProps & { radius?: number }) => {
	const r = Math.min(radius, ...size.map((s) => s / 2 - 0.001));
	const mesh = useRef<THREE.Mesh>(null);
	// drei builds the geometry: named by its shape after each render, so rounded boxes share.
	useLayoutEffect(() => {
		if (mesh.current) {
			shareGeometryAs(mesh.current.geometry, `roundedBox:${size.join(",")},${r}`);
		}
	});
	return (
		<RoundedBox
			ref={mesh}
			args={size}
			radius={Math.max(r, 0.001)}
			smoothness={3}
			position={position}
			castShadow
			receiveShadow
		>
			<Mat color={color} />
		</RoundedBox>
	);
};

/** Triangular prism roof. Ridge runs along X, slopes face ±Z. */
export const GableRoof = ({
	width,
	depth,
	height,
	position,
	color,
}: {
	width: number;
	depth: number;
	height: number;
	position?: TV3;
	color: string;
}) => {
	const geometry = useMemo(() => {
		const shape = new THREE.Shape();
		shape.moveTo(-depth / 2, 0);
		shape.lineTo(depth / 2, 0);
		shape.lineTo(0, height);
		shape.closePath();
		const geo = new THREE.ExtrudeGeometry(shape, {
			depth: width,
			bevelEnabled: false,
		});
		geo.translate(0, 0, -width / 2);
		geo.rotateY(Math.PI / 2);
		geo.computeVertexNormals();
		return shareGeometryAs(geo, `gableRoof:${width},${depth},${height}`);
	}, [width, depth, height]);

	useLayoutEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<mesh geometry={geometry} position={position} castShadow receiveShadow>
			<Mat color={color} flat />
		</mesh>
	);
};

/**
 * A box that narrows (or widens) along X: `back` and `front` are its
 * [height, width] at x = −length/2 and x = +length/2. `lift` raises the front
 * face's centre (a nose that drops, an engine cover that rises). Flat-shaded:
 * noses, sidepods, wedges, fuselages.
 */
export const Taper = ({
	length,
	back,
	front,
	lift = 0,
	position,
	rotation,
	color,
	castShadow = true,
}: {
	length: number;
	back: [height: number, width: number];
	front: [height: number, width: number];
	lift?: number;
	position?: TV3;
	rotation?: TV3;
	color: string;
	castShadow?: boolean;
}) => {
	const [backHeight, backWidth] = back;
	const [frontHeight, frontWidth] = front;
	const geometry = useMemo(() => {
		const x0 = -length / 2;
		const x1 = length / 2;
		const corners: TV3[] = [
			[x0, -backHeight / 2, -backWidth / 2],
			[x0, backHeight / 2, -backWidth / 2],
			[x0, backHeight / 2, backWidth / 2],
			[x0, -backHeight / 2, backWidth / 2],
			[x1, lift - frontHeight / 2, -frontWidth / 2],
			[x1, lift + frontHeight / 2, -frontWidth / 2],
			[x1, lift + frontHeight / 2, frontWidth / 2],
			[x1, lift - frontHeight / 2, frontWidth / 2],
		];
		const faces = [
			[0, 1, 2, 3],
			[4, 5, 6, 7],
			[0, 3, 7, 4],
			[1, 5, 6, 2],
			[0, 4, 5, 1],
			[3, 2, 6, 7],
		];
		const centre = new THREE.Vector3(0, lift / 2, 0);
		const positions: number[] = [];
		for (const face of faces) {
			const [a, b, c, d] = face.map((i) => new THREE.Vector3(...corners[i]));
			// Wind each face so it points away from the middle, whichever order it was listed in.
			const normal = b.clone().sub(a).cross(c.clone().sub(a));
			const middle = a.clone().add(b).add(c).add(d).divideScalar(4);
			const quad = normal.dot(middle.sub(centre)) < 0 ? [a, d, c, b] : [a, b, c, d];
			for (const index of [0, 1, 2, 0, 2, 3]) {
				positions.push(quad[index].x, quad[index].y, quad[index].z);
			}
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
		geo.computeVertexNormals();
		return shareGeometryAs(
			geo,
			`taper:${length},${backHeight},${backWidth},${frontHeight},${frontWidth},${lift}`,
		);
	}, [length, backHeight, backWidth, frontHeight, frontWidth, lift]);

	useLayoutEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<mesh
			geometry={geometry}
			position={position}
			rotation={rotation}
			castShadow={castShadow}
			receiveShadow
		>
			<Mat color={color} flat />
		</mesh>
	);
};

/** Wheel with its axle along Z (vehicles drive along X). */
export const Wheel = ({
	position,
	radius = 0.17,
	width = 0.12,
	color,
}: {
	position: TV3;
	radius?: number;
	width?: number;
	color: string;
}) => {
	return (
		<mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
			<cylinderGeometry args={[radius, radius, width, 16]} />

			<Mat color={color} roughness={0.95} />
		</mesh>
	);
};

/** Evenly spaced positions centred on 0. */
export const spread = (count: number, span: number) =>
	Array.from({ length: count }, (_, i) => -span / 2 + (span / count) * (i + 0.5));

/** Deterministic pseudo-random in [0, 1), so things look varied but the same every time. */
export const jitter = (i: number) => {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return x - Math.floor(x);
};

const STRUT_X = new THREE.Vector3(1, 0, 0);
const strutTurn = new THREE.Quaternion();
const strutEuler = new THREE.Euler();

/**
 * A square bar from one point to another, anywhere: a lattice's legs and
 * braces (a pylon, a crane). Its geometry is a box of its length, so bars of
 * the same length are drawn together.
 */
export const Strut = ({
	from,
	to,
	color,
	thickness = 0.03,
	castShadow = true,
}: {
	from: TV3;
	to: TV3;
	color: string;
	thickness?: number;
	castShadow?: boolean;
}) => {
	const along = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
	const length = along.length();
	strutTurn.setFromUnitVectors(STRUT_X, along.normalize());
	strutEuler.setFromQuaternion(strutTurn);
	return (
		<Box
			size={[Math.round(length * 1000) / 1000, thickness, thickness]}
			position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]}
			rotation={[strutEuler.x, strutEuler.y, strutEuler.z]}
			color={color}
			castShadow={castShadow}
		/>
	);
};
