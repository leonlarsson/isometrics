import { useLayoutEffect, useMemo } from "react";
import type * as THREE from "three";
import { z } from "zod";

import { lightEmission } from "../lights";
import { jitter, Mat, spread, type TV3 } from "../primitives";
import type { IPartRenderProps } from "../types";
import { definePart } from "../types";

import { isWindowLit, shadeOf } from "./clusterPieces";
import { createPieces } from "./mergedKit";

/**
 * An old town's row of tall narrow houses (Gamla stan, Bryggen, Amsterdam's
 * canals): each house its own height, colour and roof, most with their eaves
 * to the street and some with a gable, plain or stepped. The whole
 * row is built once as one geometry with a colour per vertex (`mergedKit`,
 * ADR-0143), with its lit windows and its shop windows a mesh each, so an old
 * town of hundreds of houses is a few hundred meshes; its windows light one by
 * one, a floor of a house (a flat) at a time.
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

/** Where a point on a house's front (or, side −1, its back) is in the row: x across the house, z out from its middle. */
const onFace = (house: IHouse, side: number, x: number, y: number, z: number): TV3 => [
	house.x + side * x,
	y,
	side * z,
];

/** Where a house's windows are: each floor's, the one downstairs beside the door, the gable's; each with when it lights. */
const windowsOf = (p: TTerrace) => {
	const front = p.depth / 2;
	const across = spread(columnsOf(p.houseWidth), p.houseWidth * 0.86);
	const sides = p.hasWindowsAtTheBack ? [1, -1] : [1];
	return housesOf(p).flatMap((house, index) => {
		const score = (k: number) => jitter(p.seed * 977 + index * 61 + k);
		const turn = (side: number) => (side === 1 ? 0 : Math.PI);
		return [
			// Upstairs: a row of windows on each floor, a flat each, lit in its own turn.
			...sides.flatMap((side) =>
				Array.from({ length: house.floors - 1 }, (_, floor) => ({
					panes: across.map((x) =>
						onFace(house, side, x, GROUND_FLOOR + FLOOR * (floor + 0.5), front),
					),
					size: PANE,
					out: 0.004,
					turn: turn(side),
					side,
					score: score(side * 500 + floor * 7),
				})),
			),
			// Downstairs, beside the door, where there's no shop.
			...(house.hasShop
				? []
				: sides.map((side) => ({
						panes: [onFace(house, side, -house.doorAt * p.houseWidth * 0.8, 0.24, front)],
						size: [PANE[0], PANE[1] * 0.9] as const,
						out: 0.012,
						turn: turn(side),
						side,
						score: score(side * 500 + 99),
					}))),
			// The gable's, on gabled houses.
			...(house.roof === "eaves"
				? []
				: [
						{
							panes: [onFace(house, 1, 0, house.wallHeight + house.roofHeight * 0.3, front)],
							size: [PANE[0] * 0.8, PANE[1] * 0.75] as const,
							out: 0.046,
							turn: 0,
							side: 1,
							score: score(999),
						},
					]),
		];
	});
};

type TRowColors = Record<(typeof WALL_COLOURS)[number] | "roof" | "trim" | "doors", string>;

/** The whole row but its lit windows and shop windows, as one geometry with a colour per vertex. */
const bodyOf = (p: TTerrace, colors: TRowColors, glass: string) => {
	const pieces = createPieces();
	const front = p.depth / 2;
	const sides = p.hasWindowsAtTheBack ? [1, -1] : [1];
	const doorWidth = Math.min(0.2, p.houseWidth * 0.26);
	for (const house of housesOf(p)) {
		const { x, wallHeight, roof, roofHeight } = house;
		const wall = shadeOf(colors[WALL_COLOURS[house.wallTone]], house.shade);
		const roofColor = shadeOf(colors.roof, house.shade * 0.8);
		pieces.box({
			at: [x, wallHeight / 2, 0],
			size: [p.houseWidth, wallHeight, p.depth],
			color: wall,
		});
		// A cornice along the top of the front and back.
		pieces.box({
			at: [x, wallHeight - CORNICE / 2, 0],
			size: [p.houseWidth - 0.01, CORNICE, p.depth + 0.05],
			color: colors.trim,
		});
		for (const side of sides) {
			pieces.box({
				at: onFace(house, side, house.doorAt * p.houseWidth, 0.17, front + 0.008),
				size: [doorWidth, 0.3, 0.016],
				color: colors.doors,
			});
		}
		if (roof === "eaves") {
			// Its ridge along the street, the roof just over the walls' front and back.
			pieces.prism({
				at: [x, wallHeight, 0],
				size: [p.houseWidth, roofHeight, p.depth + EAVES * 2],
				color: roofColor,
			});
			// Its side walls' gables under the roof, seen where a neighbour is lower.
			pieces.prism({
				at: [x, wallHeight, 0],
				size: [p.houseWidth + 0.01, roofHeight * 0.97, p.depth],
				color: wall,
			});
			if (house.hasChimney) {
				pieces.box({
					at: [x + p.houseWidth * 0.28, wallHeight + roofHeight * 0.7, -p.depth * 0.08],
					size: [0.1, roofHeight * 0.75, 0.12],
					color: shadeOf(wall, -0.3),
				});
			}
		} else {
			// Its gable to the street: the ridge runs back from the front.
			pieces.prism({
				at: [x, wallHeight, -0.01],
				size: [p.depth - 0.02, roofHeight, p.houseWidth + 0.06],
				color: roofColor,
				turn: Math.PI / 2,
			});
			if (roof === "gable") {
				// The gable's wall, up into the roof, just in front of it.
				pieces.prism({
					at: [x, wallHeight - 0.001, front + 0.012],
					size: [0.05, roofHeight * 0.98, p.houseWidth],
					color: wall,
					turn: Math.PI / 2,
				});
			} else {
				// A stepped gable: the front wall rising past the roof in steps.
				for (const step of [0, 1, 2, 3]) {
					pieces.box({
						at: [x, wallHeight + (roofHeight * (step + 0.5)) / 4 + 0.02, front - 0.025],
						size: [p.houseWidth * (1 - step * 0.24) + 0.02, roofHeight / 4 + 0.04, 0.07],
						color: wall,
					});
				}
			}
		}
	}
	// Every window's glass, dark; the lit ones are drawn again just in front (litWindowsOf).
	for (const window of windowsOf(p)) {
		for (const [px, py, pz] of window.panes) {
			pieces.pane({
				at: [px, py, pz + window.side * window.out],
				size: [window.size[0], window.size[1], 1],
				color: glass,
				turn: window.turn,
			});
		}
	}
	return pieces.geometry();
};

/** The windows lit now, as one geometry just in front of their glass; null when none is. */
const litWindowsOf = (p: TTerrace, litPaneShare: number) => {
	const pieces = createPieces();
	for (const window of windowsOf(p)) {
		if (!isWindowLit(window.score, litPaneShare)) {
			continue;
		}
		for (const [px, py, pz] of window.panes) {
			pieces.pane({
				at: [px, py, pz + window.side * (window.out + 0.003)],
				size: [window.size[0], window.size[1], 1],
				color: "#ffffff",
				turn: window.turn,
			});
		}
	}
	return pieces.isEmpty() ? null : pieces.geometry();
};

/** The shop windows downstairs, as one geometry; null when there are none. */
const shopWindowsOf = (p: TTerrace) => {
	const pieces = createPieces();
	const front = p.depth / 2;
	for (const house of housesOf(p)) {
		if (!house.hasShop) {
			continue;
		}
		for (const side of p.hasWindowsAtTheBack ? [1, -1] : [1]) {
			pieces.box({
				at: onFace(house, side, -house.doorAt * p.houseWidth * 0.75, 0.2, front + 0.008),
				size: [p.houseWidth * 0.42, 0.22, 0.014],
				color: "#ffffff",
			});
		}
	}
	return pieces.isEmpty() ? null : pieces.geometry();
};

/** Keeps a geometry while what it's built from stays the same, and lets it go when it's replaced. */
const useGeometry = (build: () => THREE.BufferGeometry | null, key: string) => {
	const geometry = useMemo(build, [key]);
	useLayoutEffect(() => () => geometry?.dispose(), [geometry]);
	return geometry;
};

const Row = ({
	props: p,
	colors,
	palette,
	lights,
}: IPartRenderProps<TTerrace, keyof TRowColors>) => {
	const look = JSON.stringify([p, colors, palette.glass]);
	const body = useGeometry(() => bodyOf(p, colors, palette.glass), look);
	const litPaneShare = lights.windows.litPaneShare;
	const lit = useGeometry(() => litWindowsOf(p, litPaneShare), `${look}|${litPaneShare}`);
	const shops = useGeometry(() => shopWindowsOf(p), look);
	return (
		<group>
			<mesh geometry={body ?? undefined} castShadow receiveShadow>
				<meshStandardMaterial vertexColors roughness={0.85} metalness={0} flatShading />
			</mesh>

			{lit && (
				<mesh geometry={lit} visible={lights.windows.on}>
					<Mat color={palette.glass} {...lightEmission(lights.windows, 1.3)} />
				</mesh>
			)}

			{shops && (
				<mesh geometry={shops} receiveShadow>
					<Mat color={palette.glass} {...lightEmission(lights.shops, 1.2)} />
				</mesh>
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
	Component: Row,
});
