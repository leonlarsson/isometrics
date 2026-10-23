import { z } from "zod";

import { LitWindows } from "../nightLights";
import { Box, RBox, spread } from "../primitives";
import { definePart } from "../types";

const FLOOR_HEIGHT = 0.62;
/** Roof cap thickness and overhang; the overhang must exceed the 0.05 band/mullion outset. */
const ROOF_CAP = 0.08;
const ROOF_OVERHANG = 0.1;

const TowerSchema = z.object({
	width: z.number().min(1).max(12).default(3.2),
	depth: z.number().min(1).max(12).default(3.2),
	floors: z.number().int().min(1).max(40).default(9),
});

export const officeTower01 = definePart({
	kind: "office_tower_01",
	name: "Office tower",
	category: "buildings",
	description: "Multi-storey building with a window grid",
	keywords: ["office", "skyscraper", "high-rise", "apartments", "building", "block"],
	schema: TowerSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 12, step: 0.25 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 12, step: 0.25 },
		{ key: "floors", label: "Floors", type: "number", min: 1, max: 40, step: 1 },
	],
	defaultColor: "#2bb58c",
	defaultAccent: "#e8f6f0",
	colorLabel: "Facade",
	accentLabel: "Window grid",
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.floors * FLOOR_HEIGHT + ROOF_CAP + 0.5,
	Component: ({ props: p, color, accent, palette }) => {
		const h = p.floors * FLOOR_HEIGHT;
		const columnsX = Math.max(2, Math.round(p.width / 0.7));
		const columnsZ = Math.max(2, Math.round(p.depth / 0.7));
		return (
			<group>
				<RBox size={[p.width, h, p.depth]} position={[0, h / 2, 0]} color={color} radius={0.08} />

				<LitWindows
					palette={palette}
					color={color}
					width={p.width}
					depth={p.depth}
					height={h}
					columnsX={columnsX}
					columnsZ={columnsZ}
					floors={p.floors}
					seed={p.floors * 7 + Math.round(p.width * 13) + Math.round(p.depth * 5)}
				/>

				{/* Bands between floors only; the roof cap covers the top so no faces are coplanar. */}

				{Array.from({ length: p.floors - 1 }, (_, i) => (
					<Box
						// biome-ignore lint/suspicious/noArrayIndexKey: floors are positional
						key={i}
						size={[p.width + 0.05, 0.1, p.depth + 0.05]}
						position={[0, (i + 1) * FLOOR_HEIGHT - 0.05, 0]}
						color={accent}
						castShadow={false}
					/>
				))}

				{spread(columnsX, p.width)
					.slice(0, -1)
					.map((x) => (
						<Box
							key={`x${x}`}
							size={[0.07, h, p.depth + 0.05]}
							position={[x + p.width / columnsX / 2, h / 2, 0]}
							color={accent}
							castShadow={false}
						/>
					))}

				{spread(columnsZ, p.depth)
					.slice(0, -1)
					.map((z) => (
						<Box
							key={`z${z}`}
							size={[p.width + 0.05, h, 0.07]}
							position={[0, h / 2, z + p.depth / columnsZ / 2]}
							color={accent}
							castShadow={false}
						/>
					))}

				<Box
					size={[p.width + ROOF_OVERHANG, ROOF_CAP, p.depth + ROOF_OVERHANG]}
					position={[0, h + ROOF_CAP / 2, 0]}
					color={accent}
				/>

				<Box
					size={[p.width * 0.45, 0.45, p.depth * 0.35]}
					position={[0, h + ROOF_CAP + 0.22, 0]}
					color={accent}
				/>
			</group>
		);
	},
});
