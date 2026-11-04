import { z } from "zod";

import { lightEmission } from "../lights";
import { jitter, spread } from "../primitives";
import type { IResolvedLight } from "../types";
import { definePart } from "../types";

import { Block, isWindowLit, Prism, shadeOf } from "./clusterPieces";
import { PaneRow } from "./windowKit";

/**
 * An old town's row of tall narrow houses (Gamla stan, Bryggen, Amsterdam's
 * canals): each house its own height, colour and roof, most with their eaves
 * to the street and some with a gable, plain or stepped. Drawn from a handful
 * of shapes of size 1 (`clusterPieces`), so every house of every row shares
 * them and they're drawn together (ADR-0086); its windows light one by one.
 */

const TerraceSchema = z.object({
	houseCount: z.number().int().min(1).max(12).default(5),
	houseWidth: z.number().min(0.5).max(2).default(0.85),
	depth: z.number().min(0.8).max(4).default(1.4),
	floorCount: z.number().int().min(2).max(8).default(4),
	floorCountVariation: z.number().int().min(0).max(3).default(1),
	gableShare: z.number().min(0).max(1).default(0.3),
	shopShare: z.number().min(0).max(1).default(0.5),
	hasWindowsAtTheBack: z.boolean().default(false),
	seed: z.number().int().min(0).max(9999).default(1),
});

type TTerrace = z.output<typeof TerraceSchema>;

/** The ground floor (a shop or a door), and every floor above it. */
const GROUND_FLOOR = 0.44;
const FLOOR = 0.34;
/** The cornice along the top of the facade. */
const CORNICE = 0.05;
/** How far the eaves reach out over the front and back. */
const EAVES = 0.04;
/** Window panes, across and up. */
const PANE: [number, number] = [0.12, 0.19];

/** How a house is roofed. */
type TRoof = "eaves" | "gable" | "stepped";

interface IHouse {
	x: number;
	floors: number;
	wallHeight: number;
	roof: TRoof;
	roofHeight: number;
	/** Which of the four wall colours, and how much lighter or darker. */
	wallTone: number;
	shade: number;
	hasShop: boolean;
	hasChimney: boolean;
	/** Where the door is across the front, as a share of the house's width from its middle. */
	doorAt: number;
}

const WALL_COLOURS = ["walls", "secondWalls", "thirdWalls", "fourthWalls"] as const;

/** The row's houses, worked out from its props and seed alone, so a row always looks the same. */
const housesOf = (p: TTerrace): IHouse[] => {
	const width = p.houseCount * p.houseWidth;
	let previousTone = -1;
	return spread(p.houseCount, width).map((x, i) => {
		const r = (k: number) => jitter(p.seed * 131 + i * 17 + k);
		const variation = p.floorCountVariation;
		const floors = Math.max(2, p.floorCount + Math.round((r(1) * 2 - 1) * variation));
		const wallHeight = GROUND_FLOOR + (floors - 1) * FLOOR + CORNICE;
		const gabled = r(2) < p.gableShare;
		const roof: TRoof = gabled ? (r(3) < 0.5 ? "stepped" : "gable") : "eaves";
		// Steep roofs: the eaves' over the house's depth, a gable's over its width.
		const roofHeight =
			roof === "eaves" ? Math.min(p.depth * 0.42, 0.9) : Math.min(p.houseWidth * 0.95, 1.2);
		// Four colours, mixed by the seed, never the same twice in a row.
		let wallTone = Math.floor(r(4) * WALL_COLOURS.length);
		if (wallTone === previousTone) {
			wallTone = (wallTone + 1 + Math.floor(r(5) * 3)) % WALL_COLOURS.length;
		}
		previousTone = wallTone;
		return {
			x,
			floors,
			wallHeight,
			roof,
			roofHeight,
			wallTone,
			shade: (r(6) - 0.5) * 0.14,
			hasShop: r(7) < p.shopShare,
			hasChimney: roof === "eaves" && r(8) < 0.55,
			doorAt: r(9) < 0.5 ? -0.28 : 0.28,
		};
	});
};

const tallestOf = (p: TTerrace) =>
	Math.max(...housesOf(p).map((house) => house.wallHeight + house.roofHeight));

/** Window columns across a house's front: three on most, two on narrow ones, four on wide. */
const columnsOf = (houseWidth: number) => (houseWidth < 0.72 ? 2 : houseWidth > 1.25 ? 4 : 3);

interface IHouseProps {
	house: IHouse;
	p: TTerrace;
	index: number;
	colors: Record<(typeof WALL_COLOURS)[number] | "roof" | "trim" | "doors", string>;
	glass: string;
	windows: IResolvedLight;
	shops: IResolvedLight;
}

const House = ({ house, p, index, colors, glass, windows, shops }: IHouseProps) => {
	const { wallHeight, roof, roofHeight } = house;
	const front = p.depth / 2;
	const wall = shadeOf(colors[WALL_COLOURS[house.wallTone]], house.shade);
	const roofColor = shadeOf(colors.roof, house.shade * 0.8);
	const columns = columnsOf(p.houseWidth);
	const across = spread(columns, p.houseWidth * 0.86);
	// The facades the windows are on: the front, and the back when the row is seen from behind too.
	const faces = p.hasWindowsAtTheBack ? [1, -1] : [1];
	const score = (k: number) => jitter(p.seed * 977 + index * 61 + k);
	const doorWidth = Math.min(0.2, p.houseWidth * 0.26);
	return (
		<group position={[house.x, 0, 0]}>
			<Block
				position={[0, wallHeight / 2, 0]}
				size={[p.houseWidth, wallHeight, p.depth]}
				color={wall}
			/>

			{/* A cornice along the top of the front and back. */}
			<Block
				position={[0, wallHeight - CORNICE / 2, 0]}
				size={[p.houseWidth - 0.01, CORNICE, p.depth + 0.05]}
				color={colors.trim}
				castShadow={false}
			/>

			{faces.map((side) => (
				<group key={side} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
					{/* Upstairs: a row of windows on each floor, a flat each, lit in its own turn. */}
					{Array.from({ length: house.floors - 1 }, (_, floor) => {
						const y = GROUND_FLOOR + FLOOR * (floor + 0.5);
						return (
							<PaneRow
								key={y}
								xs={across}
								size={PANE}
								position={[0, y, front + 0.004]}
								color={glass}
								{...(isWindowLit(score(side * 500 + floor * 7), windows.litPaneShare)
									? lightEmission(windows, 1.3)
									: {})}
							/>
						);
					})}

					{/* Downstairs: a door, and a shop window or two windows. */}
					<Block
						position={[house.doorAt * p.houseWidth, 0.17, front + 0.008]}
						size={[doorWidth, 0.3, 0.016]}
						color={colors.doors}
						castShadow={false}
					/>

					{house.hasShop ? (
						<Block
							position={[-house.doorAt * p.houseWidth * 0.75, 0.2, front + 0.008]}
							size={[p.houseWidth * 0.42, 0.22, 0.014]}
							color={glass}
							castShadow={false}
							{...lightEmission(shops, 1.2)}
						/>
					) : (
						<Block
							position={[-house.doorAt * p.houseWidth * 0.8, 0.24, front + 0.006]}
							size={[PANE[0], PANE[1] * 0.9, 0.012]}
							color={glass}
							castShadow={false}
							{...(isWindowLit(score(side * 500 + 99), windows.litPaneShare)
								? lightEmission(windows, 1.3)
								: {})}
						/>
					)}
				</group>
			))}

			{roof === "eaves" ? (
				<>
					{/* Its ridge along the street, the roof just over the walls' front and back. */}
					<Prism
						position={[0, wallHeight, 0]}
						size={[p.houseWidth + 0.004, roofHeight, p.depth + EAVES * 2]}
						color={roofColor}
					/>

					{/* Its side walls' gables under the roof, seen where a neighbour is lower. */}
					<Prism
						position={[0, wallHeight, 0]}
						size={[p.houseWidth + 0.01, roofHeight * 0.97, p.depth]}
						color={wall}
						castShadow={false}
					/>

					{house.hasChimney && (
						<Block
							position={[p.houseWidth * 0.28, wallHeight + roofHeight * 0.7, -p.depth * 0.08]}
							size={[0.1, roofHeight * 0.75, 0.12]}
							color={shadeOf(wall, -0.3)}
						/>
					)}
				</>
			) : (
				<>
					{/* Its gable to the street: the ridge runs back from the front. */}
					<Prism
						position={[0, wallHeight, -0.01]}
						size={[p.depth - 0.02, roofHeight, p.houseWidth + 0.06]}
						rotation={[0, Math.PI / 2, 0]}
						color={roofColor}
					/>

					{roof === "gable" ? (
						// The gable's wall, up into the roof, just in front of it.
						<Prism
							position={[0, wallHeight - 0.001, front + 0.012]}
							size={[0.05, roofHeight * 0.98, p.houseWidth]}
							rotation={[0, Math.PI / 2, 0]}
							color={wall}
							castShadow={false}
						/>
					) : (
						// A stepped gable: the front wall rising past the roof in steps.
						[0, 1, 2, 3].map((step) => (
							<Block
								key={step}
								position={[0, wallHeight + (roofHeight * (step + 0.5)) / 4 + 0.02, front - 0.025]}
								size={[p.houseWidth * (1 - step * 0.24) + 0.02, roofHeight / 4 + 0.04, 0.07]}
								color={wall}
							/>
						))
					)}

					{/* A window in the gable. */}
					<Block
						position={[0, wallHeight + roofHeight * 0.3, front + 0.04]}
						size={[PANE[0] * 0.8, PANE[1] * 0.75, 0.012]}
						color={glass}
						castShadow={false}
						{...(isWindowLit(score(999), windows.litPaneShare) ? lightEmission(windows, 1.3) : {})}
					/>
				</>
			)}
		</group>
	);
};

export const terracedRow02 = definePart({
	kind: "terraced_row_02",
	name: "Terraced houses",
	category: "buildings",
	description:
		"An old town's row of tall narrow houses, each its own height, colour and roof, some with a gable or a stepped gable to the street; along X, fronts facing +Z",
	keywords: [
		"old town",
		"gamla stan",
		"townhouses",
		"gabled",
		"stepped gable",
		"medieval",
		"merchant houses",
		"terrace",
		"street",
		"historic",
	],
	schema: TerraceSchema,
	fields: [
		{ key: "houseCount", label: "Number of houses", type: "number", min: 1, max: 12, step: 1 },
		{ key: "houseWidth", label: "House width", type: "number", min: 0.5, max: 2, step: 0.05 },
		{ key: "depth", label: "Depth", type: "number", min: 0.8, max: 4, step: 0.1 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 2, max: 8, step: 1 },
		{
			key: "floorCountVariation",
			label: "Floors more or fewer, up to",
			type: "number",
			min: 0,
			max: 3,
			step: 1,
		},
		{
			key: "gableShare",
			label: "Gables to the street",
			type: "number",
			min: 0,
			max: 1,
			step: 0.05,
		},
		{ key: "shopShare", label: "Shops downstairs", type: "number", min: 0, max: 1, step: 0.05 },
		{ key: "hasWindowsAtTheBack", label: "Windows at the back too", type: "boolean" },
		{ key: "seed", label: "Variation", type: "number", min: 0, max: 9999, step: 1 },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#d9a441", legacy: "color" },
		{ id: "secondWalls", name: "Second walls", default: "#b5533c", legacy: "accent" },
		{ id: "thirdWalls", name: "Third walls", default: "#e8c25a" },
		{ id: "fourthWalls", name: "Fourth walls", default: "#a9bf98" },
		{ id: "roof", name: "Roofs", default: "#4a4446" },
		{ id: "trim", name: "Cornices", default: "#efe8da" },
		{ id: "doors", name: "Doors", default: "#3b2f2a" },
	],
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "The houses' windows, lit one after another as it gets dark.",
			shape: "windows",
			litPaneShare: 0.6,
			comesOn: "oneByOne",
			// Out in the street in front, lighting the cobbles and the houses across the way.
			realLight: (p) => ({
				at: [0, 0.7, p.depth / 2 + 0.6],
				reach: Math.max(1.5, p.houseCount * p.houseWidth * 0.8),
			}),
		},
		{
			id: "shops",
			name: "Shop windows",
			description: "The shops and cafés downstairs.",
			shape: "glow",
			color: "#ffd08a",
		},
	],
	footprint: (p) => [p.houseCount * p.houseWidth, p.depth + EAVES * 2],
	// Only the eaves reach out over the street, from the lowest house's top: lanterns hang under them.
	overhang: (p) => ({
		foot: [p.houseCount * p.houseWidth, p.depth],
		from: Math.min(...housesOf(p).map((house) => house.wallHeight)),
	}),
	height: tallestOf,
	Component: ({ props: p, colors, palette, lights }) => (
		<group>
			{housesOf(p).map((house, i) => (
				<House
					key={house.x}
					house={house}
					p={p}
					index={i}
					colors={colors}
					glass={palette.glass}
					windows={lights.windows}
					shops={lights.shops}
				/>
			))}
		</group>
	),
});
