import { z } from "zod";

import { LightLens } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const BicycleSchema = z.object({
	showRider: z.boolean().default(true),
});

/** Its wheels: how far apart, how big, how thick the tyre. */
const WHEEL = { apart: 0.36, radius: 0.12, tyre: 0.014 };
/** Where the saddle and the handlebar are. */
const SADDLE = { x: -0.06, y: 0.3 };
const BARS = { x: 0.14, y: 0.33 };

/** A thin tube from one point to another, in the bike's side plane (z = 0). */
const Tube = ({
	from: [x1, y1],
	to: [x2, y2],
	color,
	thickness = 0.016,
}: {
	from: [number, number];
	to: [number, number];
	color: string;
	thickness?: number;
}) => (
	<Box
		size={[Math.hypot(x2 - x1, y2 - y1), thickness, thickness]}
		position={[(x1 + x2) / 2, (y1 + y2) / 2, 0]}
		rotation={[0, 0, Math.atan2(y2 - y1, x2 - x1)]}
		color={color}
		castShadow={false}
	/>
);

export const bicycle01 = definePart({
	kind: "bicycle_01",
	name: "Bicycle",
	category: "vehicles",
	description: "Bicycle with a rider; can ride along a road or path",
	keywords: ["bike", "cycle", "cyclist", "rider", "commute", "vehicle"],
	schema: BicycleSchema,
	fields: [{ key: "showRider", label: "Show the rider", type: "boolean" }],
	colors: [
		{ id: "frame", name: "Frame", default: "#c8553d", legacy: "color" },
		{ id: "riderTop", name: "Rider's top", default: "#3d4fd6", legacy: "accent" },
		{ id: "riderLegs", name: "Rider's trousers", default: "#3a3b40" },
		{ id: "skin", name: "Rider's skin", default: "#d9a77e" },
	],
	lights: [
		{
			id: "lamp",
			name: "Front lamp",
			shape: "lens",
			when: "driving",
		},
	],
	canFollowPath: true,
	footprint: () => [WHEEL.apart + WHEEL.radius * 2 + 0.04, 0.16],
	height: (p) => (p.showRider ? 0.78 : 0.4),
	Component: ({ props: p, colors, palette, lights }) => {
		const hub: [number, number] = [WHEEL.apart / 2, WHEEL.radius];
		const rearHub: [number, number] = [-WHEEL.apart / 2, WHEEL.radius];
		const crank: [number, number] = [-0.02, WHEEL.radius];
		return (
			<group>
				{/* The wheels: thin rings standing along X. */}
				{[hub, rearHub].map(([x]) => (
					<mesh key={x} position={[x, WHEEL.radius, 0]} castShadow>
						<torusGeometry args={[WHEEL.radius, WHEEL.tyre, 6, 20]} />

						<Mat color={palette.tire} />
					</mesh>
				))}

				{/* The frame: two triangles of tubes and the fork. */}
				<Tube from={rearHub} to={crank} color={colors.frame} />

				<Tube from={rearHub} to={[SADDLE.x, SADDLE.y - 0.03]} color={colors.frame} />

				<Tube from={crank} to={[SADDLE.x, SADDLE.y - 0.03]} color={colors.frame} />

				<Tube from={crank} to={[BARS.x - 0.02, BARS.y - 0.06]} color={colors.frame} />

				<Tube
					from={[SADDLE.x, SADDLE.y - 0.03]}
					to={[BARS.x - 0.02, BARS.y - 0.06]}
					color={colors.frame}
				/>

				<Tube from={hub} to={[BARS.x, BARS.y]} color={colors.frame} />

				<Box
					size={[0.08, 0.02, 0.05]}
					position={[SADDLE.x - 0.01, SADDLE.y, 0]}
					color={palette.tire}
				/>

				<Box size={[0.02, 0.02, 0.2]} position={[BARS.x, BARS.y, 0]} color={palette.tire} />

				<LightLens
					light={lights.lamp}
					size={[0.03, 0.03, 0.04]}
					position={[BARS.x + 0.03, BARS.y - 0.04, 0]}
				/>

				{/* The rider: legs down to the pedals, a body leaning to the bars, arms, a head. */}
				{p.showRider && (
					<group>
						{[0.05, -0.05].map((z, i) => (
							<group key={z} position={[0, 0, z]}>
								<Tube
									from={[SADDLE.x, SADDLE.y + 0.02]}
									to={[crank[0] + (i === 0 ? 0.05 : -0.04), crank[1] + (i === 0 ? 0.02 : -0.03)]}
									color={colors.riderLegs}
									thickness={0.045}
								/>
							</group>
						))}

						<Tube
							from={[SADDLE.x, SADDLE.y + 0.02]}
							to={[0.06, 0.6]}
							color={colors.riderTop}
							thickness={0.1}
						/>

						{[0.06, -0.06].map((z) => (
							<group key={z} position={[0, 0, z]}>
								<Tube
									from={[0.05, 0.57]}
									to={[BARS.x, BARS.y + 0.02]}
									color={colors.riderTop}
									thickness={0.035}
								/>
							</group>
						))}

						{/* The neck up from the shoulders, and the head on it. */}
						<Tube from={[0.06, 0.59]} to={[0.075, 0.65]} color={colors.skin} thickness={0.035} />

						<mesh position={[0.08, 0.68, 0]} castShadow>
							<sphereGeometry args={[0.055, 10, 8]} />

							<Mat color={colors.skin} />
						</mesh>
					</group>
				)}
			</group>
		);
	},
});
