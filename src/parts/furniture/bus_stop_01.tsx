import { z } from "zod";

import { lightEmission } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const BusStopSchema = z.object({
	showsSidePanel: z.boolean().default(true),
});

/** The shelter, in metres: how long, deep and tall. */
const SHELTER = { length: 3, depth: 1.3, height: 2.3 };
const POST = 0.06;

export const busStop01 = definePart({
	kind: "bus_stop_01",
	name: "Bus stop",
	category: "furniture",
	description:
		"A bus shelter with a glass back, a bench, a lit advert, a light under its roof and a stop sign on a pole; you wait facing +Z",
	keywords: ["shelter", "bus", "tram", "stop", "public transport", "street furniture"],
	schema: BusStopSchema,
	renamedProps: { showSidePanel: "showsSidePanel" },
	fields: [{ key: "showsSidePanel", label: "Show the side panel", type: "boolean" }],
	colors: [
		{ id: "frame", name: "Frame and roof", default: "#3d4048", legacy: "color" },
		{ id: "sign", name: "Stop sign", default: "#d6402f", legacy: "accent" },
		{ id: "glass", name: "Glass", default: "#cfe0e6", seeThrough: { transparency: 0.6 } },
		{ id: "bench", name: "Bench", default: "#a8743f" },
	],
	lights: [
		{
			id: "lamp",
			name: "Shelter light",
			description:
				"A light strip under the roof and a lit advert at its end, lighting the bench and the pavement.",
			shape: "glow",
			color: "#f2f4ff",
			realLight: () => ({ at: [0, metres(SHELTER.height - 0.3), metres(0.4)], reach: 1.2 }),
		},
	],
	footprint: () => [metres(SHELTER.length + 0.9), metres(SHELTER.depth + 0.1)],
	height: () => metres(SHELTER.height + 0.4),
	Component: ({ props: p, colors, transparency, lights }) => {
		const half = SHELTER.length / 2;
		const back = -SHELTER.depth / 2 + 0.05;
		const front = SHELTER.depth / 2 - 0.05;
		const glass = (
			<meshStandardMaterial
				color={colors.glass}
				transparent
				opacity={1 - transparency.glass}
				roughness={0.1}
				depthWrite={false}
			/>
		);
		return (
			// Drawn in metres.
			<group scale={UNITS_PER_METRE}>
				{/* Four posts, and the roof on them, sloping a little to the back. */}
				{[half - 0.05, -half + 0.05].flatMap((x) =>
					[back, front].map((z) => (
						<mesh key={`${x}:${z}`} position={[x, SHELTER.height / 2, z]} castShadow>
							<boxGeometry args={[POST, SHELTER.height, POST]} />

							<Mat color={colors.frame} />
						</mesh>
					)),
				)}

				<Box
					size={[SHELTER.length + 0.1, 0.08, SHELTER.depth + 0.15]}
					position={[0, SHELTER.height + 0.04, 0]}
					rotation={[-0.05, 0, 0]}
					color={colors.frame}
				/>

				{/* The light strip under the roof. */}
				<Box
					size={[SHELTER.length - 0.4, 0.03, 0.12]}
					position={[0, SHELTER.height - 0.02, 0]}
					color="#e8e9ee"
					castShadow={false}
					{...lightEmission(lights.lamp, 1.4)}
				/>

				{/* The glass back, and a side panel at one end. */}
				<mesh position={[0, SHELTER.height / 2 + 0.05, back]}>
					<boxGeometry args={[SHELTER.length - 0.1, SHELTER.height - 0.3, 0.02]} />

					{glass}
				</mesh>

				{p.showsSidePanel && (
					<mesh position={[half - 0.05, SHELTER.height / 2 + 0.05, 0]}>
						<boxGeometry args={[0.02, SHELTER.height - 0.3, SHELTER.depth - 0.15]} />

						{glass}
					</mesh>
				)}

				{/* A lit advert at the open end, facing in (the light under the roof is out of sight from above). */}
				<Box
					size={[0.08, 1.5, SHELTER.depth - 0.35]}
					position={[-half + 0.05, 1.15, 0]}
					color={colors.frame}
				/>

				<Box
					size={[0.02, 1.36, SHELTER.depth - 0.5]}
					position={[-half + 0.1, 1.15, 0]}
					color="#e9eef2"
					castShadow={false}
					{...lightEmission(lights.lamp, 1.1)}
				/>

				{/* A bench along the back. */}
				<Box size={[1.8, 0.05, 0.36]} position={[-0.3, 0.46, back + 0.24]} color={colors.bench} />

				{[-1.1, 0.5].map((x) => (
					<Box
						key={x}
						size={[0.05, 0.44, 0.3]}
						position={[x, 0.22, back + 0.24]}
						color={colors.frame}
					/>
				))}

				{/* The stop sign on its pole, beside the shelter. */}
				<mesh position={[-half - 0.45, 1.3, front]} castShadow>
					<cylinderGeometry args={[0.04, 0.04, 2.6, 8]} />

					<Mat color={colors.frame} />
				</mesh>

				<mesh position={[-half - 0.45, 2.45, front]} rotation={[Math.PI / 2, 0, 0]} castShadow>
					<cylinderGeometry args={[0.24, 0.24, 0.04, 20]} />

					<Mat color={colors.sign} />
				</mesh>

				<Box
					size={[0.3, 0.07, 0.05]}
					position={[-half - 0.45, 2.45, front]}
					color="#f4f1ea"
					castShadow={false}
				/>
			</group>
		);
	},
});
