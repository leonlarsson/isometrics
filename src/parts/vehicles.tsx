import { z } from "zod";

import { Box, RBox, Wheel } from "./primitives";
import { definePart } from "./types";

const NoProps = z.object({});

export const van = definePart({
	kind: "van",
	name: "Delivery van",
	category: "vehicles",
	description: "Small van; can drive along a route",
	keywords: ["delivery", "vehicle"],
	schema: NoProps,
	fields: [],
	defaultColor: "#f7f7f4",
	defaultAccent: "#3d4fd6",
	colorLabel: "Body",
	accentLabel: "Stripe & roof",
	canFollowPath: true,
	footprint: () => [1.7, 0.85],
	height: () => 1.05,
	Component: ({ color, accent, palette }) => {
		const L = 1.7;
		const W = 0.85;
		const H = 0.8;
		return (
			<group>
				<RBox size={[L, H, W]} position={[0, H / 2 + 0.15, 0]} color={color} radius={0.12} />

				<Box
					size={[0.05, H * 0.36, W * 0.84]}
					position={[L / 2, H * 0.74 + 0.15, 0]}
					color={palette.glass}
					castShadow={false}
				/>

				<Box
					size={[L * 0.72, 0.11, W + 0.02]}
					position={[-0.12, 0.42, 0]}
					color={accent}
					castShadow={false}
				/>

				<Box size={[L * 0.6, 0.05, W * 0.86]} position={[-0.2, H + 0.17, 0]} color={accent} />

				{[L * 0.3, -L * 0.3].flatMap((x) =>
					[W / 2 - 0.04, -W / 2 + 0.04].map((z) => (
						<Wheel key={`${x}:${z}`} position={[x, 0.17, z]} color={palette.tire} />
					)),
				)}
			</group>
		);
	},
});

export const truck = definePart({
	kind: "truck",
	name: "Truck",
	category: "vehicles",
	description: "Box truck; can drive along a route",
	keywords: ["lorry", "delivery", "vehicle"],
	schema: NoProps,
	fields: [],
	defaultColor: "#f7f7f4",
	defaultAccent: "#e2603b",
	colorLabel: "Cargo box",
	accentLabel: "Cab",
	canFollowPath: true,
	footprint: () => [2.7, 1.05],
	height: () => 1.4,
	Component: ({ color, accent, palette }) => (
		<group>
			<RBox size={[0.8, 0.9, 0.98]} position={[0.92, 0.62, 0]} color={accent} radius={0.1} />

			<Box
				size={[0.05, 0.32, 0.84]}
				position={[1.32, 0.8, 0]}
				color={palette.glass}
				castShadow={false}
			/>

			<RBox size={[1.85, 1.15, 1.04]} position={[-0.4, 0.76, 0]} color={color} radius={0.06} />

			{[0.95, -0.15, -0.9].flatMap(
				(x) =>
					[0.46, -0.46].map((z) => (
						<Wheel key={`${x}:${z}`} position={[x, 0.18, z]} radius={0.18} color={palette.tire} />
					)),
				// No clipping, but looks odd...
				// [0.452, -0.452].map((z) => (
				// 	<Wheel key={`${x}:${z}`} position={[x, 0.18, z]} radius={0.18} color={palette.tire} />
				// )),
			)}
		</group>
	),
});

export const car = definePart({
	kind: "car",
	name: "Car",
	category: "vehicles",
	description: "Small car; can drive along a route",
	keywords: ["taxi", "vehicle", "automobile"],
	schema: NoProps,
	fields: [],
	defaultColor: "#f2c230",
	defaultAccent: "#2f3a56",
	colorLabel: "Body",
	accentLabel: "Windows",
	canFollowPath: true,
	footprint: () => [1.25, 0.66],
	height: () => 0.8,
	Component: ({ color, accent, palette }) => (
		<group>
			<RBox size={[1.25, 0.34, 0.66]} position={[0, 0.3, 0]} color={color} radius={0.1} />

			<RBox size={[0.66, 0.28, 0.58]} position={[-0.06, 0.6, 0]} color={accent} radius={0.08} />

			{[0.38, -0.38].flatMap((x) =>
				[0.3, -0.3].map((z) => (
					<Wheel
						key={`${x}:${z}`}
						position={[x, 0.14, z]}
						radius={0.14}
						width={0.1}
						color={palette.tire}
					/>
				)),
			)}
		</group>
	),
});
