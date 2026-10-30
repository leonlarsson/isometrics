import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { z } from "zod";

import { motionClock } from "#/lib/motionClock";

import { LightPool, lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import type { IResolvedLight } from "../types";
import { definePart } from "../types";

const LighthouseSchema = z.object({
	height: z.number().min(2).max(10).default(3.6),
	stripeCount: z.number().int().min(0).max(8).default(3),
	beamRotates: z.boolean().default(true),
	beamSecondsPerTurn: z.number().min(1).max(60).default(6),
});

/** How many flat faces the tower has round it. */
const TOWER_SIDES = 16;

/** The tower narrows from its foot to its top. */
const TOWER = { bottom: 0.55, top: 0.36 };
/** The lantern room on top: its glass, and the dome over it. */
const LANTERN = { radius: 0.26, height: 0.42 };
/** How wide the beam opens, for each unit of its length. */
const BEAM_SPREAD = 0.13;
/** The gallery's railing: how far out and how high it is, and where its posts stand round it. */
const RAILING = {
	radius: TOWER.top + 0.12,
	height: 0.16,
	posts: Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2),
};

/** The door at the foot, and how high its lamp hangs. */
const DOOR = { width: 0.24, height: 0.5, lampHeight: 0.66 };

/**
 * How the beam fades along its length, for its alpha map: full at the lamp,
 * gone at its far end, so it has no hard end. Cones run their texture from the
 * base (v = 0, the far end here) to the tip (v = 1, at the lamp).
 */
let beamFade: THREE.CanvasTexture | null = null;
const getBeamFade = () => {
	if (beamFade || typeof document === "undefined") {
		return beamFade;
	}
	const canvas = document.createElement("canvas");
	canvas.width = 4;
	canvas.height = 64;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		// The image's top is the texture's v = 1: the lamp.
		const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, "#ffffff");
		gradient.addColorStop(0.45, "#8a8a8a");
		gradient.addColorStop(1, "#000000");
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	beamFade = new THREE.CanvasTexture(canvas);
	return beamFade;
};

/** The beam: two cones of light from the lamp, opposite ways, going round while motion plays. */
const Beam = ({
	light,
	turns,
	secondsPerTurn,
}: {
	light: IResolvedLight;
	turns: boolean;
	secondsPerTurn: number;
}) => {
	const beam = useRef<THREE.Group>(null);
	useFrame(() => {
		if (beam.current) {
			beam.current.rotation.y = turns ? (motionClock.seconds / secondsPerTurn) * Math.PI * 2 : 0;
		}
	});
	return (
		// Only its turn changes each frame, which is followed anyway; see-through, it's drawn on its own
		// (ADR-0086), so it needs no notInstanced mark. Hidden while the light is off, and kept, so the
		// night doesn't compile its shader again (parts/lights.tsx).
		<group ref={beam} visible={light.on}>
			{[1, -1].map((side) => (
				<mesh
					key={side}
					position={[(side * light.reach) / 2, 0, 0]}
					rotation={[0, 0, (side * Math.PI) / 2]}
				>
					<coneGeometry args={[light.reach * BEAM_SPREAD, light.reach, 12, 1, true]} />

					<meshBasicMaterial
						color={light.color}
						alphaMap={getBeamFade()}
						transparent
						opacity={0.3 * Math.min(light.level, 1.5)}
						blending={THREE.AdditiveBlending}
						depthWrite={false}
						side={THREE.DoubleSide}
						// Added light comes out the same in any order: both sides in one pass (PERFORMANCE.md).
						forceSinglePass
						toneMapped={false}
					/>
				</mesh>
			))}
		</group>
	);
};

export const lighthouse01 = definePart({
	kind: "lighthouse_01",
	name: "Lighthouse",
	category: "buildings",
	// Its beam turns every frame.
	movesOnItsOwn: true,
	description: "Striped lighthouse with a lantern room whose beam sweeps round after dark",
	keywords: ["beacon", "coast", "harbour", "sea", "tower", "landmark", "light"],
	schema: LighthouseSchema,
	renamedProps: { beamTurns: "beamRotates" },
	fields: [
		{ key: "height", label: "Height", type: "number", min: 2, max: 10, step: 0.1 },
		{ key: "stripeCount", label: "Number of stripes", type: "number", min: 0, max: 8, step: 1 },
		{ key: "beamRotates", label: "The beam turns", type: "boolean" },
		{
			key: "beamSecondsPerTurn",
			label: "Seconds per turn",
			type: "number",
			min: 1,
			max: 60,
			step: 0.5,
		},
	],
	colors: [
		{ id: "tower", name: "Tower", default: "#f4f1ea", legacy: "color" },
		{ id: "stripes", name: "Stripes and dome", default: "#d7392e", legacy: "accent" },
		{ id: "gallery", name: "Gallery", default: "#2f3133" },
	],
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			description:
				"The light in the lantern room, with its sweeping beam; its reach is how long the beam is.",
			shape: "beam",
			color: "#fff1c8",
			reach: 3.5,
			realLight: (p) => ({ at: [0, p.height + LANTERN.height / 2, 0] }),
		},
		{ id: "doorLamp", name: "Lamp by the door", shape: "pool", reach: 0.9 },
	],
	footprint: () => [TOWER.bottom * 2 + 0.2, TOWER.bottom * 2 + 0.2],
	height: (p) => p.height + LANTERN.height + 0.35,
	Component: ({ props: p, colors, lights }) => {
		// Bands of stripe colour, evenly up the tower, between bands of its own colour.
		const bands = p.stripeCount * 2 + 1;
		const bandHeight = p.height / bands;
		const radiusAt = (y: number) => TOWER.bottom + ((TOWER.top - TOWER.bottom) * y) / p.height;
		// The tower has TOWER_SIDES flat faces, turned so one faces the front (+Z): where that face
		// is at a height, a little inside the corners' radius.
		const frontFaceAt = (y: number) => radiusAt(y) * Math.cos(Math.PI / TOWER_SIDES);
		// How far the wall leans in: the door leans with it.
		const lean = -Math.atan2(TOWER.bottom - TOWER.top, p.height);
		return (
			<group>
				{Array.from({ length: bands }, (_, i) => i * bandHeight).map((y, i) => (
					<mesh key={y} position={[0, y + bandHeight / 2, 0]} castShadow receiveShadow>
						<cylinderGeometry
							args={[
								radiusAt(y + bandHeight),
								radiusAt(y),
								bandHeight,
								TOWER_SIDES,
								1,
								false,
								Math.PI / TOWER_SIDES,
							]}
						/>

						<Mat color={i % 2 === 1 ? colors.stripes : colors.tower} />
					</mesh>
				))}

				{/* The gallery round the top, its railing, the lantern room and the dome. */}
				<mesh position={[0, p.height + 0.03, 0]} castShadow>
					<cylinderGeometry args={[TOWER.top + 0.14, TOWER.top + 0.14, 0.06, 16]} />

					<Mat color={colors.gallery} />
				</mesh>

				{/* The railing round the gallery: a ring for its top rail, on posts. */}
				<mesh position={[0, p.height + RAILING.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
					<torusGeometry args={[RAILING.radius, 0.012, 4, 32]} />

					<Mat color={colors.gallery} />
				</mesh>

				{RAILING.posts.map((angle) => (
					<Box
						key={angle}
						size={[0.018, RAILING.height, 0.018]}
						position={[
							Math.cos(angle) * RAILING.radius,
							p.height + RAILING.height / 2,
							Math.sin(angle) * RAILING.radius,
						]}
						color={colors.gallery}
						castShadow={false}
					/>
				))}

				<mesh position={[0, p.height + 0.06 + LANTERN.height / 2, 0]}>
					<cylinderGeometry args={[LANTERN.radius, LANTERN.radius, LANTERN.height, 12]} />

					<Mat color={lights.lamp.color} {...lightEmission(lights.lamp, 2.5)} />
				</mesh>

				<mesh position={[0, p.height + 0.06 + LANTERN.height + 0.12, 0]} castShadow>
					<sphereGeometry args={[LANTERN.radius + 0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />

					<Mat color={colors.stripes} />
				</mesh>

				<group position={[0, p.height + 0.06 + LANTERN.height / 2, 0]}>
					<Beam light={lights.lamp} turns={p.beamRotates} secondsPerTurn={p.beamSecondsPerTurn} />
				</group>

				{/* The door at the foot, facing +Z, and its lamp above on a bracket: both on the wall
				where it is at their height (the tower narrows), leaning with it. */}
				<group position={[0, 0, frontFaceAt(0) + 0.022]} rotation={[lean, 0, 0]}>
					<Box
						size={[DOOR.width, DOOR.height, 0.04]}
						position={[0, DOOR.height / 2, 0]}
						color={colors.gallery}
						castShadow={false}
					/>
				</group>

				<group position={[0, DOOR.lampHeight, frontFaceAt(DOOR.lampHeight)]}>
					<Box size={[0.025, 0.025, 0.1]} position={[0, 0, 0.04]} color={colors.gallery} />

					<Box
						size={[0.06, 0.07, 0.06]}
						position={[0, -0.04, 0.09]}
						color={lights.doorLamp.color}
						castShadow={false}
						{...lightEmission(lights.doorLamp, 2)}
					/>
				</group>

				<LightPool light={lights.doorLamp} at={[0, TOWER.bottom + 0.3]} />
			</group>
		);
	},
});
