import { z } from "zod";

import { LightPool } from "../lights";
import { Mat } from "../primitives";
import { definePart } from "../types";

const LampSchema = z.object({
	height: z.number().min(0.5).max(6).default(1.6),
	brightness: z.number().min(0).max(3).default(1),
	reach: z.number().min(0.5).max(8).default(2.3),
});

export const streetLamp01 = definePart({
	kind: "street_lamp_01",
	name: "Street lamp",
	category: "infrastructure",
	lights: {},
	description: "Lamp post",
	keywords: ["light", "street light", "lantern"],
	schema: LampSchema,
	fields: [
		{ key: "height", label: "Height", type: "number", min: 0.5, max: 6, step: 0.1 },
		{ key: "brightness", label: "Brightness", type: "number", min: 0, max: 3, step: 0.05 },
		{ key: "reach", label: "Light reach", type: "number", min: 0.5, max: 8, step: 0.1 },
	],
	defaultColor: "#9a9a96",
	defaultAccent: "#ffe8a3",
	colorLabel: "Post",
	accentLabel: "Light",
	footprint: () => [0.4, 0.4],
	height: (p) => p.height + 0.1,
	Component: ({ props: p, color, accent, palette }) => (
		<group>
			<mesh position={[0, p.height / 2, 0]} castShadow>
				<cylinderGeometry args={[0.04, 0.05, p.height, 8]} />

				<Mat color={color} />
			</mesh>

			<mesh position={[0, p.height + 0.04, 0]}>
				<sphereGeometry args={[0.1, 12, 12]} />

				<Mat
					color={accent}
					emissive={accent}
					emissiveIntensity={0.8 + 2.5 * palette.night * Math.min(p.brightness, 1.5)}
				/>
			</mesh>

			{/* Its light on the ground, in the lamp's own light colour. */}
			<LightPool palette={palette} radius={p.reach} color={accent} strength={p.brightness} />
		</group>
	),
});
