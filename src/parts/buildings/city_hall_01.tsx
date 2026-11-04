import { z } from "zod";

import { floodlitSurface, lightEmission } from "../lights";
import { jitter, spread } from "../primitives";
import type { IResolvedLight } from "../types";
import { definePart } from "../types";

import { Dome, Octagon, Spire } from "./churchKit";
import { Block, isWindowLit, Prism } from "./clusterPieces";
import { PaneRow, paneRuns } from "./windowKit";

/**
 * A brick city hall round a courtyard (Stockholm's Stadshuset): long wings of
 * dark red brick under copper-green roofs, an arcade along its front (+Z)
 * opening onto the courtyard, a slender turret at the back corner, and at the
 * front corner a tall square tower whose open copper lantern carries three
 * golden crowns. Floodlit after dark, its windows lit one by one.
 */

const CityHallSchema = z.object({
	width: z.number().min(4).max(20).default(9),
	depth: z.number().min(3).max(16).default(6.4),
	floorCount: z.number().int().min(2).max(8).default(4),
	wingDepth: z.number().min(0.8).max(4).default(1.6),
	towerHeight: z.number().min(2).max(14).default(6.6),
	seed: z.number().int().min(0).max(9999).default(1),
});

type TCityHall = z.output<typeof CityHallSchema>;

const FLOOR = 0.46;
const ROOF_HEIGHT = 0.7;
/** The tower's side, and its crown: the brick top, the open lantern, the copper cap and the crowns. */
const TOWER_SIDE = 1.35;
const CROWN = { lantern: 0.95, cap: 0.75, pole: 0.42 };
const PANE: [number, number] = [0.13, 0.24];
const FLOODLIT = 0.6;

const wallHeightOf = (p: TCityHall) => p.floorCount * FLOOR;

/** Where the tower stands: the front (+Z) right (+X) corner, standing out a little. */
const towerAt = (p: TCityHall): [number, number] => [
	p.width / 2 - TOWER_SIDE / 2 + 0.2,
	p.depth / 2 - TOWER_SIDE / 2 + 0.2,
];

/** Rows of windows along one wall, each lit in its own turn. */
const WindowRows = ({
	length,
	at,
	turn,
	floors,
	seed,
	glass,
	windows,
}: {
	length: number;
	at: number;
	turn: number;
	floors: number;
	seed: number;
	glass: string;
	windows: IResolvedLight;
}) => (
	<group rotation={[0, turn, 0]}>
		{/* Three windows to a room, each room lit as one. */}
		{paneRuns(spread(Math.max(2, Math.round(length / 0.5)), length * 0.92), 3).flatMap((room, r) =>
			Array.from({ length: floors }, (_, floor) => (
				<PaneRow
					// biome-ignore lint/suspicious/noArrayIndexKey: floors are positional
					key={`${room.at},${floor}`}
					xs={room.xs}
					size={PANE}
					position={[room.at, FLOOR * (floor + 0.55), at + 0.004]}
					color={glass}
					{...(isWindowLit(jitter(seed * 211 + r * 17 + floor * 89), windows.litPaneShare)
						? lightEmission(windows, 1.3)
						: {})}
				/>
			)),
		)}
	</group>
);

/** A golden crown: a band with points round its rim. */
const Crown = ({ position, color }: { position: [number, number, number]; color: string }) => (
	<group position={position}>
		<mesh>
			<cylinderGeometry args={[0.1, 0.08, 0.08, 10]} />

			<meshStandardMaterial color={color} roughness={0.35} metalness={0.4} />
		</mesh>

		{[0, 1, 2, 3, 4].map((i) => {
			const angle = (i / 5) * Math.PI * 2;
			return (
				<mesh key={i} position={[Math.cos(angle) * 0.085, 0.07, Math.sin(angle) * 0.085]}>
					<coneGeometry args={[0.025, 0.07, 4]} />

					<meshStandardMaterial color={color} roughness={0.35} metalness={0.4} />
				</mesh>
			);
		})}
	</group>
);

export const cityHall01 = definePart({
	kind: "city_hall_01",
	name: "City hall",
	category: "buildings",
	description:
		"A brick city hall round a courtyard (like Stockholm's Stadshuset): copper-green roofs, an arcade along the front (+Z), and a tall corner tower with an open lantern and three golden crowns",
	keywords: [
		"stadshuset",
		"town hall",
		"city hall",
		"brick",
		"tower",
		"three crowns",
		"tre kronor",
		"courtyard",
		"landmark",
		"civic",
	],
	schema: CityHallSchema,
	fields: [
		{ key: "width", label: "Width", type: "number", min: 4, max: 20, step: 0.25 },
		{ key: "depth", label: "Depth", type: "number", min: 3, max: 16, step: 0.25 },
		{ key: "floorCount", label: "Number of floors", type: "number", min: 2, max: 8, step: 1 },
		{ key: "wingDepth", label: "Wing depth", type: "number", min: 0.8, max: 4, step: 0.1 },
		{ key: "towerHeight", label: "Tower height", type: "number", min: 2, max: 14, step: 0.1 },
		{ key: "seed", label: "Variation", type: "number", min: 0, max: 9999, step: 1 },
	],
	colors: [
		{ id: "brick", name: "Brick", default: "#8e3d2c", legacy: "color" },
		{ id: "roof", name: "Copper roofs", default: "#7aa892", legacy: "accent" },
		{ id: "crowns", name: "Crowns", default: "#e0b84e" },
		{ id: "trim", name: "Stone trim", default: "#e3d6bd" },
		{ id: "courtyard", name: "Courtyard", default: "#b9a78a" },
	],
	lights: [
		{
			id: "windows",
			name: "Windows",
			description: "Offices and halls inside, lit one after another as it gets dark.",
			shape: "windows",
			color: "#f3c27a",
			litPaneShare: 0.35,
			comesOn: "oneByOne",
		},
		{
			id: "floodlights",
			name: "Floodlights",
			description: "Lamps at its foot lighting its walls and tower after dark.",
			shape: "glow",
			color: "#ffd9a6",
			comesOn: "gradually",
			realLight: (p) => {
				const [tx, tz] = towerAt(p);
				return [
					{ at: [tx + 0.6, 1, tz + 1.6], reach: p.towerHeight * 1.1 },
					{ at: [-p.width * 0.25, 0.8, p.depth / 2 + 1.4], reach: p.width * 0.8 },
				];
			},
		},
	],
	sizeAlong: { x: "width", z: "depth" },
	footprint: (p) => [p.width + 0.5, p.depth + 0.5],
	height: (p) => p.towerHeight + CROWN.lantern + CROWN.cap + CROWN.pole + 0.3,
	Component: ({ props: p, colors, palette, lights }) => {
		const height = wallHeightOf(p);
		const wing = Math.min(p.wingDepth, p.width / 3, p.depth / 3);
		const inner: [number, number] = [p.width - 2 * wing, p.depth - 2 * wing];
		const floodlit = (color: string) => floodlitSurface(lights.floodlights, color, FLOODLIT);
		const [tx, tz] = towerAt(p);
		const rows = { glass: palette.glass, windows: lights.windows };
		// The back and the sides are full height; the front is a low arcade onto the courtyard.
		const wings: { at: [number, number]; size: [number, number]; alongX: boolean }[] = [
			{ at: [0, -p.depth / 2 + wing / 2], size: [p.width, wing], alongX: true },
			{ at: [p.width / 2 - wing / 2, 0.0], size: [wing, inner[1] + wing], alongX: false },
			{ at: [-p.width / 2 + wing / 2, 0.0], size: [wing, inner[1] + wing], alongX: false },
		];
		const arcadeHeight = Math.min(height * 0.45, FLOOR * 2);
		const arches = Math.max(3, Math.round(inner[0] / 0.6));
		return (
			<group>
				{wings.map(({ at: [x, z], size: [w, d], alongX }) => (
					<group key={`${x},${z}`} position={[x, 0, z]}>
						<Block
							position={[0, height / 2, 0]}
							size={[w, height, d]}
							color={colors.brick}
							{...floodlit(colors.brick)}
						/>

						<Prism
							position={[0, height, 0]}
							size={alongX ? [w + 0.1, ROOF_HEIGHT, d + 0.14] : [d + 0.1, ROOF_HEIGHT, w + 0.14]}
							rotation={alongX ? undefined : [0, Math.PI / 2, 0]}
							color={colors.roof}
						/>
					</group>
				))}

				{/* The front: a low arcade between the side wings, a terrace on top. */}
				<group position={[0, 0, p.depth / 2 - wing * 0.35]}>
					<Block
						position={[0, arcadeHeight - 0.08, 0]}
						size={[inner[0], 0.16, wing * 0.7]}
						color={colors.brick}
						{...floodlit(colors.brick)}
					/>

					<Block
						position={[0, arcadeHeight + 0.05, 0]}
						size={[inner[0], 0.1, wing * 0.7]}
						color={colors.trim}
					/>

					{spread(arches + 1, inner[0] - 0.1).map((x) => (
						<Block
							key={x}
							position={[x, (arcadeHeight - 0.16) / 2, wing * 0.2]}
							size={[0.12, arcadeHeight - 0.16, 0.12]}
							color={colors.brick}
							{...floodlit(colors.brick)}
						/>
					))}
				</group>

				<Block
					position={[0, 0.012, wing / 2]}
					size={[inner[0] + 0.01, 0.024, inner[1] + wing]}
					color={colors.courtyard}
					castShadow={false}
				/>

				{/* Windows on the outer walls, and on the courtyard's three walls. */}
				<WindowRows
					length={p.width}
					at={p.depth / 2}
					turn={Math.PI}
					floors={p.floorCount}
					seed={p.seed}
					{...rows}
				/>

				{[Math.PI / 2, -Math.PI / 2].map((turn, i) => (
					<WindowRows
						key={turn}
						length={p.depth - 0.2}
						at={p.width / 2}
						turn={turn}
						floors={p.floorCount}
						seed={p.seed + 1 + i}
						{...rows}
					/>
				))}

				{/* The front ends of the side wings. */}
				{[-1, 1].map((sx) => (
					<group key={sx} position={[sx * (p.width / 2 - wing / 2), 0, 0]}>
						<WindowRows
							length={wing - 0.2}
							at={p.depth / 2}
							turn={0}
							floors={p.floorCount}
							seed={p.seed + 5 + sx}
							{...rows}
						/>
					</group>
				))}

				<group position={[0, 0, wing / 2]}>
					<WindowRows
						length={inner[0] - 0.2}
						at={-(inner[1] + wing) / 2}
						turn={0}
						floors={p.floorCount}
						seed={p.seed + 8}
						{...rows}
					/>

					{[Math.PI / 2, -Math.PI / 2].map((turn, i) => (
						<WindowRows
							key={turn}
							length={inner[1] + wing - 0.4}
							at={-inner[0] / 2}
							turn={turn}
							floors={p.floorCount}
							seed={p.seed + 9 + i}
							{...rows}
						/>
					))}
				</group>

				{/* A slender turret with a copper dome at the back corner. */}
				<group position={[-p.width / 2 + 0.45, 0, -p.depth / 2 + 0.45]}>
					<Octagon
						position={[0, 0, 0]}
						size={[0.36, height + 0.9, 0.36]}
						color={colors.brick}
						{...floodlit(colors.brick)}
					/>

					<Dome position={[0, height + 0.9, 0]} size={[0.38, 0.42, 0.38]} color={colors.roof} />

					<Spire position={[0, height + 1.28, 0]} size={[0.05, 0.4, 0.05]} color={colors.crowns} />
				</group>

				{/* The tower: brick up to a corbelled top, an open copper lantern, a cap, three crowns. */}
				<group position={[tx, 0, tz]}>
					<Block
						position={[0, p.towerHeight / 2, 0]}
						size={[TOWER_SIDE, p.towerHeight, TOWER_SIDE]}
						color={colors.brick}
						{...floodlit(colors.brick)}
					/>

					<Block
						position={[0, p.towerHeight - 0.1, 0]}
						size={[TOWER_SIDE + 0.14, 0.2, TOWER_SIDE + 0.14]}
						color={colors.brick}
						{...floodlit(colors.brick)}
					/>

					{[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((turn) => (
						<group key={turn} rotation={[0, turn, 0]}>
							{/* Tall slit windows up the tower, a clock-like roundel near the top. */}
							{[-0.32, 0, 0.32].map((x) => (
								<Block
									key={x}
									position={[x, p.towerHeight * 0.55, TOWER_SIDE / 2 + 0.008]}
									size={[0.1, p.towerHeight * 0.5, 0.014]}
									color={palette.glass}
									castShadow={false}
								/>
							))}

							{/* The lantern's corner piers and arches, open between them. */}
							<Block
								position={[0.32, p.towerHeight + CROWN.lantern / 2, 0.32]}
								size={[0.12, CROWN.lantern, 0.12]}
								color={colors.roof}
								{...floodlit(colors.roof)}
							/>
						</group>
					))}

					<Block
						position={[0, p.towerHeight + CROWN.lantern * 0.5, 0]}
						size={[0.36, CROWN.lantern, 0.36]}
						color={colors.roof}
					/>

					<Block
						position={[0, p.towerHeight + CROWN.lantern + 0.05, 0]}
						size={[0.86, 0.1, 0.86]}
						color={colors.roof}
					/>

					<Spire
						position={[0, p.towerHeight + CROWN.lantern + 0.1, 0]}
						size={[0.4, CROWN.cap, 0.4]}
						color={colors.roof}
					/>

					<group position={[0, p.towerHeight + CROWN.lantern + CROWN.cap, 0]}>
						<Block
							position={[0, CROWN.pole / 2, 0]}
							size={[0.03, CROWN.pole, 0.03]}
							color={colors.crowns}
						/>

						{[0, 1, 2].map((i) => {
							const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
							return (
								<Crown
									key={i}
									position={[Math.cos(angle) * 0.13, CROWN.pole, Math.sin(angle) * 0.13]}
									color={colors.crowns}
								/>
							);
						})}
					</group>
				</group>

				{/* Floodlights before the front and at the tower's foot. */}
				{[
					[tx - 0.3, tz + TOWER_SIDE / 2 + 0.5],
					[tx + 0.4, tz + TOWER_SIDE / 2 + 0.5],
					[-p.width * 0.25, p.depth / 2 + 0.5],
					[p.width * 0.05, p.depth / 2 + 0.5],
				].map(([x, z]) => (
					<group key={`${x},${z}`} position={[x, 0, z]}>
						<Block position={[0, 0.07, 0]} size={[0.16, 0.14, 0.12]} color="#3b3d40" />

						<Block
							position={[0, 0.1, -0.065]}
							size={[0.12, 0.08, 0.01]}
							color="#f4ead2"
							castShadow={false}
							{...lightEmission(lights.floodlights, 2.4)}
						/>
					</group>
				))}
			</group>
		);
	},
});
