import { z } from "zod";

import { LightLens, LightPool } from "../lights";
import { Mat } from "../primitives";
import { definePart } from "../types";

const FixtureSchema = z.enum(["spot", "hidden"]);

/**
 * A light on its own (ADR-0058): a small spotlight on the ground, or no
 * fixture at all, lighting a pool around it. Everything about its light (when,
 * colour, strength, reach, data) is in the Lights tab, like any part's lights.
 */
export const light01 = definePart({
	kind: "light_01",
	name: "Light",
	category: "infrastructure",
	description:
		"A light on its own that lights the ground around it, from a small spotlight or no fixture at all",
	keywords: ["lamp", "spotlight", "floodlight", "lighting", "glow", "night"],
	schema: z.object({
		fixture: FixtureSchema.default("spot").describe(
			"What it looks like: spot = a small spotlight on the ground, hidden = just its light.",
		),
	}),
	fields: [
		{
			key: "fixture",
			label: "Fixture",
			type: "select",
			options: [
				{ value: "spot", label: "Ground spot" },
				{ value: "hidden", label: "Hidden (just the light)" },
			],
		},
	],
	lights: [{ id: "light", name: "Light", shape: "pool", reach: 3 }],
	colors: [{ id: "fixture", name: "Fixture", default: "#4a4d55", legacy: "color" }],
	footprint: () => [0.4, 0.4],
	height: (p) => (p.fixture === "spot" ? 0.3 : 0.05),
	Component: ({ props: p, colors, lights }) => (
		<group>
			{p.fixture === "spot" && (
				<group>
					<mesh position={[0, 0.1, 0]} castShadow>
						<cylinderGeometry args={[0.12, 0.15, 0.2, 10]} />

						<Mat color={colors.fixture} />
					</mesh>

					{/* The lens on top, glowing while the light is on. */}
					<LightLens light={lights.light} size={[0.2, 0.03, 0.2]} position={[0, 0.215, 0]} />
				</group>
			)}

			<LightPool light={lights.light} />
		</group>
	),
});
