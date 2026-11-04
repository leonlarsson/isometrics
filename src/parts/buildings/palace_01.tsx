import { z } from "zod";

import { floodlitSurface, lightEmission } from "../lights";
import { jitter, spread } from "../primitives";
import type { IResolvedLight } from "../types";
import { definePart } from "../types";

import { Block, isWindowLit, Prism } from "./clusterPieces";
import { PaneRow, paneRuns } from "./windowKit";

/**
 * A baroque palace (Stockholm's Kungliga slottet, a royal residence, a
 * ministry): four wings round a square courtyard, a rusticated ground floor,
 * pavilions standing proud in the middle and at the corners of each front, a
 * cornice and balustrade over a low roof, and two pairs of lower wings
 * reaching out east and west. Its front, with the main portal, faces +Z.
 * Floodlit after dark, its windows lit one by one.
 */

const PalaceSchema = z.object({
	width: z.number().min(2).max(20).default(9),
	depth: z.number().min(1.6).max(20).default(9),
	floorCount: z.number().int().min(2).max(8).default(5),
	wingDepth: z.number().min(0.6).max(4).default(2),
	showsSideWings: z.boolean().default(true),
	sideWingLength: z.number().min(1).max(6).default(2.4),
	seed: z.number().int().min(0).max(9999).default(1),
});

type TPalace = z.output<typeof PalaceSchema>;

const GROUND_FLOOR = 0.5;
const FLOOR = 0.42;
/** The cornice and the balustrade over it. */
const CORNICE = 0.08;
const BALUSTRADE = 0.18;
/** How far the pavilions stand out from the fronts, and how much higher their attic is. */
const PROUD = 0.14;
/** How brightly its floodlit fronts glow, as a share of the floodlights' level. */
const FLOODLIT = 0.55;
const PAVILION_RISE = 0.22;
/** Window panes, across and up, and how far apart they stand. */
const PANE: [number, number] = [0.16, 0.26];
const WINDOW_SPACING = 0.5;

const wallHeightOf = (floors: number) => GROUND_FLOOR + (floors - 1) * FLOOR;

/**
 * A front's windows in rooms: runs of the windows that stand at the same depth
 * (on a pavilion or the wall between), three to a room, each lit as one.
 */
const roomsOf = (xs: readonly number[], proudAt: (x: number) => number) => {
	const stretches: number[][] = [];
	for (const x of xs) {
		const last = stretches[stretches.length - 1];
		if (last && proudAt(last[0]) === proudAt(x)) {
			last.push(x);
		} else {
			stretches.push([x]);
		}
	}
	return stretches.flatMap((stretch) => paneRuns(stretch, 3));
};

/** The side wings' size: a floor or two lower than the palace, a little shallower than its wings. */
const sideWingOf = (p: TPalace) => ({
	floors: Math.max(2, p.floorCount - 2),
	depth: Math.max(0.8, p.wingDepth * 0.75),
});

interface IFacadeProps {
	/** How long the wall is, and where its face stands from the middle, before it's turned. */
	length: number;
	at: number;
	/** Turned about the vertical so the face looks out (0 = +Z). */
	turn: number;
	floors: number;
	/** Stands proud: a pavilion in the middle and at each end. */
	hasPavilions: boolean;
	seed: number;
	colors: { walls: string; trim: string; plinth: string };
	glass: string;
	windows: IResolvedLight;
	floodlights: IResolvedLight;
}

/**
 * One front: its pavilions standing proud (in the middle and at the ends), its
 * rusticated ground floor, and rows of windows, each lit in its own turn.
 */
const Facade = ({
	length,
	at,
	turn,
	floors,
	hasPavilions,
	seed,
	colors,
	glass,
	windows,
	floodlights,
}: IFacadeProps) => {
	const height = wallHeightOf(floors);
	const middle = Math.min(length * 0.26, 2.6);
	const end = Math.min(length * 0.12, 1.2);
	const columns = Math.max(3, Math.round(length / WINDOW_SPACING));
	const pavilions = hasPavilions
		? [
				{ x: 0, width: middle },
				{ x: -length / 2 + end / 2, width: end },
				{ x: length / 2 - end / 2, width: end },
			]
		: [];
	const proudAt = (x: number) =>
		pavilions.some((pavilion) => Math.abs(x - pavilion.x) < pavilion.width / 2) ? PROUD : 0;
	const lit = (color: string) => floodlitSurface(floodlights, color, FLOODLIT);
	return (
		<group rotation={[0, turn, 0]}>
			{pavilions.map((pavilion) => (
				<group key={pavilion.x} position={[pavilion.x, 0, at + PROUD / 2]}>
					<Block
						position={[0, (height + PAVILION_RISE) / 2, 0]}
						size={[pavilion.width, height + PAVILION_RISE, PROUD + 0.002]}
						color={colors.walls}
						{...lit(colors.walls)}
					/>

					<Block
						position={[0, height + PAVILION_RISE + CORNICE / 2, 0.01]}
						size={[pavilion.width + 0.06, CORNICE, PROUD + 0.04]}
						color={colors.trim}
						castShadow={false}
					/>
				</group>
			))}

			{/* The rusticated ground floor, a little proud of the wall. */}
			{[
				{ x: 0, width: length, proud: 0 },
				...pavilions.map((pavilion) => ({ ...pavilion, proud: PROUD })),
			].map((band) => (
				<Block
					key={`band${band.x},${band.width}`}
					position={[band.x, GROUND_FLOOR / 2, at + band.proud + 0.012]}
					size={[band.width + 0.02, GROUND_FLOOR, 0.024]}
					color={colors.plinth}
					castShadow={false}
				/>
			))}

			{roomsOf(spread(columns, length * 0.94), proudAt).flatMap((room, r) => {
				const z = at + proudAt(room.at);
				return Array.from({ length: floors }, (_, floor) => {
					const y = floor === 0 ? GROUND_FLOOR * 0.5 : GROUND_FLOOR + FLOOR * (floor - 0.5);
					return (
						<PaneRow
							key={`${room.at},${y}`}
							xs={room.xs}
							size={floor === 0 ? [PANE[0], PANE[1] * 0.8] : PANE}
							position={[room.at, y, z + (floor === 0 ? 0.026 : 0.004)]}
							color={glass}
							{...(isWindowLit(jitter(seed * 389 + r * 13 + floor * 101), windows.litPaneShare)
								? lightEmission(windows, 1.3)
								: {})}
						/>
					);
				});
			})}
		</group>
	);
};

const palaceFootprint = (p: TPalace): [number, number] => [
	p.width + 2 * PROUD + (p.showsSideWings ? 2 * p.sideWingLength : 0),
	p.depth + 2 * PROUD + 0.6,
];

export const palace01 = definePart({
	kind: "palace_01",
	name: "Palace",
	category: "buildings",
	description:
		"A baroque palace of four wings round a square courtyard, with pavilions, a balustrade and lower side wings east and west; its portal faces +Z",
	keywords: [
		"royal palace",
		"castle",
		"slott",
		"kungliga slottet",
		"residence",
		"parliament",
		"ministry",
		"courtyard",
		"landmark",
		"baroque",
	],
	schema: PalaceSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 2, max: 20, step: 0.25 },
		{ key: "depth", label: "Depth", type: "number", min: 1.6, max: 20, step: 0.25 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 2, max: 8, step: 1 },
		{ key: "wingDepth", label: "Wing depth", type: "number", min: 0.6, max: 4, step: 0.1 },
		{ key: "showsSideWings", label: "Show the side wings", type: "boolean" },
		{
			key: "sideWingLength",
			label: "Side wing length",
			type: "number",
			min: 1,
			max: 6,
			step: 0.1,
		},
		{ key: "seed", label: "Variation", type: "number", min: 0, max: 9999, step: 1 },
	],
	colors: [
		{ id: "walls", name: "Walls", default: "#d6c29a", legacy: "color" },
		{ id: "trim", name: "Cornices and balustrade", default: "#efe6cf", legacy: "accent" },
		{ id: "plinth", name: "Ground floor", default: "#b9a37c" },
		{ id: "roof", name: "Roof", default: "#56605c" },
		{ id: "courtyard", name: "Courtyard", default: "#c9bc9c" },
		{ id: "doors", name: "Portal", default: "#3a2e26" },
	],
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "The halls and offices inside, lit one after another as it gets dark.",
			shape: "windows",
			color: "#f3c27a",
			litPaneShare: 0.4,
			comesOn: "oneByOne",
		},
		{
			id: "floodlights",
			name: "Floodlights",
			description: "Lamps at its foot lighting its fronts after dark.",
			shape: "glow",
			color: "#ffd9a6",
			comesOn: "gradually",
			// Out in front of each side, low, shining back at the walls.
			realLight: (p) => {
				const out = 1.6;
				const y = 0.8;
				return [
					{ at: [0, y, p.depth / 2 + out], reach: p.width * 1.1 },
					{ at: [0, y, -p.depth / 2 - out], reach: p.width * 1.1 },
					{ at: [p.width / 2 + out, y, 0], reach: p.depth * 1.1 },
					{ at: [-p.width / 2 - out, y, 0], reach: p.depth * 1.1 },
				];
			},
		},
	],
	sizeAlong: { x: "width", z: "depth" },
	footprint: palaceFootprint,
	height: (p) => wallHeightOf(p.floorCount) + PAVILION_RISE + CORNICE + 0.4,
	Component: ({ props: p, colors, palette, lights }) => {
		const height = wallHeightOf(p.floorCount);
		const wing = Math.min(p.wingDepth, p.width / 3, p.depth / 3);
		// Too small for a courtyard: one block.
		const hasCourtyard = Math.min(p.width, p.depth) - 2 * wing >= 0.6;
		const inner: [number, number] = [p.width - 2 * wing, p.depth - 2 * wing];
		const lit = (color: string) => floodlitSurface(lights.floodlights, color, FLOODLIT);
		const facade = {
			colors,
			glass: palette.glass,
			windows: lights.windows,
			floodlights: lights.floodlights,
		};
		const side = sideWingOf(p);
		const sideHeight = wallHeightOf(side.floors);
		// The wings: north and south across the whole width, east and west between them.
		const wings: { at: [number, number]; size: [number, number]; alongX: boolean }[] = hasCourtyard
			? [
					{ at: [0, p.depth / 2 - wing / 2], size: [p.width, wing], alongX: true },
					{ at: [0, -p.depth / 2 + wing / 2], size: [p.width, wing], alongX: true },
					{ at: [p.width / 2 - wing / 2, 0], size: [wing, inner[1]], alongX: false },
					{ at: [-p.width / 2 + wing / 2, 0], size: [wing, inner[1]], alongX: false },
				]
			: [{ at: [0, 0], size: [p.width, p.depth], alongX: p.width >= p.depth }];
		const sideWings = p.showsSideWings
			? [-1, 1].flatMap((east) =>
					[-1, 1].map((south) => ({
						x: east * (p.width / 2 + p.sideWingLength / 2),
						z: south * (p.depth / 2 - side.depth / 2),
						east,
						south,
					})),
				)
			: [];
		return (
			<group>
				{wings.map(({ at: [x, z], size: [w, d], alongX }) => (
					<group key={`${x},${z}`} position={[x, 0, z]}>
						<Block
							position={[0, height / 2, 0]}
							size={[w, height, d]}
							color={colors.walls}
							{...lit(colors.walls)}
						/>

						{/* Cornice, balustrade, and a low roof behind it. */}
						<Block
							position={[0, height + CORNICE / 2, 0]}
							size={[w + 0.08, CORNICE, d + 0.08]}
							color={colors.trim}
						/>

						<Block
							position={[0, height + CORNICE + BALUSTRADE / 2, 0]}
							size={[w - 0.02, BALUSTRADE, d - 0.02]}
							color={colors.trim}
						/>

						<Prism
							position={[0, height + CORNICE + BALUSTRADE - 0.02, 0]}
							size={alongX ? [w - 0.3, 0.42, d - 0.3] : [d - 0.3, 0.42, w - 0.3]}
							rotation={alongX ? undefined : [0, Math.PI / 2, 0]}
							color={colors.roof}
						/>
					</group>
				))}

				{/* The courtyard's paving. */}
				{hasCourtyard && (
					<Block
						position={[0, 0.012, 0]}
						size={[inner[0] + 0.01, 0.024, inner[1] + 0.01]}
						color={colors.courtyard}
						castShadow={false}
					/>
				)}

				{/* The four fronts, then the courtyard's walls looking in. */}
				<Facade
					length={p.width}
					at={p.depth / 2}
					turn={0}
					floors={p.floorCount}
					hasPavilions
					seed={p.seed}
					{...facade}
				/>

				<Facade
					length={p.width}
					at={p.depth / 2}
					turn={Math.PI}
					floors={p.floorCount}
					hasPavilions
					seed={p.seed + 1}
					{...facade}
				/>

				<Facade
					length={p.depth}
					at={p.width / 2}
					turn={Math.PI / 2}
					floors={p.floorCount}
					hasPavilions
					seed={p.seed + 2}
					{...facade}
				/>

				<Facade
					length={p.depth}
					at={p.width / 2}
					turn={-Math.PI / 2}
					floors={p.floorCount}
					hasPavilions
					seed={p.seed + 3}
					{...facade}
				/>

				{(hasCourtyard ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : []).map((turn, i) => (
					<Facade
						key={turn}
						length={(i % 2 === 0 ? inner[0] : inner[1]) - 0.1}
						// Facing into the courtyard: the wing's inner wall on the far side from where it looks.
						at={-(i % 2 === 0 ? inner[1] : inner[0]) / 2}
						turn={turn}
						floors={p.floorCount}
						hasPavilions={false}
						seed={p.seed + 10 + i}
						{...facade}
					/>
				))}

				{/* The main portal: a dark arch between columns, a pediment over it. */}
				<group position={[0, 0, p.depth / 2 + PROUD]}>
					<Block
						position={[0, 0.34, 0.03]}
						size={[0.42, 0.68, 0.04]}
						color={colors.doors}
						castShadow={false}
					/>

					{[-0.42, -0.3, 0.3, 0.42].map((x) => (
						<Block
							key={x}
							position={[x, 0.62, 0.06]}
							size={[0.08, 1.24, 0.1]}
							color={colors.trim}
						/>
					))}

					<Prism
						position={[0, 1.24, 0.06]}
						size={[1.0, 0.28, 0.12]}
						color={colors.trim}
						castShadow={false}
					/>
				</group>

				{/* The lower side wings, east and west, reaching out from its corners. */}
				{sideWings.map(({ x, z, east, south }) => (
					<group key={`${east},${south}`} position={[x, 0, z]}>
						<Block
							position={[0, sideHeight / 2, 0]}
							size={[p.sideWingLength + 0.02, sideHeight, side.depth]}
							color={colors.walls}
							{...lit(colors.walls)}
						/>

						<Block
							position={[0, sideHeight + CORNICE / 2, 0]}
							size={[p.sideWingLength + 0.06, CORNICE, side.depth + 0.08]}
							color={colors.trim}
						/>

						<Prism
							position={[0, sideHeight + CORNICE, 0]}
							size={[p.sideWingLength, 0.36, side.depth + 0.04]}
							color={colors.roof}
						/>

						<Facade
							length={p.sideWingLength - 0.1}
							at={side.depth / 2}
							turn={south > 0 ? 0 : Math.PI}
							floors={side.floors}
							hasPavilions={false}
							seed={p.seed + 20 + east * 3 + south}
							{...facade}
						/>
					</group>
				))}

				{/* Floodlights at its foot, two before each front. */}
				{[0, Math.PI / 2, Math.PI, -Math.PI / 2].flatMap((turn, i) => {
					const length = i % 2 === 0 ? p.width : p.depth;
					const out = (i % 2 === 0 ? p.depth : p.width) / 2 + PROUD + 0.45;
					return [-0.3, 0.3].map((share) => (
						<group key={`${turn},${share}`} rotation={[0, turn, 0]}>
							<Block
								position={[share * length, 0.07, out]}
								size={[0.16, 0.14, 0.12]}
								color="#3b3d40"
							/>

							<Block
								position={[share * length, 0.1, out - 0.065]}
								size={[0.12, 0.08, 0.01]}
								color="#f4ead2"
								castShadow={false}
								{...lightEmission(lights.floodlights, 2.4)}
							/>
						</group>
					));
				})}
			</group>
		);
	},
});
