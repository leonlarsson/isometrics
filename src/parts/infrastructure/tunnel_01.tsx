import { z } from "zod";

import { Box, RBox } from "../primitives";
import { definePart } from "../types";

const TunnelSchema = z.object({
	length: z.number().min(2).max(60).default(10),
	/** Inside width; make it wider than the road. */
	width: z.number().min(1).max(12).default(3.2),
	height: z.number().min(0.8).max(5).default(1.5),
	/** Floors of building on top (0 = none), like a hotel built over the road. */
	buildingFloors: z.number().min(0).max(10).default(0),
});

const WALL = 0.35;

/**
 * A covered road section: two walls and a roof, open at both ends, with an
 * optional building on top. Place it over a road (its length runs along X;
 * rotate to match). Stands in for real tunnels until terrain exists.
 */
export const tunnel01 = definePart({
	kind: "tunnel_01",
	name: "Tunnel",
	category: "infrastructure",
	description: "Covered road section, open at both ends; place it over a road",
	keywords: ["underpass", "covered", "bridge"],
	schema: TunnelSchema,
	renamedProps: { building: "buildingFloors" },
	fields: [
		{ key: "length", label: "Length", type: "number", min: 2, max: 60, step: 0.5 },
		{ key: "width", label: "Inside width", type: "number", min: 1, max: 12, step: 0.1 },
		{ key: "height", label: "Inside height", type: "number", min: 0.8, max: 5, step: 0.1 },
		{
			key: "buildingFloors",
			label: "Floors of building on top",
			type: "number",
			min: 0,
			max: 10,
			step: 0.5,
		},
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#d9d4c7", legacy: "color" },
		{ id: "roof", name: "Roof & building", default: "#f1e8d8", legacy: "accent" },
	],
	footprint: (p) => [p.length, p.width + WALL * 2],
	height: (p) => p.height + WALL + p.buildingFloors,
	Component: ({ props: p, colors, palette }) => {
		const outer = p.width + WALL * 2;
		return (
			<group>
				{[1, -1].map((side) => (
					<Box
						key={side}
						size={[p.length, p.height, WALL]}
						position={[0, p.height / 2, side * (p.width / 2 + WALL / 2)]}
						color={colors.walls}
					/>
				))}

				<Box
					size={[p.length, WALL, outer]}
					position={[0, p.height + WALL / 2, 0]}
					color={colors.walls}
				/>

				{/* Darker portal bands at each opening, standing just proud of the roof's end faces */}
				{[1, -1].map((end) => (
					<Box
						key={end}
						size={[0.12, WALL * 1.2, outer + 0.04]}
						position={[end * (p.length / 2 - 0.04), p.height + WALL / 2, 0]}
						color={palette.trim}
						castShadow={false}
					/>
				))}

				{p.buildingFloors > 0 && (
					<RBox
						size={[p.length * 0.9, p.buildingFloors, outer + 1.2]}
						position={[0, p.height + WALL + p.buildingFloors / 2, 0]}
						color={colors.roof}
						radius={0.1}
					/>
				)}
			</group>
		);
	},
});
