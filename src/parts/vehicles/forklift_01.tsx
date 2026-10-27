import { z } from "zod";

import { LightLens } from "../lights";
import { Box, jitter, Wheel } from "../primitives";
import { definePart } from "../types";

const ForkliftSchema = z.object({
	forkHeight: z.number().min(0).max(1).default(0.1),
	showLoad: z.boolean().default(true),
});

/** The mast at the front: where it stands and how high it reaches. */
const MAST = { x: 0.36, height: 1.1, gap: 0.26 };
const PALLET = { size: 0.42, height: 0.05, wood: "#c9b48f" };

export const forklift01 = definePart({
	kind: "forklift_01",
	name: "Forklift",
	category: "vehicles",
	description:
		"Warehouse forklift with raisable forks, a pallet of boxes and a warning beacon; forks face +X, can drive along a route",
	keywords: ["warehouse", "pallet", "lift truck", "depot", "logistics", "vehicle"],
	schema: ForkliftSchema,
	fields: [
		{ key: "forkHeight", label: "Fork height", type: "number", min: 0, max: 1, step: 0.05 },
		{ key: "showLoad", label: "Show the load", type: "boolean" },
	],
	colors: [
		{ id: "body", name: "Body", default: "#f2c230", legacy: "color" },
		{ id: "load", name: "Load", default: (p) => p.cardboard, legacy: "accent" },
	],
	lights: [
		{
			id: "beacon",
			name: "Warning beacon",
			description: "The orange light on its roof, on while it moves after dark.",
			shape: "lens",
			color: "#ff9a2e",
			when: "driving",
		},
	],
	canFollowPath: true,
	footprint: () => [1.0, 0.5],
	height: () => MAST.height + 0.05,
	Component: ({ props: p, colors, palette, lights }) => {
		const forkY = 0.06 + p.forkHeight * (MAST.height - 0.3);
		return (
			<group>
				{/* The body, and the counterweight at the back. */}
				<Box size={[0.5, 0.3, 0.42]} position={[0, 0.28, 0]} color={colors.body} />

				<Box size={[0.16, 0.36, 0.44]} position={[-0.3, 0.3, 0]} color={palette.tire} />

				{/* The overhead guard: four posts and a roof, the beacon on top. */}
				{[0.18, -0.16].flatMap((x) =>
					[0.18, -0.18].map((z) => (
						<Box
							key={`${x},${z}`}
							size={[0.03, 0.5, 0.03]}
							position={[x, 0.68, z]}
							color={palette.tire}
						/>
					)),
				)}

				<Box size={[0.4, 0.03, 0.42]} position={[0.01, 0.94, 0]} color={palette.tire} />

				<LightLens light={lights.beacon} size={[0.07, 0.07, 0.07]} position={[-0.1, 0.99, 0]} />

				{/* The mast, and the forks on it at their height. */}
				{[MAST.gap / 2, -MAST.gap / 2].map((z) => (
					<Box
						key={z}
						size={[0.05, MAST.height, 0.05]}
						position={[MAST.x, MAST.height / 2, z]}
						color={palette.trim}
					/>
				))}

				<Box
					size={[0.04, 0.12, MAST.gap + 0.06]}
					position={[MAST.x + 0.04, forkY + 0.06, 0]}
					color={palette.trim}
				/>

				{[0.09, -0.09].map((z) => (
					<Box
						key={z}
						size={[0.46, 0.025, 0.05]}
						position={[MAST.x + 0.27, forkY, z]}
						color={palette.trim}
					/>
				))}

				{p.showLoad && (
					<group position={[MAST.x + 0.27, forkY + 0.0125, 0]}>
						<Box
							size={[PALLET.size, PALLET.height, PALLET.size]}
							position={[0, PALLET.height / 2, 0]}
							color={PALLET.wood}
						/>

						{[
							[-0.1, -0.1],
							[0.1, -0.1],
							[-0.1, 0.1],
							[0.1, 0.1],
						].map(([x, z], i) => (
							<Box
								key={`${x},${z}`}
								size={[0.18, 0.15 + jitter(i) * 0.04, 0.18]}
								position={[x, PALLET.height + 0.08, z]}
								color={colors.load}
							/>
						))}
					</group>
				)}

				{[0.16, -0.22].flatMap((x) =>
					[0.2, -0.2].map((z) => (
						<Wheel
							key={`${x}:${z}`}
							position={[x, 0.11, z]}
							radius={0.11}
							width={0.08}
							color={palette.tire}
						/>
					)),
				)}
			</group>
		);
	},
});
