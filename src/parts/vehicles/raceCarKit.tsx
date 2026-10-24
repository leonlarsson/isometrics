import { useMemo } from "react";
import * as THREE from "three";

import { LightLens } from "../lights";
import { Box, Mat } from "../primitives";
import type { IResolvedLight } from "../types";

/**
 * Building blocks shared by the race cars, one part per era of open-wheel
 * racing (race_car_01 is the modern one; later eras are race_car_02, _03…,
 * ADR-0050). Each era is its own part file with its own body shape, made from
 * these pieces and the primitives. All in the cars' modelling units: about 2
 * long along X (front at +X), standing on y = 0, before the part scales it.
 */

type TV3 = [number, number, number];

const X_AXIS = new THREE.Vector3(1, 0, 0);

/** A thin bar from one point to another: suspension arms, mirror stalks, wing supports. */
export const Strut = ({
	from,
	to,
	thickness = 0.018,
	color,
}: {
	from: TV3;
	to: TV3;
	thickness?: number;
	color: string;
}) => {
	const { position, quaternion, length } = useMemo(() => {
		const start = new THREE.Vector3(...from);
		const end = new THREE.Vector3(...to);
		const direction = end.clone().sub(start);
		return {
			position: start.add(end).divideScalar(2),
			quaternion: new THREE.Quaternion().setFromUnitVectors(X_AXIS, direction.clone().normalize()),
			length: direction.length(),
		};
	}, [from[0], from[1], from[2], to[0], to[1], to[2]]);
	return (
		<mesh position={position} quaternion={quaternion} castShadow>
			<boxGeometry args={[length, thickness, thickness]} />

			<Mat color={color} />
		</mesh>
	);
};

/**
 * A racing wheel, axle along Z: a wide tyre, and a disc on its outer face (a
 * rim, or the modern era's wheel cover). `side` is which way is outwards (+1
 * for a wheel on the +Z side).
 */
export const RaceWheel = ({
	position,
	radius,
	width,
	side,
	tire,
	rim,
}: {
	position: TV3;
	radius: number;
	width: number;
	side: 1 | -1;
	tire: string;
	rim: string;
}) => {
	return (
		<group position={position}>
			<mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
				<cylinderGeometry args={[radius, radius, width, 18]} />

				<Mat color={tire} roughness={0.95} />
			</mesh>

			<mesh position={[0, 0, side * (width / 2 + 0.004)]} rotation={[Math.PI / 2, 0, 0]}>
				<cylinderGeometry args={[radius * 0.62, radius * 0.62, 0.012, 18]} />

				<Mat color={rim} roughness={0.5} />
			</mesh>
		</group>
	);
};

/**
 * A wing across the car: a main plane and a flap above and behind it, its
 * trailing edge raised, between two endplates. `span` is its width (along Z),
 * `chord` the main plane's depth (along X); `position` is the main plane's
 * middle. The flap overlaps the main plane and both reach into the endplates,
 * so nothing floats.
 */
export const Wing = ({
	position,
	span,
	chord,
	endplateHeight,
	color,
	flapTilt = 0.4,
}: {
	position: TV3;
	span: number;
	chord: number;
	endplateHeight: number;
	color: string;
	/** How steeply the flap rises towards the back (radians). */
	flapTilt?: number;
}) => {
	const [x, y, z] = position;
	return (
		<group position={[x, y, z]}>
			<Box size={[chord, 0.026, span]} color={color} />

			{/* Rotated about Z: negative lifts its back (−X) end. */}
			<Box
				size={[chord * 0.7, 0.02, span]}
				position={[-chord * 0.42, 0.03, 0]}
				rotation={[0, 0, -flapTilt]}
				color={color}
			/>

			{[1, -1].map((sideOf) => (
				<Box
					key={sideOf}
					size={[chord * 1.5, endplateHeight, 0.022]}
					position={[-chord * 0.2, endplateHeight / 2 - 0.02, sideOf * (span / 2)]}
					color={color}
				/>
			))}
		</group>
	);
};

/** The driver's helmet in the cockpit, with a dark visor facing forwards. */
export const Helmet = ({
	position,
	color,
	visor,
}: {
	position: TV3;
	color: string;
	visor: string;
}) => {
	const [x, y, z] = position;
	return (
		<group position={[x, y, z]}>
			<mesh castShadow>
				<sphereGeometry args={[0.07, 12, 10]} />

				<Mat color={color} />
			</mesh>

			<Box
				size={[0.03, 0.03, 0.09]}
				position={[0.055, 0.008, 0]}
				color={visor}
				castShadow={false}
			/>
		</group>
	);
};

/**
 * The rain light at the back, under the rear wing (race cars have no
 * headlights): a lens that glows in the light's colour while it's on (red on
 * real cars) and is dark while it's off. Pair it with a LightPool behind the
 * car for its glow on the road.
 */
export const RainLight = ({ light, position }: { light: IResolvedLight; position: TV3 }) => {
	return <LightLens light={light} size={[0.04, 0.07, 0.12]} position={position} />;
};
