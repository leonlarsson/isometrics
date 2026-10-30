import { z } from "zod";

import { lightEmission } from "../lights";
import { Mat } from "../primitives";
import { definePart } from "../types";

import { metres, UNITS_PER_METRE } from "./furnitureSize";

const FountainSchema = z.object({
	diameter: z.number().min(0.8).max(6).default(1.8),
	showsJet: z.boolean().default(true),
});

/** The basin's rim, in metres: how tall and thick. */
const RIM = { height: 0.45, thickness: 0.22 };

export const fountain01 = definePart({
	kind: "fountain_01",
	name: "Fountain",
	category: "furniture",
	description:
		"A round stone basin with a two-tier fountain and a jet of water, for squares and parks",
	keywords: ["fountain", "water", "basin", "square", "plaza", "park", "street furniture"],
	schema: FountainSchema,
	renamedProps: { showJet: "showsJet" },
	fields: [
		{ key: "diameter", label: "Width", type: "number", min: 0.8, max: 6, step: 0.1 },
		{ key: "showsJet", label: "Show the jet of water", type: "boolean" },
	],
	colors: [
		{ id: "stone", name: "Stone", default: "#cfc8bb", legacy: "color" },
		{ id: "water", name: "Water", default: (p) => p.areas.water, legacy: "accent" },
	],
	lights: [
		{
			id: "basinLights",
			name: "Basin lights",
			description: "Lights under the water, lighting the jet and the pool after dark.",
			shape: "glow",
			color: "#bfe4ff",
		},
	],
	footprint: (p) => [p.diameter, p.diameter],
	height: (p) => metres(p.showsJet ? 2.4 : 1.6),
	Component: ({ props: p, colors, lights }) => {
		// Drawn in metres.
		const radius = p.diameter / UNITS_PER_METRE / 2;
		return (
			<group scale={UNITS_PER_METRE}>
				{/* The rim: a ring of stone round the pool. */}
				<mesh position={[0, RIM.height / 2, 0]} castShadow receiveShadow>
					<cylinderGeometry args={[radius, radius + 0.05, RIM.height, 28, 1, true]} />

					<Mat color={colors.stone} />
				</mesh>

				<mesh position={[0, RIM.height / 2, 0]} receiveShadow>
					<cylinderGeometry
						args={[radius - RIM.thickness, radius - RIM.thickness, RIM.height, 28, 1, true]}
					/>

					<Mat color={colors.stone} />
				</mesh>

				<mesh position={[0, RIM.height, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
					<ringGeometry args={[radius - RIM.thickness, radius, 28]} />

					<Mat color={colors.stone} />
				</mesh>

				{/* The pool, glowing a little from below after dark. */}
				<mesh position={[0, RIM.height - 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
					<circleGeometry args={[radius - RIM.thickness, 28]} />

					<Mat color={colors.water} roughness={0.15} {...lightEmission(lights.basinLights, 0.5)} />
				</mesh>

				{/* The centre: a column, a wide bowl, a smaller one on top. */}
				<mesh position={[0, 0.65, 0]} castShadow>
					<cylinderGeometry args={[0.12, 0.18, 1.1, 10]} />

					<Mat color={colors.stone} />
				</mesh>

				{[
					{ y: 1.12, top: 0.62, bottom: 0.3 },
					{ y: 1.55, top: 0.34, bottom: 0.16 },
				].map(({ y, top, bottom }) => (
					<group key={y} position={[0, y, 0]}>
						<mesh castShadow receiveShadow>
							<cylinderGeometry args={[top, bottom, 0.14, 16]} />

							<Mat color={colors.stone} />
						</mesh>

						<mesh position={[0, 0.072, 0]} rotation={[-Math.PI / 2, 0, 0]}>
							<circleGeometry args={[top - 0.05, 16]} />

							<Mat color={colors.water} roughness={0.15} />
						</mesh>
					</group>
				))}

				{/* The jet, and the water falling from the top bowl. */}
				{p.showsJet && (
					<group>
						<mesh position={[0, 1.95, 0]}>
							<coneGeometry args={[0.07, 0.75, 8]} />

							<meshStandardMaterial
								color="#e9f6ff"
								transparent
								opacity={0.75}
								roughness={0.1}
								{...lightEmission(lights.basinLights, 0.8)}
							/>
						</mesh>

						<mesh position={[0, 1.33, 0]}>
							<cylinderGeometry args={[0.36, 0.6, 0.4, 16, 1, true]} />

							<meshStandardMaterial
								color="#e9f6ff"
								transparent
								opacity={0.35}
								roughness={0.1}
								depthWrite={false}
							/>
						</mesh>
					</group>
				)}
			</group>
		);
	},
});
