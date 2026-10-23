import { z } from "zod";

import { Mat } from "../primitives";
import { definePart } from "../types";

const LampSchema = z.object({
	height: z.number().min(0.5).max(6).default(1.6),
});

export const streetLamp01 = definePart({
	kind: "street_lamp_01",
	name: "Street lamp",
	category: "infrastructure",
	description: "Lamp post",
	keywords: ["light", "street light", "lantern"],
	schema: LampSchema,
	fields: [{ key: "height", label: "Height", type: "number", min: 0.5, max: 6, step: 0.1 }],
	defaultColor: "#9a9a96",
	defaultAccent: "#ffe8a3",
	colorLabel: "Post",
	accentLabel: "Light",
	footprint: () => [0.4, 0.4],
	height: (p) => p.height + 0.1,
	Component: ({ props: p, color, accent }) => (
		<group>
			<mesh position={[0, p.height / 2, 0]} castShadow>
				<cylinderGeometry args={[0.04, 0.05, p.height, 8]} />

				<Mat color={color} />
			</mesh>

			<mesh position={[0, p.height + 0.04, 0]}>
				<sphereGeometry args={[0.1, 12, 12]} />

				<Mat color={accent} emissive={accent} />
			</mesh>
		</group>
	),
});
