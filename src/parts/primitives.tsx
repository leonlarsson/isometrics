import { RoundedBox } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

type TV3 = [number, number, number];

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
	return (
		<RoundedBox
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
		return geo;
	}, [width, depth, height]);

	useLayoutEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<mesh geometry={geometry} position={position} castShadow receiveShadow>
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
