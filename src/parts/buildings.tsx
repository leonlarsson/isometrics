import { z } from "zod";

import { Box, GableRoof, RBox, spread } from "./primitives";
import { definePart } from "./types";

// ---------------------------------------------------------------- warehouse

const WarehouseSchema = z.object({
	width: z.number().min(2).max(30).default(8),
	depth: z.number().min(2).max(30).default(5),
	height: z.number().min(1).max(10).default(3),
	doors: z.number().int().min(0).max(8).default(3),
	solar: z.boolean().default(true),
});

export const warehouse = definePart({
	kind: "warehouse",
	name: "Warehouse",
	category: "buildings",
	description: "Large hall with loading doors and solar roof",
	schema: WarehouseSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 2, max: 30, step: 0.5 },
		{ key: "depth", label: "Depth", type: "number", min: 2, max: 30, step: 0.5 },
		{ key: "height", label: "Height", type: "number", min: 1, max: 10, step: 0.25 },
		{ key: "doors", label: "Doors", type: "number", min: 0, max: 8, step: 1 },
		{ key: "solar", label: "Solar panels", type: "boolean" },
	],
	defaultColor: "#3d4fd6",
	defaultAccent: "#e3e6f7",
	colorLabel: "Walls",
	accentLabel: "Roof",
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height + 0.4,
	Component: ({ props: p, color, accent, palette }) => {
		const { width: w, depth: d, height: h } = p;
		const cols = Math.max(1, Math.floor((w - 1) / 1.5));
		const rows = Math.max(1, Math.floor((d - 1) / 1.5));
		const doorWidth = p.doors > 0 ? Math.min(1.3, ((w - 1) / p.doors) * 0.7) : 0;
		return (
			<group>
				<RBox size={[w, h, d]} position={[0, h / 2, 0]} color={color} radius={0.1} />

				<Box size={[w + 0.2, 0.22, d + 0.2]} position={[0, h + 0.11, 0]} color={accent} />

				{p.solar &&
					spread(cols, w - 0.8).flatMap((x) =>
						spread(rows, d - 0.8).map((z) => (
							<Box
								key={`${x}:${z}`}
								size={[1.15, 0.08, 0.95]}
								position={[x, h + 0.26, z]}
								rotation={[-0.12, 0, 0]}
								color={palette.panel}
								roughness={0.4}
							/>
						)),
					)}

				{spread(p.doors, w - 1).map((x) => (
					<Box
						key={x}
						size={[doorWidth, Math.min(1.8, h * 0.6), 0.06]}
						position={[x, Math.min(1.8, h * 0.6) / 2, d / 2 + 0.03]}
						color={palette.glass}
						castShadow={false}
					/>
				))}

				<Box
					size={[0.9, 0.4, 0.06]}
					position={[w / 2 - 0.9, h * 0.82, d / 2 + 0.03]}
					color={palette.signal}
					castShadow={false}
				/>
			</group>
		);
	},
});

// -------------------------------------------------------------------- tower

const FLOOR_HEIGHT = 0.62;

const TowerSchema = z.object({
	width: z.number().min(1).max(12).default(3.2),
	depth: z.number().min(1).max(12).default(3.2),
	floors: z.number().int().min(1).max(40).default(9),
});

export const tower = definePart({
	kind: "tower",
	name: "Office tower",
	category: "buildings",
	description: "Multi-storey building with a window grid",
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
	height: (p) => p.floors * FLOOR_HEIGHT + 0.5,
	Component: ({ props: p, color, accent }) => {
		const h = p.floors * FLOOR_HEIGHT;
		const columnsX = Math.max(2, Math.round(p.width / 0.7));
		const columnsZ = Math.max(2, Math.round(p.depth / 0.7));
		return (
			<group>
				<RBox size={[p.width, h, p.depth]} position={[0, h / 2, 0]} color={color} radius={0.08} />

				{Array.from({ length: p.floors }, (_, i) => (
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
					size={[p.width * 0.45, 0.45, p.depth * 0.35]}
					position={[0, h + 0.22, 0]}
					color={accent}
				/>
			</group>
		);
	},
});

// -------------------------------------------------------------------- house

const HouseSchema = z.object({
	width: z.number().min(1).max(8).default(2.4),
	depth: z.number().min(1).max(8).default(2.2),
	height: z.number().min(0.6).max(5).default(1.3),
	roofHeight: z.number().min(0.2).max(4).default(0.9),
	chimney: z.boolean().default(true),
});

export const house = definePart({
	kind: "house",
	name: "House",
	category: "buildings",
	description: "Small house with a pitched roof",
	schema: HouseSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 8, step: 0.1 },
		{ key: "height", label: "Wall height", type: "number", min: 0.6, max: 5, step: 0.1 },
		{ key: "roofHeight", label: "Roof height", type: "number", min: 0.2, max: 4, step: 0.1 },
		{ key: "chimney", label: "Chimney", type: "boolean" },
	],
	defaultColor: "#f07b4f",
	defaultAccent: "#6b4a3a",
	colorLabel: "Roof",
	accentLabel: "Door",
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height + p.roofHeight,
	Component: ({ props: p, color, accent, palette }) => (
		<group>
			<Box
				size={[p.width, p.height, p.depth]}
				position={[0, p.height / 2, 0]}
				color={palette.wall}
			/>

			<GableRoof
				width={p.width + 0.3}
				depth={p.depth + 0.4}
				height={p.roofHeight}
				position={[0, p.height, 0]}
				color={color}
			/>

			<Box
				size={[0.42, Math.min(0.8, p.height * 0.7), 0.05]}
				position={[p.width * 0.22, Math.min(0.8, p.height * 0.7) / 2, p.depth / 2 + 0.025]}
				color={accent}
				castShadow={false}
			/>

			<Box
				size={[0.45, 0.4, 0.05]}
				position={[-p.width * 0.22, p.height * 0.58, p.depth / 2 + 0.025]}
				color={palette.glass}
				castShadow={false}
			/>

			{p.chimney && (
				<Box
					size={[0.28, p.roofHeight * 0.9, 0.28]}
					position={[p.width * 0.28, p.height + p.roofHeight * 0.55, -p.depth * 0.15]}
					color={palette.trim}
				/>
			)}
		</group>
	),
});

// --------------------------------------------------------------------- shed

const ShedSchema = z.object({
	width: z.number().min(1).max(16).default(3.6),
	depth: z.number().min(1).max(16).default(3),
	height: z.number().min(0.5).max(6).default(1.6),
	garageDoor: z.boolean().default(true),
});

export const shed = definePart({
	kind: "shed",
	name: "Depot",
	category: "buildings",
	description: "Low flat-roofed building",
	schema: ShedSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 1, max: 16, step: 0.25 },
		{ key: "depth", label: "Depth", type: "number", min: 1, max: 16, step: 0.25 },
		{ key: "height", label: "Height", type: "number", min: 0.5, max: 6, step: 0.1 },
		{ key: "garageDoor", label: "Garage door", type: "boolean" },
	],
	defaultColor: "#8a5cf0",
	defaultAccent: "#ece6fb",
	colorLabel: "Walls",
	accentLabel: "Roof",
	footprint: (p) => [p.width, p.depth],
	height: (p) => p.height + 0.2,
	Component: ({ props: p, color, accent, palette }) => (
		<group>
			<RBox
				size={[p.width, p.height, p.depth]}
				position={[0, p.height / 2, 0]}
				color={color}
				radius={0.08}
			/>

			<Box
				size={[p.width + 0.15, 0.16, p.depth + 0.15]}
				position={[0, p.height + 0.08, 0]}
				color={accent}
			/>

			{p.garageDoor && (
				<Box
					size={[Math.min(1.6, p.width * 0.5), p.height * 0.65, 0.05]}
					position={[0, (p.height * 0.65) / 2, p.depth / 2 + 0.025]}
					color={palette.trim}
					castShadow={false}
				/>
			)}
		</group>
	),
});
