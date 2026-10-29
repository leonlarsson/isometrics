import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";

import { Mat, shareGeometryAs } from "../primitives";

/** Pieces power lines share (the power pole and the pylon): wires to the next one along +X, and insulators. */

/** How far a wire sags in the middle, as a part of its span. */
const SAG = 0.045;

/**
 * A wire from an insulator to the same one on the next pole along +X,
 * `span` away, sagging between them; drawn as one thin tube, shared by every
 * wire of the same span.
 */
export const Wire = ({
	span,
	position,
	color,
}: {
	span: number;
	position: [number, number, number];
	color: string;
}) => {
	const geometry = useMemo(() => {
		const curve = new THREE.QuadraticBezierCurve3(
			new THREE.Vector3(0, 0, 0),
			// A quadratic curve's middle sags half as far as its control point.
			new THREE.Vector3(span / 2, -2 * SAG * span, 0),
			new THREE.Vector3(span, 0, 0),
		);
		return shareGeometryAs(new THREE.TubeGeometry(curve, 16, 0.01, 4, false), `wire:${span}`);
	}, [span]);

	useLayoutEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<mesh geometry={geometry} position={position} castShadow>
			<Mat color={color} roughness={0.6} />
		</mesh>
	);
};

/** An insulator: a stack of porcelain discs, the wire held on top. */
export const Insulator = ({
	position,
	color,
}: {
	position: [number, number, number];
	color: string;
}) => (
	<group position={position}>
		{[0, 1, 2].map((i) => (
			<mesh key={i} position={[0, 0.02 + i * 0.03, 0]}>
				<cylinderGeometry args={[0.026, 0.026, 0.018, 10]} />

				<Mat color={color} roughness={0.35} />
			</mesh>
		))}

		<mesh position={[0, 0.045, 0]}>
			<cylinderGeometry args={[0.009, 0.009, 0.09, 6]} />

			<Mat color={color} roughness={0.35} />
		</mesh>
	</group>
);
