import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";

import { Box, jitter, Mat, shareGeometryAs, spread } from "../primitives";
import { definePart } from "../types";

const GreenhouseSchema = z.object({
	width: z.number().min(1).max(6).default(1.6),
	length: z.number().min(1.2).max(10).default(2.6),
});

const WALL_HEIGHT = 0.8;
/** How high the roof rises over the eaves, for a greenhouse this wide: steeper as it widens. */
const roofRise = (width: number) => Math.max(0.4, width * 0.28);
/** A bench of plants, and the aisle beside it. */
const BENCH = { width: 0.45, aisle: 0.25 };
const FRAME_BAR = 0.04;

/** A gable end's glass: the triangle under the roof, `width` across its foot and `rise` high. */
const useGableGeometry = (width: number, rise: number) => {
	const geometry = useMemo(() => {
		const shape = new THREE.Shape();
		shape.moveTo(-width / 2, 0);
		shape.lineTo(width / 2, 0);
		shape.lineTo(0, rise);
		shape.closePath();
		return shareGeometryAs(new THREE.ShapeGeometry(shape), `gableTriangle:${width},${rise}`);
	}, [width, rise]);
	useLayoutEffect(() => () => geometry.dispose(), [geometry]);
	return geometry;
};

export const greenhouse01 = definePart({
	kind: "greenhouse_01",
	name: "Greenhouse",
	category: "buildings",
	description: "Glass greenhouse on a white frame with rows of plants inside, along Z",
	keywords: ["glasshouse", "nursery", "garden", "plants", "allotment", "farm"],
	schema: GreenhouseSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 6, step: 0.1 },
		{ key: "length", label: "Length", type: "number", min: 1.2, max: 10, step: 0.1 },
	],
	colors: [
		{ id: "frame", name: "Frame", default: "#f4f3ee", legacy: "color" },
		{ id: "plants", name: "Plants", default: "#5c9a48", legacy: "accent" },
		{ id: "glass", name: "Glass", default: "#cfe6e4", seeThrough: { transparency: 0.65 } },
	],
	lights: [
		{
			id: "growLights",
			name: "Grow lights",
			description: "Lamps over the plants, glowing through the glass.",
			shape: "glow",
			color: "#f2a8ff",
			realLight: (p) => ({ at: [0, WALL_HEIGHT, 0], reach: Math.max(p.width, p.length) }),
		},
	],
	footprint: (p) => [p.width + 0.1, p.length + 0.1],
	height: (p) => WALL_HEIGHT + roofRise(p.width),
	Component: ({ props: p, colors, transparency, lights }) => {
		const bays = Math.max(2, Math.round(p.length / 0.6));
		const half = p.width / 2;
		const rise = roofRise(p.width);
		const roofSlope = Math.hypot(half, rise);
		const roofPitch = Math.atan2(rise, half);
		const gable = useGableGeometry(p.width, rise);
		// As many benches as fit across with an aisle beside each, at least one.
		const benches = Math.max(1, Math.floor((p.width - 0.1) / (BENCH.width + BENCH.aisle)));
		const posts = spread(bays + 1, p.length + p.length / bays);
		// The glass glows in the grow lights' colour while they're on.
		// The panes are thin boxes, seen from outside; a gable end is a flat triangle, so it's drawn
		// from both sides, or one end would face away from whoever looks at it. In one pass: three
		// draws see-through things of two sides twice otherwise, back faces first, which a flat
		// triangle doesn't need (PERFORMANCE.md).
		const glassOn = (side: THREE.Side) => (
			<meshStandardMaterial
				color={colors.glass}
				transparent
				forceSinglePass
				opacity={1 - transparency.glass}
				roughness={0.1}
				emissive={lights.growLights.on ? lights.growLights.color : "#000000"}
				emissiveIntensity={lights.growLights.on ? 0.5 * lights.growLights.level : 0}
				depthWrite={false}
				side={side}
			/>
		);
		const glass = glassOn(THREE.FrontSide);
		return (
			<group>
				{/* Benches of plants along it, more as it widens. */}
				{spread(benches, p.width - 0.1).map((x) => (
					<group key={x}>
						<Box
							size={[BENCH.width, 0.3, p.length - 0.3]}
							position={[x, 0.15, 0]}
							color={colors.frame}
						/>

						{spread(bays, p.length - 0.4).map((z, i) => (
							<mesh
								key={z}
								position={[x, 0.42, z]}
								scale={[1, 0.7 + jitter(i) * 0.4, 1]}
								castShadow
							>
								<icosahedronGeometry args={[0.16, 0]} />

								<Mat color={colors.plants} flat />
							</mesh>
						))}
					</group>
				))}

				{/* The glass: four walls and the two roof slopes. */}
				{[half, -half].map((x) => (
					<mesh key={x} position={[x, WALL_HEIGHT / 2, 0]}>
						<boxGeometry args={[0.02, WALL_HEIGHT, p.length]} />

						{glass}
					</mesh>
				))}

				{[p.length / 2, -p.length / 2].map((z) => (
					<mesh key={z} position={[0, WALL_HEIGHT / 2, z]}>
						<boxGeometry args={[p.width, WALL_HEIGHT, 0.02]} />

						{glass}
					</mesh>
				))}

				{[1, -1].map((side) => (
					<mesh
						key={side}
						position={[(side * half) / 2, WALL_HEIGHT + rise / 2, 0]}
						rotation={[0, 0, side * -roofPitch]}
					>
						<boxGeometry args={[roofSlope, 0.02, p.length]} />

						{glass}
					</mesh>
				))}

				{/* The gable ends: the triangles of glass under the roof at both ends. */}
				{[p.length / 2, -p.length / 2].map((z) => (
					<mesh key={z} geometry={gable} position={[0, WALL_HEIGHT, z]}>
						{glassOn(THREE.DoubleSide)}
					</mesh>
				))}

				{/* The white frame: posts and rafters at each bay, the eaves and the ridge. */}
				{posts.flatMap((z) =>
					[1, -1].map((side) => (
						<Box
							key={`${z},${side}`}
							size={[roofSlope, FRAME_BAR, FRAME_BAR]}
							position={[(side * half) / 2, WALL_HEIGHT + rise / 2, z]}
							rotation={[0, 0, side * -roofPitch]}
							color={colors.frame}
						/>
					)),
				)}

				{posts.map((z) =>
					[half, -half].map((x) => (
						<Box
							key={`${x},${z}`}
							size={[FRAME_BAR, WALL_HEIGHT, FRAME_BAR]}
							position={[x, WALL_HEIGHT / 2, z]}
							color={colors.frame}
						/>
					)),
				)}

				{[half, -half].map((x) => (
					<Box
						key={x}
						size={[FRAME_BAR, FRAME_BAR, p.length]}
						position={[x, WALL_HEIGHT, 0]}
						color={colors.frame}
					/>
				))}

				<Box
					size={[FRAME_BAR, FRAME_BAR, p.length]}
					position={[0, WALL_HEIGHT + rise, 0]}
					color={colors.frame}
				/>
			</group>
		);
	},
});
