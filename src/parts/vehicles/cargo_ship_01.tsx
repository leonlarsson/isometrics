import { useLayoutEffect, useMemo } from "react";
import { z } from "zod";

import { LightLens, lightEmission } from "../lights";
import { Box, jitter, Mat, spread } from "../primitives";
import { definePart } from "../types";

import { boatHullGeometry } from "./boatKit";

const CargoShipSchema = z.object({
	length: z.number().min(5).max(24).default(10),
	containerLayers: z.number().int().min(0).max(4).default(2),
});

const HULL_HEIGHT = 0.55;
/** A container as the ship carries them: its length, width and height. */
const BOX = { length: 0.62, width: 0.24, height: 0.2 };

export const cargoShip01 = definePart({
	kind: "cargo_ship_01",
	name: "Cargo ship",
	category: "vehicles",
	description:
		"Container ship with stacks of containers, its bridge and funnel at the stern; can sail along a route",
	keywords: ["container ship", "freighter", "boat", "port", "harbour", "shipping", "cargo"],
	schema: CargoShipSchema,
	fields: [
		{ key: "length", label: "Length", type: "number", min: 5, max: 24, step: 0.5 },
		{
			key: "containerLayers",
			label: "Layers of containers",
			type: "number",
			min: 0,
			max: 4,
			step: 1,
		},
	],
	colors: [
		{ id: "hull", name: "Hull", default: "#26324a", legacy: "color" },
		{ id: "bridge", name: "Bridge and deck", default: "#f4f1ea", legacy: "accent" },
		{ id: "containers", name: "Containers", default: "#c8553d" },
		{ id: "otherContainers", name: "Other containers", default: "#3d6fd6" },
		{ id: "funnel", name: "Funnel band", default: "#e8b83a" },
	],
	lights: [
		{
			id: "bridge",
			name: "Bridge lights",
			description: "The lights in the bridge and the cabins under it.",
			shape: "glow",
			realLight: (p) => ({ at: [-p.length * 0.36, HULL_HEIGHT + 0.6, 0], reach: p.length * 0.35 }),
		},
		{
			id: "mastheadLamp",
			name: "Masthead lamp",
			description: "A white lamp at the top of the mast, lit after dark.",
			shape: "lens",
			color: "#ffffff",
		},
	],
	canFollowPath: true,
	wake: (p) => ({ width: p.length * 0.16, behind: p.length / 2 }),
	turnLean: { degreesPerAcceleration: 2, maxDegrees: 3 },
	footprint: (p) => [p.length, p.length * 0.16],
	height: (p) => HULL_HEIGHT + Math.max(1.15, p.containerLayers * BOX.height + 0.1),
	Component: ({ props: p, colors, palette, lights }) => {
		const width = p.length * 0.16;
		const hull = useMemo(() => boatHullGeometry(p.length, width, HULL_HEIGHT), [p.length, width]);
		useLayoutEffect(() => () => hull.dispose(), [hull]);
		// The hold: from behind the bow to in front of the bridge.
		const holdFrom = -p.length * 0.28;
		const holdTo = p.length * 0.3;
		const bays = Math.max(1, Math.floor((holdTo - holdFrom) / (BOX.length + 0.04)));
		const rows = Math.max(1, Math.floor((width * 0.82) / (BOX.width + 0.02)));
		const bridgeX = -p.length * 0.38;
		return (
			<group>
				<mesh geometry={hull} castShadow receiveShadow>
					<Mat color={colors.hull} />
				</mesh>

				<Box
					size={[p.length * 0.86, 0.03, width * 0.9]}
					position={[-p.length * 0.04, HULL_HEIGHT + 0.015, 0]}
					color={colors.bridge}
					castShadow={false}
				/>

				{/* The containers, bay by bay, each stack its own height; one colour or the other. */}
				{spread(bays, holdTo - holdFrom).flatMap((along, bay) =>
					spread(rows, rows * (BOX.width + 0.02)).flatMap((across, row) => {
						const seed = bay * 7 + row * 3;
						const layers = Math.round(p.containerLayers * (0.6 + 0.4 * jitter(seed)));
						const heights = Array.from(
							{ length: layers },
							(_, layer) => HULL_HEIGHT + 0.03 + BOX.height * (layer + 0.5),
						);
						return heights.map((y) => (
							<Box
								key={`${along}:${across}:${y}`}
								size={[BOX.length, BOX.height - 0.01, BOX.width]}
								position={[(holdFrom + holdTo) / 2 + along, y, across]}
								color={jitter(seed + y * 50) > 0.45 ? colors.containers : colors.otherContainers}
							/>
						));
					}),
				)}

				{/* The bridge at the stern: a tall block of cabins, wider at the top, windows all round. */}
				<group position={[bridgeX, HULL_HEIGHT, 0]}>
					<Box size={[0.55, 0.62, width * 0.8]} position={[0, 0.31, 0]} color={colors.bridge} />

					<Box size={[0.4, 0.16, width * 0.96]} position={[0.05, 0.7, 0]} color={colors.bridge} />

					<Box
						size={[0.42, 0.06, width * 0.98]}
						position={[0.05, 0.71, 0]}
						color={palette.glass}
						castShadow={false}
						{...lightEmission(lights.bridge, 1.2)}
					/>

					{[0.2, 0.42].map((y) => (
						<Box
							key={y}
							size={[0.56, 0.05, width * 0.81]}
							position={[0, y, 0]}
							color={palette.glass}
							castShadow={false}
							{...lightEmission(lights.bridge, 1)}
						/>
					))}

					{/* The mast on the bridge's roof, its lamp at the top. */}
					<Box size={[0.03, 0.34, 0.03]} position={[0.05, 0.95, 0]} color={palette.trim} />

					<LightLens
						light={lights.mastheadLamp}
						size={[0.05, 0.05, 0.05]}
						position={[0.05, 1.13, 0]}
					/>

					{/* The funnel behind the bridge, with its band. */}
					<mesh position={[-0.42, 0.42, 0]} castShadow>
						<boxGeometry args={[0.22, 0.84, 0.26]} />

						<Mat color={colors.bridge} />
					</mesh>

					<Box
						size={[0.23, 0.12, 0.27]}
						position={[-0.42, 0.72, 0]}
						color={colors.funnel}
						castShadow={false}
					/>
				</group>
			</group>
		);
	},
});
