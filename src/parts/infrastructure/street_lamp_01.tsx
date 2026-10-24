import { z } from "zod";

import { LightPool } from "../lights";
import { Mat } from "../primitives";
import { definePart } from "../types";

const LampSchema = z.object({
	height: z.number().min(0.5).max(6).default(1.6),
});

/** The lamp's light colour unless it's set. */
const LAMPLIGHT = "#ffe8a3";

export const streetLamp01 = definePart({
	kind: "street_lamp_01",
	name: "Street lamp",
	category: "infrastructure",
	lights: [
		{
			id: "lamp",
			name: "Lamp",
			shape: "pool",
			color: LAMPLIGHT,
			reach: 2.3,
			// Before lights had settings of their own, a lamp's brightness and reach were props and
			// its light colour was its accent colour.
			legacy: ({ props, accent }) => ({
				strength: typeof props.brightness === "number" ? props.brightness : null,
				reach: typeof props.reach === "number" ? props.reach : null,
				color: accent,
			}),
		},
	],
	// Now its lamp light's strength and reach (ADR-0058); old values are read by its legacy hook.
	removedProps: ["brightness", "reach"],
	description: "Lamp post",
	keywords: ["light", "street light", "lantern"],
	schema: LampSchema,
	fields: [{ key: "height", label: "Height", type: "number", min: 0.5, max: 6, step: 0.1 }],
	defaultColor: "#9a9a96",
	defaultAccent: LAMPLIGHT,
	colorLabel: "Post",
	// Its light colour is the lamp light's, in the Lights tab.
	accentLabel: "Unused",
	footprint: () => [0.4, 0.4],
	height: (p) => p.height + 0.1,
	Component: ({ props: p, color, lights }) => (
		<group>
			<mesh position={[0, p.height / 2, 0]} castShadow>
				<cylinderGeometry args={[0.04, 0.05, p.height, 8]} />

				<Mat color={color} />
			</mesh>

			<mesh position={[0, p.height + 0.04, 0]}>
				<sphereGeometry args={[0.1, 12, 12]} />

				{/* The bulb shows its colour by day too, and glows brighter as its light comes on. */}
				<Mat
					color={lights.lamp.color}
					emissive={lights.lamp.color}
					emissiveIntensity={0.8 + 2.5 * Math.min(lights.lamp.level, 1.5)}
				/>
			</mesh>

			{/* Its light on the ground, as far as it reaches. */}
			<LightPool light={lights.lamp} />
		</group>
	),
});
