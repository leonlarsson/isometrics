import { z } from "zod";

import { LightLens } from "../lights";
import { Box, Mat } from "../primitives";
import { definePart } from "../types";

const MotorbikeSchema = z.object({
	showsRider: z.boolean().default(true),
});

/** Its wheels: how far apart, how big, how fat the tyre. */
const WHEEL = { apart: 0.5, radius: 0.13, tyre: 0.035 };
const SEAT = { x: -0.08, y: 0.33 };
const BARS = { x: 0.18, y: 0.42 };

/** A tube from one point to another, in the bike's side plane (z = 0). */
const Tube = ({
	from: [x1, y1],
	to: [x2, y2],
	color,
	thickness,
}: {
	from: [number, number];
	to: [number, number];
	color: string;
	thickness: number;
}) => (
	<Box
		size={[Math.hypot(x2 - x1, y2 - y1), thickness, thickness]}
		position={[(x1 + x2) / 2, (y1 + y2) / 2, 0]}
		rotation={[0, 0, Math.atan2(y2 - y1, x2 - x1)]}
		color={color}
		castShadow={false}
	/>
);

export const motorbike01 = definePart({
	kind: "motorbike_01",
	name: "Motorbike",
	category: "vehicles",
	description: "Motorbike with a rider in a helmet; can ride along a road",
	keywords: ["motorcycle", "scooter", "moped", "bike", "rider", "courier", "vehicle"],
	schema: MotorbikeSchema,
	renamedProps: { showRider: "showsRider" },
	fields: [{ key: "showsRider", label: "Show the rider", type: "boolean" }],
	colors: [
		{ id: "body", name: "Tank and fairing", default: "#2b59c3", legacy: "color" },
		{ id: "riderTop", name: "Rider's jacket", default: "#2b2b2f", legacy: "accent" },
		{ id: "riderLegs", name: "Rider's trousers", default: "#3a3b40" },
		{ id: "helmet", name: "Helmet", default: "#f4f1ea" },
	],
	lights: [{ id: "headlight", name: "Headlight", shape: "lens", when: "driving" }],
	canFollowPath: true,
	turnLean: { degreesPerAcceleration: 9, maxDegrees: 22 },
	footprint: () => [WHEEL.apart + WHEEL.radius * 2 + 0.04, 0.2],
	height: (p) => (p.showsRider ? 0.8 : 0.48),
	Component: ({ props: p, colors, palette, lights }) => {
		const front: [number, number] = [WHEEL.apart / 2, WHEEL.radius];
		const rear: [number, number] = [-WHEEL.apart / 2, WHEEL.radius];
		return (
			<group>
				{/* Fat tyres standing along X. */}
				{[front, rear].map(([x]) => (
					<mesh key={x} position={[x, WHEEL.radius, 0]} castShadow>
						<torusGeometry args={[WHEEL.radius - WHEEL.tyre / 2, WHEEL.tyre, 6, 18]} />

						<Mat color={palette.tire} />
					</mesh>
				))}

				{/* The engine low between the wheels, the tank over it, the seat behind. */}
				<Box size={[0.2, 0.14, 0.12]} position={[0, 0.2, 0]} color={palette.tire} />

				<Box size={[0.22, 0.1, 0.14]} position={[0.06, 0.34, 0]} color={colors.body} />

				<Box size={[0.24, 0.05, 0.12]} position={[SEAT.x - 0.04, SEAT.y, 0]} color={palette.tire} />

				{/* The fork up to the bars, the swingarm back to the rear wheel. */}
				<Tube from={front} to={[BARS.x, BARS.y]} color={palette.trim} thickness={0.03} />

				<Tube from={rear} to={[-0.06, 0.2]} color={palette.trim} thickness={0.03} />

				<Box size={[0.025, 0.025, 0.26]} position={[BARS.x, BARS.y, 0]} color={palette.tire} />

				{/* A small fairing round the headlight. */}
				<Box
					size={[0.06, 0.1, 0.13]}
					position={[BARS.x + 0.05, BARS.y - 0.06, 0]}
					color={colors.body}
				/>

				<LightLens
					light={lights.headlight}
					size={[0.02, 0.05, 0.07]}
					position={[BARS.x + 0.085, BARS.y - 0.07, 0]}
				/>

				{/* The rider: legs to the footpegs, a body leaning to the bars, arms, a helmet. */}
				{p.showsRider && (
					<group>
						{[0.07, -0.07].map((z) => (
							<group key={z} position={[0, 0, z]}>
								<Tube
									from={[SEAT.x, SEAT.y + 0.04]}
									to={[0.04, 0.27]}
									color={colors.riderLegs}
									thickness={0.06}
								/>

								<Tube
									from={[0.04, 0.27]}
									to={[-0.02, 0.15]}
									color={colors.riderLegs}
									thickness={0.05}
								/>
							</group>
						))}

						<Tube
							from={[SEAT.x, SEAT.y + 0.04]}
							to={[0.04, 0.62]}
							color={colors.riderTop}
							thickness={0.13}
						/>

						{[0.08, -0.08].map((z) => (
							<group key={z} position={[0, 0, z]}>
								<Tube
									from={[0.03, 0.58]}
									to={[BARS.x, BARS.y + 0.02]}
									color={colors.riderTop}
									thickness={0.04}
								/>
							</group>
						))}

						<mesh position={[0.07, 0.71, 0]} castShadow>
							<sphereGeometry args={[0.075, 12, 10]} />

							<Mat color={colors.helmet} roughness={0.35} />
						</mesh>

						{/* The visor, dark, facing ahead. */}
						<Box
							size={[0.03, 0.035, 0.11]}
							position={[0.135, 0.715, 0]}
							color={palette.glass}
							castShadow={false}
						/>
					</group>
				)}
			</group>
		);
	},
});
