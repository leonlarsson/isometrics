import { z } from "zod";

import { LitWindows } from "../lights";
import { Box, RBox, spread } from "../primitives";
import { definePart } from "../types";

const FLOOR_HEIGHT = 0.62;
/** Roof cap thickness and overhang; the overhang must exceed the 0.05 band/mullion outset. */
const ROOF_CAP = 0.08;
const ROOF_OVERHANG = 0.1;

const TowerSchema = z.object({
	width: z.number().min(1).max(12).default(3.2),
	depth: z.number().min(1).max(12).default(3.2),
	floorCount: z.number().int().min(1).max(40).default(9),
});

export const officeTower01 = definePart({
	kind: "office_tower_01",
	name: "Office tower",
	category: "buildings",
	// Two kinds of window light, each lighting its own panes: nine in ten are rooms, one a screen.
	// Keep the weights: they decide whose panes are whose.
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "Lamps in the offices.",
			shape: "windows",
			color: "#e3a14c",
			litPanes: 0.28,
			weight: 9,
			comesOn: "oneByOne",
			// The windows' light on the street round the tower (the screens add none of their own).
			realLight: (p) => ({
				at: [0, Math.min(1.5, (p.floorCount * FLOOR_HEIGHT) / 2), 0],
				reach: Math.max(p.width, p.depth) * 1.6,
			}),
		},
		{
			id: "screens",
			name: "Screens",
			description: "Computer screens left on at desks.",
			shape: "windows",
			color: "#8fb4e0",
			litPanes: 0.2,
			weight: 1,
			comesOn: "oneByOne",
		},
	],
	description: "Multi-storey building with a window grid",
	keywords: ["office", "skyscraper", "high-rise", "apartments", "building", "block"],
	schema: TowerSchema,
	renamedProps: { floors: "floorCount" },
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 12, step: 0.25 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 12, step: 0.25 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 1, max: 40, step: 1 },
	],
	colors: [
		{ id: "facade", name: "Facade", default: "#2bb58c", legacy: "color" },
		{ id: "grid", name: "Window grid", default: "#e8f6f0", legacy: "accent" },
	],
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.floorCount * FLOOR_HEIGHT + ROOF_CAP + 0.5,
	Component: ({ props: p, colors, lights }) => {
		const h = p.floorCount * FLOOR_HEIGHT;
		const columnsX = Math.max(2, Math.round(p.width / 0.7));
		const columnsZ = Math.max(2, Math.round(p.depth / 0.7));
		return (
			<group>
				<RBox
					size={[p.width, h, p.depth]}
					position={[0, h / 2, 0]}
					color={colors.facade}
					radius={0.08}
				/>

				<LitWindows
					lights={[lights.windows, lights.screens]}
					width={p.width}
					depth={p.depth}
					height={h}
					columnsX={columnsX}
					columnsZ={columnsZ}
					floors={p.floorCount}
					seed={p.floorCount * 7 + Math.round(p.width * 13) + Math.round(p.depth * 5)}
				/>

				{/* Bands between floors only; the roof cap covers the top so no faces are coplanar. */}

				{Array.from({ length: p.floorCount - 1 }, (_, i) => (
					<Box
						// biome-ignore lint/suspicious/noArrayIndexKey: floors are positional
						key={i}
						size={[p.width + 0.05, 0.1, p.depth + 0.05]}
						position={[0, (i + 1) * FLOOR_HEIGHT - 0.05, 0]}
						color={colors.grid}
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
							color={colors.grid}
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
							color={colors.grid}
							castShadow={false}
						/>
					))}

				<Box
					size={[p.width + ROOF_OVERHANG, ROOF_CAP, p.depth + ROOF_OVERHANG]}
					position={[0, h + ROOF_CAP / 2, 0]}
					color={colors.grid}
				/>

				<Box
					size={[p.width * 0.45, 0.45, p.depth * 0.35]}
					position={[0, h + ROOF_CAP + 0.22, 0]}
					color={colors.grid}
				/>
			</group>
		);
	},
});
