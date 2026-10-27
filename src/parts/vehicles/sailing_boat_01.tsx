import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { z } from "zod";

import { LightLens } from "../lights";
import { Box, Mat, shareGeometryAs } from "../primitives";
import { definePart } from "../types";

import { boatHullGeometry } from "./boatKit";

const SailingBoatSchema = z.object({
	length: z.number().min(1).max(6).default(2),
	showSails: z.boolean().default(true),
});

const HULL_HEIGHT = 0.26;

/** A sail: a flat triangle in the boat's side plane, its foot along X from the mast, its peak `peakAt` along. */
const sailGeometry = (foot: number, height: number, peakAt: number) => {
	const shape = new THREE.Shape();
	shape.moveTo(0, 0);
	shape.lineTo(foot, 0);
	shape.lineTo(peakAt, height);
	shape.closePath();
	return shareGeometryAs(new THREE.ShapeGeometry(shape), `sail:${foot},${height},${peakAt}`);
};

type TV3 = [number, number, number];

const UP = new THREE.Vector3(0, 1, 0);

/** A wire (or a rolled sail) from one point to another: a thin cylinder turned to join them. */
const Stay = ({
	from,
	to,
	color,
	radius = 0.006,
}: {
	from: TV3;
	to: TV3;
	color: string;
	radius?: number;
}) => {
	const start = new THREE.Vector3(...from);
	const along = new THREE.Vector3(...to).sub(start);
	const length = along.length();
	const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, along.clone().normalize());
	const middle = start.add(along.multiplyScalar(0.5));
	return (
		<mesh position={middle.toArray()} quaternion={quaternion}>
			<cylinderGeometry args={[radius, radius, length, radius > 0.01 ? 8 : 4]} />

			<Mat color={color} />
		</mesh>
	);
};

export const sailingBoat01 = definePart({
	kind: "sailing_boat_01",
	name: "Sailing boat",
	category: "vehicles",
	description:
		"Small sailing boat with a mainsail and a jib, sails up or furled; can sail along a route",
	keywords: ["sailboat", "yacht", "dinghy", "regatta", "harbour", "boat"],
	schema: SailingBoatSchema,
	fields: [
		{ key: "length", label: "Length", type: "number", min: 1, max: 6, step: 0.1 },
		{ key: "showSails", label: "Sails up", type: "boolean" },
	],
	colors: [
		{ id: "hull", name: "Hull", default: "#f7f7f4", legacy: "color" },
		{ id: "sails", name: "Sails", default: "#f4f1ea", legacy: "accent" },
		{ id: "deck", name: "Deck", default: "#b07d4b" },
	],
	lights: [
		{
			id: "masthead",
			name: "Masthead light",
			description: "The white light at the top of the mast, on after dark.",
			shape: "lens",
		},
	],
	canFollowPath: true,
	wake: (p) => ({ width: p.length * 0.3, behind: p.length / 2 }),
	// Heeling into its turns a little.
	turnLean: { degreesPerAcceleration: 10, maxDegrees: 12 },
	footprint: (p) => [p.length, p.length * 0.34],
	height: (p) => HULL_HEIGHT + p.length * 1.15,
	Component: ({ props: p, colors, palette, lights }) => {
		const width = p.length * 0.34;
		const mastHeight = p.length * 1.1;
		const mastX = p.length * 0.08;
		// Where the rigging meets the deck: the bow and the stern.
		const bow = p.length * 0.46;
		const stern = -p.length * 0.47;
		const deckY = HULL_HEIGHT + 0.02;
		const hull = useMemo(() => boatHullGeometry(p.length, width, HULL_HEIGHT), [p.length, width]);
		const mainsail = useMemo(
			() => sailGeometry(p.length * 0.5, mastHeight * 0.88, 0),
			[p.length, mastHeight],
		);
		const jib = useMemo(
			// From the mast's foot forward to the bow, its edge up the forestay to near the masthead.
			() => sailGeometry(p.length * 0.4, mastHeight * 0.78, 0),
			[p.length, mastHeight],
		);
		useLayoutEffect(
			() => () => {
				hull.dispose();
				mainsail.dispose();
				jib.dispose();
			},
			[hull, mainsail, jib],
		);
		return (
			<group>
				<mesh geometry={hull} castShadow receiveShadow>
					<Mat color={colors.hull} />
				</mesh>

				<Box
					size={[p.length * 0.7, 0.02, width * 0.7]}
					position={[-p.length * 0.08, HULL_HEIGHT + 0.01, 0]}
					color={colors.deck}
				/>

				<Box
					size={[p.length * 0.24, 0.12, width * 0.5]}
					position={[-p.length * 0.12, HULL_HEIGHT + 0.07, 0]}
					color={palette.wall}
				/>

				<mesh position={[mastX, HULL_HEIGHT + mastHeight / 2, 0]} castShadow>
					<cylinderGeometry args={[0.015, 0.02, mastHeight, 6]} />

					<Mat color={palette.trim} />
				</mesh>

				<LightLens
					light={lights.masthead}
					size={[0.04, 0.04, 0.04]}
					position={[mastX, HULL_HEIGHT + mastHeight + 0.02, 0]}
				/>

				{/* The boom, and the sails: the mainsail behind the mast, the jib before it. */}
				<Box
					size={[p.length * 0.52, 0.025, 0.025]}
					position={[mastX - p.length * 0.25, HULL_HEIGHT + 0.12, 0]}
					color={palette.trim}
				/>

				{/* The rigging that holds the mast up, sails up or not: the forestay to the bow, the
				backstay to the stern, and a shroud to each side. */}
				<Stay
					from={[bow, deckY, 0]}
					to={[mastX, HULL_HEIGHT + mastHeight * 0.85, 0]}
					color={palette.tire}
				/>

				<Stay
					from={[stern, deckY, 0]}
					to={[mastX, HULL_HEIGHT + mastHeight, 0]}
					color={palette.tire}
				/>

				{[1, -1].map((side) => (
					<Stay
						key={side}
						from={[mastX - p.length * 0.03, deckY, side * width * 0.45]}
						to={[mastX, HULL_HEIGHT + mastHeight * 0.75, 0]}
						color={palette.tire}
					/>
				))}

				{p.showSails ? (
					<>
						<mesh
							geometry={mainsail}
							position={[mastX, HULL_HEIGHT + 0.13, 0]}
							rotation={[0, Math.PI, 0]}
							castShadow
						>
							<meshStandardMaterial color={colors.sails} side={THREE.DoubleSide} roughness={0.9} />
						</mesh>

						<mesh geometry={jib} position={[mastX, HULL_HEIGHT + 0.05, 0]} castShadow>
							<meshStandardMaterial color={colors.sails} side={THREE.DoubleSide} roughness={0.9} />
						</mesh>
					</>
				) : (
					<>
						{/* Furled: the mainsail rolled along the boom, the jib round the forestay. */}
						<mesh
							position={[mastX - p.length * 0.25, HULL_HEIGHT + 0.16, 0]}
							rotation={[0, 0, Math.PI / 2]}
							castShadow
						>
							<cylinderGeometry args={[0.04, 0.04, p.length * 0.46, 8]} />

							<Mat color={colors.sails} />
						</mesh>

						<Stay
							from={[bow - 0.02, deckY + 0.03, 0]}
							to={[
								bow + (mastX - bow) * 0.72,
								deckY + (HULL_HEIGHT + mastHeight * 0.85 - deckY) * 0.72,
								0,
							]}
							color={colors.sails}
							radius={0.025}
						/>
					</>
				)}
			</group>
		);
	},
});
